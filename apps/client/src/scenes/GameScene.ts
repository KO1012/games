/**
 * Main game scene – renders the level, players, mechanisms, and effects.
 * All visual rendering is handled by dedicated modules;
 * this scene orchestrates them and reads shared game state.
 *
 * NOTE: This scene does NOT handle keyboard input.
 * All input is handled at the window level by KeyboardInputBuffer in main.ts.
 * This avoids conflicts with Phaser's keyboard event capturing.
 */
import {
  DEFAULT_CLIENT_HEIGHT,
  DEFAULT_CLIENT_WIDTH,
  PLAYER_ROLES,
  PLAYER_SIZE,
  ROOM_PHASES,
  type LevelSchema,
  type PlayerRole,
  type PlayerSnapshot,
} from "@coop-game/shared";
import Phaser from "phaser";

import * as Sound from "../audio/SoundManager.js";
import { ParticleManager } from "../effects/ParticleManager.js";
import { ScreenEffects } from "../effects/ScreenEffects.js";
import { BackgroundRenderer } from "../rendering/BackgroundRenderer.js";
import { generateAllTextures } from "../rendering/TextureGenerator.js";
import {
  BUTTON_ACTIVE,
  BUTTON_IDLE,
  getDoorColor,
  DOOR_FRAME,
  DOOR_INDICATOR_CLOSED,
  DOOR_INDICATOR_OPEN,
  EXIT_GLOW,
  LASER_CORE,
  LASER_GLOW,
  PLATFORM_MOVING,
} from "../ui/colors.js";
import type { GameState } from "../state.js";

/** Pixel font family – loaded via Google Fonts in index.html */
const PIXEL_FONT = "'Press Start 2P', monospace";

type MechanismView = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;

export class GameScene extends Phaser.Scene {
  // -- Player views --
  private playerViews!: Record<PlayerRole, Phaser.GameObjects.Image>;
  private roleLabels!: Record<PlayerRole, Phaser.GameObjects.Text>;
  private prevAlive: Partial<Record<PlayerRole, boolean>> = {};
  private prevGrounded: Partial<Record<PlayerRole, boolean>> = {};

  // -- Level objects --
  private renderedLevelId: string | null = null;
  private levelObjects: Phaser.GameObjects.GameObject[] = [];
  private buttonViews: Record<string, Phaser.GameObjects.Rectangle> = {};
  private doorViews: Record<string, Phaser.GameObjects.Rectangle> = {};
  private doorIndicators: Record<string, Phaser.GameObjects.Rectangle> = {};
  private trapViews: Record<string, MechanismView> = {};
  private movingPlatformViews: Record<string, Phaser.GameObjects.TileSprite> = {};
  private movingPlatformShadows: Record<string, Phaser.GameObjects.Rectangle> = {};
  private exitRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  // -- Subsystems --
  private bg!: BackgroundRenderer;
  private particles!: ParticleManager;
  private fx!: ScreenEffects;

  // -- State tracking for audio triggers --
  private prevButtons: Record<string, boolean> = {};
  private prevDoors: Record<string, boolean> = {};
  private prevPhase: string = "";

  // -- External state ref (set from main.ts) --
  public gameState!: GameState;
  public myRole: PlayerRole | null = null;

  constructor() {
    super("GameScene");
  }

  public create(): void {
    // Disable Phaser's keyboard capturing so it does not swallow
    // window-level keydown/keyup events used by KeyboardInputBuffer.
    if (this.input.keyboard) {
      this.input.keyboard.enabled = false;
    }

    // Generate all pixel textures
    generateAllTextures(this);

    // Background
    this.bg = new BackgroundRenderer(this, DEFAULT_CLIENT_WIDTH, DEFAULT_CLIENT_HEIGHT);

    // Subsystems
    this.particles = new ParticleManager(this);
    this.fx = new ScreenEffects(this);

    // Control hint
    this.add
      .text(DEFAULT_CLIENT_WIDTH / 2, DEFAULT_CLIENT_HEIGHT - 16, "WASD MOVE · SPACE JUMP · E INTERACT", {
        color: "#64748b",
        fontFamily: PIXEL_FONT,
        fontSize: "8px",
      })
      .setOrigin(0.5)
      .setDepth(50);

    // Player images
    this.playerViews = {
      [PLAYER_ROLES.A]: this.add.image(0, 0, "player_a").setVisible(false).setDepth(10),
      [PLAYER_ROLES.B]: this.add.image(0, 0, "player_b").setVisible(false).setDepth(10),
    };

    this.roleLabels = {
      [PLAYER_ROLES.A]: this.createRoleLabel(PLAYER_ROLES.A),
      [PLAYER_ROLES.B]: this.createRoleLabel(PLAYER_ROLES.B),
    };

    // Initial fade in
    this.fx.fadeIn(800);

    // Add Post-Processing
    if (this.cameras.main.postFX) {
      this.cameras.main.postFX.addBloom(0xffffff, 1, 1, 1.2, 1.5);
      this.cameras.main.postFX.addVignette(0.5, 0.5, 0.8, 0.4);
    }
  }

  public update(time: number, delta: number): void {
    const state = this.gameState;
    if (!state) return;

    this.bg.update(time, delta);

    // Level rendering
    if (state.level?.id !== this.renderedLevelId) {
      this.renderLevel(state.level);
      if (state.level) {
        this.cameras.main.setBounds(0, 0, state.level.world.width, state.level.world.height);
        this.fx.fadeIn(500);
        Sound.playLevelStart();
      }
    }

    // Exit glow particles
    for (const exit of this.exitRects) {
      this.particles.emitExitGlow(exit.x, exit.y, exit.w, exit.h);
    }

    // Sync mechanism views
    this.syncMechanismViews(state);

    // Sync players
    this.syncPlayers(state, time);

    // Phase-change audio
    if (state.phase !== this.prevPhase) {
      if (state.phase === ROOM_PHASES.levelComplete) {
        Sound.playLevelComplete();
        this.fx.flash(300);
      }
      if (state.phase === ROOM_PHASES.finished) Sound.playGameComplete();
      this.prevPhase = state.phase;
    }
  }

  // ── Players ──────────────────────────────────────────────────

  private syncPlayers(state: GameState, time: number): void {
    for (const role of Object.values(PLAYER_ROLES)) {
      const player = state.players[role];
      const view = this.playerViews[role];
      const label = this.roleLabels[role];

      if (!player) {
        view.setVisible(false);
        label.setVisible(false);
        continue;
      }

      view.setVisible(true);
      label.setVisible(true);

      const cx = player.x + PLAYER_SIZE / 2;
      const cy = player.y + PLAYER_SIZE / 2;
      view.setPosition(cx, cy);

      // Facing
      view.setFlipX(player.facing === -1);

      // State animations
      this.applyPlayerAnimation(view, player, role, time);

      // Label
      label.setText(role === this.myRole ? `${role} YOU` : role);
      label.setPosition(cx, player.y - 10);

      // Camera follow for local player
      if (role === this.myRole) {
        this.cameras.main.startFollow(view, true, 0.08, 0.08);
      }

      // Death / respawn triggers
      const wasAlive = this.prevAlive[role] ?? true;
      if (wasAlive && !player.alive) {
        Sound.playDeath();
        this.particles.emitDeath(cx, cy);
        this.fx.shake(0.008, 100);
      }
      if (!wasAlive && player.alive) {
        Sound.playRespawn();
        this.particles.emitRespawn(cx, cy);
      }
      this.prevAlive[role] = player.alive;

      // Land trigger
      const wasGrounded = this.prevGrounded[role] ?? false;
      if (!wasGrounded && player.grounded && player.alive) {
        this.particles.emitLandImpact(cx, player.y + PLAYER_SIZE);
        Sound.playLand();
      }
      this.prevGrounded[role] = player.grounded;
    }
  }

  private applyPlayerAnimation(
    view: Phaser.GameObjects.Image,
    player: PlayerSnapshot,
    role: PlayerRole,
    time: number,
  ): void {
    if (!player.alive) {
      // Dead – invisible with flicker
      view.setAlpha(0.15);
      view.setScale(1);
      return;
    }

    const isMe = role === this.myRole;
    const baseAlpha = isMe ? 1 : 0.8;

    if (!player.grounded) {
      // Airborne – stretch/squash
      if (player.vy < 0) {
        // Rising
        view.setScale(0.9, 1.12);
      } else {
        // Falling
        view.setScale(1.1, 0.88);
      }
      view.setAlpha(baseAlpha);
    } else if (Math.abs(player.vx) > 10) {
      // Running – slight lean + bob
      const bob = Math.sin(time * 0.012) * 1.5;
      view.setScale(1);
      view.y += bob;
      view.setAlpha(baseAlpha);

      // Running dust
      if (Math.random() < 0.08) {
        this.particles.emitDust(
          player.x + PLAYER_SIZE / 2,
          player.y + PLAYER_SIZE,
        );
      }
    } else {
      // Idle – gentle breathing
      const breath = 1 + Math.sin(time * 0.003) * 0.02;
      view.setScale(1, breath);
      view.setAlpha(baseAlpha);
    }
  }

  // ── Level rendering ──────────────────────────────────────────

  private renderLevel(level: LevelSchema | null): void {
    for (const obj of this.levelObjects) obj.destroy();
    this.levelObjects = [];
    this.buttonViews = {};
    this.doorViews = {};
    this.doorIndicators = {};
    this.trapViews = {};
    this.movingPlatformViews = {};
    this.movingPlatformShadows = {};
    this.exitRects = [];
    this.prevButtons = {};
    this.prevDoors = {};
    this.renderedLevelId = level?.id ?? null;

    if (!level) return;

    // World bounds background
    this.levelObjects.push(
      this.add
        .rectangle(0, 0, level.world.width, level.world.height, 0x0a0e18, 0.5)
        .setOrigin(0)
        .setDepth(-8),
    );

    // Spawn indicators
    for (const spawn of level.players) {
      const color = spawn.playerIndex === 0 ? 0x38bdf8 : 0xfb923c;
      const indicator = this.add
        .rectangle(spawn.x, spawn.y, PLAYER_SIZE, PLAYER_SIZE)
        .setOrigin(0)
        .setStrokeStyle(1, color, 0.3)
        .setDepth(1);
      this.levelObjects.push(indicator);

      // Spawn label
      const spawnLabel = this.add
        .text(spawn.x + PLAYER_SIZE / 2, spawn.y - 8, spawn.playerIndex === 0 ? "P1" : "P2", {
          fontFamily: PIXEL_FONT,
          fontSize: "6px",
          color: `#${color.toString(16).padStart(6, "0")}`,
        })
        .setOrigin(0.5)
        .setAlpha(0.4)
        .setDepth(2);
      this.levelObjects.push(spawnLabel);
    }

    // Platforms
    for (const platform of level.platforms) {
      const r = platform.rect;
      
      // Shadow
      const shadow = this.add.rectangle(r.x + 12, r.y + 16, r.w, r.h, 0x000000, 0.4).setOrigin(0).setDepth(1);
      this.levelObjects.push(shadow);

      if (platform.type === "moving") {
        this.movingPlatformShadows[platform.id] = shadow;
        // Moving platform as TileSprite
        const ts = this.add
          .tileSprite(r.x, r.y, r.w, r.h, "platform_moving")
          .setOrigin(0)
          .setDepth(2);
        this.movingPlatformViews[platform.id] = ts;
        this.levelObjects.push(ts);

        // Draw path
        if (platform.path && platform.path.length >= 2) {
          const pathG = this.add.graphics().setDepth(0).setAlpha(0.2);
          pathG.lineStyle(1, PLATFORM_MOVING, 0.5);
          pathG.moveTo(platform.path[0].x + r.w / 2, platform.path[0].y + r.h / 2);
          for (let i = 1; i < platform.path.length; i++) {
            pathG.lineTo(platform.path[i].x + r.w / 2, platform.path[i].y + r.h / 2);
          }
          pathG.strokePath();
          this.levelObjects.push(pathG);
        }
      } else {
        const texKey = platform.type === "oneWay" ? "platform_oneway" : "platform_solid";
        const ts = this.add
          .tileSprite(r.x, r.y, r.w, r.h, texKey)
          .setOrigin(0)
          .setDepth(2);
        this.levelObjects.push(ts);
      }
    }

    // Buttons
    for (const button of level.buttons) {
      const r = button.rect;
      const view = this.add
        .rectangle(r.x, r.y, r.w, r.h, BUTTON_IDLE)
        .setOrigin(0)
        .setStrokeStyle(2, 0xeab308)
        .setDepth(3);
      
      const shadow = this.add.rectangle(r.x + 8, r.y + 8, r.w, r.h, 0x000000, 0.3).setOrigin(0).setDepth(2);
      this.levelObjects.push(shadow);

      this.buttonViews[button.id] = view;
      this.levelObjects.push(view);

      // Button kind label
      const kindChar = button.kind === "pressure" ? "▼" : button.kind === "interact" ? "E" : "⏱";
      const kindLabel = this.add
        .text(r.x + r.w / 2, r.y + r.h / 2, kindChar, {
          fontFamily: PIXEL_FONT,
          fontSize: "7px",
          color: "#fef08a",
        })
        .setOrigin(0.5)
        .setDepth(4);
      this.levelObjects.push(kindLabel);
    }

    // Doors
    for (const door of level.doors) {
      const r = door.rect;
      const color = getDoorColor(door.colorKey);

      // Door body
      const view = this.add
        .rectangle(r.x, r.y, r.w, r.h, color)
        .setOrigin(0)
        .setStrokeStyle(2, DOOR_FRAME)
        .setDepth(5);
        
      const shadow = this.add.rectangle(r.x + 12, r.y + 16, r.w, r.h, 0x000000, 0.4).setOrigin(0).setDepth(4);
      this.levelObjects.push(shadow);

      this.doorViews[door.id] = view;
      this.levelObjects.push(view);

      // Indicator dot
      const indicator = this.add
        .rectangle(r.x + r.w / 2 - 2, r.y + 6, 4, 4, DOOR_INDICATOR_CLOSED)
        .setOrigin(0)
        .setDepth(6);
      this.doorIndicators[door.id] = indicator;
      this.levelObjects.push(indicator);
    }

    // Exits
    for (const exit of level.exits) {
      const r = exit.rect;
      this.exitRects.push({ x: r.x, y: r.y, w: r.w, h: r.h });

      // Exit frame from texture
      const exitView = this.add
        .rectangle(r.x, r.y, r.w, r.h, EXIT_GLOW, 0.15)
        .setOrigin(0)
        .setStrokeStyle(3, 0x22c55e)
        .setDepth(2);
      this.levelObjects.push(exitView);

      // Exit label
      const exitLabel = this.add
        .text(r.x + r.w / 2, r.y + r.h / 2, "EXIT", {
          fontFamily: PIXEL_FONT,
          fontSize: "8px",
          color: "#22c55e",
        })
        .setOrigin(0.5)
        .setAlpha(0.6)
        .setDepth(3);
      this.levelObjects.push(exitLabel);
    }

    // Traps
    for (const trap of level.traps) {
      const r = trap.rect;
      let view: MechanismView;

      if (trap.type === "spike") {
        // Spike uses tiled spike texture
        view = this.add
          .tileSprite(r.x, r.y, r.w, r.h, "trap_spike")
          .setOrigin(0)
          .setDepth(4);
      } else if (trap.type === "laser") {
        // Laser: colored rectangle with glow
        view = this.add
          .rectangle(r.x, r.y, r.w, r.h, LASER_CORE, 0.9)
          .setOrigin(0)
          .setDepth(4);
        // Glow behind
        const glow = this.add
          .rectangle(r.x - 2, r.y, r.w + 4, r.h, LASER_GLOW, 0.25)
          .setOrigin(0)
          .setDepth(3);
        this.levelObjects.push(glow);
      } else {
        // Crusher
        view = this.add
          .tileSprite(r.x, r.y, r.w, r.h, "trap_crusher")
          .setOrigin(0)
          .setDepth(4);
      }

      this.trapViews[trap.id] = view;
      this.levelObjects.push(view);
    }
  }

  // ── Mechanism sync ───────────────────────────────────────────

  private syncMechanismViews(state: GameState): void {
    // Buttons
    for (const [id, view] of Object.entries(this.buttonViews)) {
      const bs = state.buttons[id];
      const isActive = bs?.active ?? false;
      view.setFillStyle(isActive ? BUTTON_ACTIVE : BUTTON_IDLE, isActive ? 1 : 0.75);

      // Audio trigger
      const wasActive = this.prevButtons[id] ?? false;
      if (!wasActive && isActive) Sound.playButtonPress();
      if (wasActive && !isActive) Sound.playButtonRelease();
      this.prevButtons[id] = isActive;
    }

    // Doors
    for (const [id, view] of Object.entries(this.doorViews)) {
      const ds = state.doors[id];
      const isOpen = ds?.open ?? false;

      // Animate alpha
      const targetAlpha = isOpen ? 0.12 : 1;
      const current = view.alpha;
      view.setAlpha(current + (targetAlpha - current) * 0.15);

      // Indicator
      const indicator = this.doorIndicators[id];
      if (indicator) {
        indicator.setFillStyle(isOpen ? DOOR_INDICATOR_OPEN : DOOR_INDICATOR_CLOSED);
      }

      // Audio trigger
      const wasOpen = this.prevDoors[id] ?? false;
      if (!wasOpen && isOpen) Sound.playDoorOpen();
      if (wasOpen && !isOpen) Sound.playDoorClose();
      this.prevDoors[id] = isOpen;
    }

    // Traps
    for (const [id, view] of Object.entries(this.trapViews)) {
      const ts = state.traps[id];
      if (ts) {
        if ("setPosition" in view) {
          (view as Phaser.GameObjects.Rectangle).setPosition(ts.x, ts.y);
        }
      }
      const targetAlpha = ts?.active ? 1 : 0.15;
      const cur = view.alpha;
      view.setAlpha(cur + (targetAlpha - cur) * 0.15);
    }

    // Moving platforms
    for (const [id, view] of Object.entries(this.movingPlatformViews)) {
      const ps = state.movingPlatforms[id];
      if (ps) {
        view.setPosition(ps.x, ps.y);
        const shadow = this.movingPlatformShadows[id];
        if (shadow) shadow.setPosition(ps.x + 12, ps.y + 16);
        const targetAlpha = ps.active ? 1 : 0.45;
        view.setAlpha(view.alpha + (targetAlpha - view.alpha) * 0.1);
      }
    }
  }

  // ── Input ────────────────────────────────────────────────────

  private createRoleLabel(role: PlayerRole): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, role, {
        color: "#f8fafc",
        fontFamily: PIXEL_FONT,
        fontSize: "7px",
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setVisible(false);
  }
}

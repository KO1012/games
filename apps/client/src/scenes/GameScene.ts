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

import { bindSfxScene } from "../audio/SfxManager.js";
import * as Sound from "../audio/SoundManager.js";
import { MusicManager, type MusicTrack } from "../audio/MusicManager.js";
import { ParticleManager } from "../effects/ParticleManager.js";
import { ScreenEffects } from "../effects/ScreenEffects.js";
import { BackgroundRenderer } from "../rendering/BackgroundRenderer.js";
import { PlayerAnimator } from "../rendering/PlayerAnimator.js";
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
type RectLike = { x: number; y: number; w: number; h: number };
type PointLike = { x: number; y: number };
type MechanismLinkView = {
  buttonId: string;
  targetId: string;
  action: string;
  graphics: Phaser.GameObjects.Graphics;
};

export type RenderDebugInfo = {
  cameraScrollX: number;
  cameraScrollY: number;
  cameraCenterX: number;
  cameraCenterY: number;
  playerViewX: number | null;
  playerViewY: number | null;
  playerScreenX: number | null;
  playerScreenY: number | null;
  cameraFollowing: boolean;
};

export class GameScene extends Phaser.Scene {
  // -- Player views --
  private playerViews!: Record<PlayerRole, Phaser.GameObjects.Sprite>;
  private playerAnimator!: PlayerAnimator;
  private roleLabels!: Record<PlayerRole, Phaser.GameObjects.Text>;
  private localPlayerMarker!: Phaser.GameObjects.Triangle;
  private teammateIndicator!: Phaser.GameObjects.Triangle;
  private teammateIndicatorLabel!: Phaser.GameObjects.Text;
  private prevAlive: Partial<Record<PlayerRole, boolean>> = {};
  private prevGrounded: Partial<Record<PlayerRole, boolean>> = {};

  // -- Level objects --
  private renderedLevelId: string | null = null;
  private levelObjects: Phaser.GameObjects.GameObject[] = [];
  private buttonViews: Record<string, Phaser.GameObjects.Rectangle> = {};
  private mechanismLinks: MechanismLinkView[] = [];
  private doorViews: Record<string, Phaser.GameObjects.Rectangle> = {};
  private doorIndicators: Record<string, Phaser.GameObjects.Rectangle> = {};
  private doorFeedbackLabels: Record<string, Phaser.GameObjects.Text> = {};
  private trapViews: Record<string, MechanismView> = {};
  private movingPlatformViews: Record<string, Phaser.GameObjects.TileSprite> = {};
  private movingPlatformShadows: Record<string, Phaser.GameObjects.Rectangle> = {};
  private exitRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  // -- Subsystems --
  private bg!: BackgroundRenderer;
  private particles!: ParticleManager;
  private fx!: ScreenEffects;
  private music!: MusicManager;
  private currentMusicTrack: MusicTrack = null;

  // -- State tracking for audio triggers --
  private prevButtons: Record<string, boolean> = {};
  private prevDoors: Record<string, boolean> = {};
  private prevPhase: string = "";
  private cameraFollowRole: PlayerRole | null = null;
  private levelIntroText!: Phaser.GameObjects.Text;
  private levelHintText!: Phaser.GameObjects.Text;
  private levelIntroVisibleUntil = 0;

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

    // Generate all pixel textures (procedural fallback when external assets are missing)
    generateAllTextures(this);

    // Background
    this.bg = new BackgroundRenderer(this, DEFAULT_CLIENT_WIDTH, DEFAULT_CLIENT_HEIGHT);

    // Subsystems
    this.particles = new ParticleManager(this);
    this.fx = new ScreenEffects(this);
    this.playerAnimator = new PlayerAnimator(this);
    this.playerAnimator.registerAnimations();
    this.music = new MusicManager();
    this.music.bind(this);
    bindSfxScene(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleShutdown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.handleShutdown());

    // Control hint
    this.add
      .text(DEFAULT_CLIENT_WIDTH / 2, DEFAULT_CLIENT_HEIGHT - 16, "WASD MOVE · SPACE JUMP · E INTERACT", {
        color: "#64748b",
        fontFamily: PIXEL_FONT,
        fontSize: "8px",
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.levelIntroText = this.add
      .text(DEFAULT_CLIENT_WIDTH / 2, 72, "", {
        color: "#f8fafc",
        fontFamily: PIXEL_FONT,
        fontSize: "11px",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60)
      .setVisible(false);

    this.levelHintText = this.add
      .text(DEFAULT_CLIENT_WIDTH / 2, 94, "", {
        color: "#bfdbfe",
        fontFamily: PIXEL_FONT,
        fontSize: "7px",
        align: "center",
        wordWrap: { width: 620 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60)
      .setVisible(false);

    // Player sprites – use external spritesheet when present, fallback to procedural texture
    this.playerViews = {
      [PLAYER_ROLES.A]: this.add
        .sprite(0, 0, this.playerAnimator.getTextureKey(PLAYER_ROLES.A))
        .setVisible(false)
        .setDepth(10),
      [PLAYER_ROLES.B]: this.add
        .sprite(0, 0, this.playerAnimator.getTextureKey(PLAYER_ROLES.B))
        .setVisible(false)
        .setDepth(10),
    };

    this.roleLabels = {
      [PLAYER_ROLES.A]: this.createRoleLabel(PLAYER_ROLES.A),
      [PLAYER_ROLES.B]: this.createRoleLabel(PLAYER_ROLES.B),
    };

    this.localPlayerMarker = this.add
      .triangle(0, 0, 0, 12, 8, 0, 16, 12, 0xf8fafc, 0.95)
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false);

    this.teammateIndicator = this.add
      .triangle(0, 0, 0, 14, 9, 0, 18, 14, 0xf97316, 0.95)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(70)
      .setVisible(false);

    this.teammateIndicatorLabel = this.add
      .text(0, 0, "", {
        color: "#f8fafc",
        fontFamily: PIXEL_FONT,
        fontSize: "7px",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(71)
      .setVisible(false);

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
    this.syncMechanismLinks(state, time);
    this.syncDoorBlockFeedback(state, time);

    // Sync players
    this.syncPlayers(state, time);
    this.syncPlayerMarkers(state, time);
    this.syncLevelIntro(time);

    // Phase-change audio
    if (state.phase !== this.prevPhase) {
      if (state.phase === ROOM_PHASES.levelComplete) {
        Sound.playLevelComplete();
        this.fx.flash(300);
      }
      if (state.phase === ROOM_PHASES.finished) Sound.playGameComplete();
      this.prevPhase = state.phase;
    }

    this.syncMusicTrack(state.phase);
  }

  private syncMusicTrack(phase: string): void {
    let next: MusicTrack;
    if (phase === ROOM_PHASES.playing || phase === ROOM_PHASES.loadingLevel) {
      next = "level";
    } else if (phase === ROOM_PHASES.levelComplete || phase === ROOM_PHASES.finished) {
      next = "victory";
    } else {
      next = "menu";
    }
    if (next === this.currentMusicTrack) return;
    this.currentMusicTrack = next;
    this.music.play(next);
  }

  private handleShutdown(): void {
    this.music?.destroy();
    bindSfxScene(null);
    this.currentMusicTrack = null;
  }

  public getRenderDebugInfo(role: PlayerRole | null): RenderDebugInfo {
    const camera = this.cameras?.main;

    if (!camera) {
      return {
        cameraScrollX: 0,
        cameraScrollY: 0,
        cameraCenterX: 0,
        cameraCenterY: 0,
        playerViewX: null,
        playerViewY: null,
        playerScreenX: null,
        playerScreenY: null,
        cameraFollowing: false,
      };
    }

    const view = role ? this.playerViews?.[role] : null;
    const playerViewX = view?.visible ? view.x : null;
    const playerViewY = view?.visible ? view.y : null;
    const followTarget = (camera as unknown as { _follow?: Phaser.GameObjects.GameObject | null })._follow;

    return {
      cameraScrollX: camera.scrollX,
      cameraScrollY: camera.scrollY,
      cameraCenterX: camera.midPoint.x,
      cameraCenterY: camera.midPoint.y,
      playerViewX,
      playerViewY,
      playerScreenX: playerViewX === null ? null : playerViewX - camera.scrollX,
      playerScreenY: playerViewY === null ? null : playerViewY - camera.scrollY,
      cameraFollowing: Boolean(role && view && followTarget === view),
    };
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

      // State animations (also handles facing flip)
      this.applyPlayerAnimation(view, player, role, time);

      // Label
      label.setText(role === this.myRole ? `${role} YOU` : role);
      label.setPosition(cx, player.y - 10);

      // Camera follow for local player
      if (role === this.myRole) {
        this.syncCameraFollow(role, view);
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
    view: Phaser.GameObjects.Sprite,
    player: PlayerSnapshot,
    role: PlayerRole,
    time: number,
  ): void {
    const isMe = role === this.myRole;
    const result = this.playerAnimator.apply(view, player, role, isMe, time);
    if (result.emitDust) {
      this.particles.emitDust(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE);
    }
  }

  private syncPlayerMarkers(state: GameState, time: number): void {
    this.syncLocalPlayerMarker(state, time);
    this.syncTeammateIndicator(state);
  }

  private syncLocalPlayerMarker(state: GameState, time: number): void {
    const localPlayer = this.myRole ? state.players[this.myRole] : null;

    if (!this.myRole || !localPlayer?.connected || !localPlayer.alive) {
      this.localPlayerMarker.setVisible(false);
      return;
    }

    const color = this.getPlayerColor(this.myRole);
    const pulse = 1 + Math.sin(time * 0.008) * 0.08;
    this.localPlayerMarker
      .setVisible(true)
      .setPosition(localPlayer.x + PLAYER_SIZE / 2, localPlayer.y - 18)
      .setScale(pulse)
      .setFillStyle(color, 0.95);
  }

  private syncTeammateIndicator(state: GameState): void {
    const teammateRole = this.getTeammateRole();
    const teammate = teammateRole ? state.players[teammateRole] : null;

    if (!teammateRole || !teammate?.connected || !teammate.alive) {
      this.hideTeammateIndicator();
      return;
    }

    const camera = this.cameras.main;
    const screenX = teammate.x + PLAYER_SIZE / 2 - camera.scrollX;
    const screenY = teammate.y + PLAYER_SIZE / 2 - camera.scrollY;
    const margin = 38;
    const onScreen =
      screenX >= margin &&
      screenX <= camera.width - margin &&
      screenY >= margin &&
      screenY <= camera.height - margin;

    if (onScreen) {
      this.hideTeammateIndicator();
      return;
    }

    const x = Phaser.Math.Clamp(screenX, margin, camera.width - margin);
    const y = Phaser.Math.Clamp(screenY, margin, camera.height - margin);
    const angle = Math.atan2(screenY - camera.height / 2, screenX - camera.width / 2);
    const color = this.getPlayerColor(teammateRole);
    const labelOffsetY = y < camera.height / 2 ? 18 : -18;

    this.teammateIndicator
      .setVisible(true)
      .setPosition(x, y)
      .setRotation(angle + Math.PI / 2)
      .setFillStyle(color, 0.95);
    this.teammateIndicatorLabel
      .setVisible(true)
      .setPosition(x, y + labelOffsetY)
      .setText(teammateRole)
      .setColor(`#${color.toString(16).padStart(6, "0")}`);
  }

  private hideTeammateIndicator(): void {
    this.teammateIndicator.setVisible(false);
    this.teammateIndicatorLabel.setVisible(false);
  }

  private getTeammateRole(): PlayerRole | null {
    if (this.myRole === PLAYER_ROLES.A) return PLAYER_ROLES.B;
    if (this.myRole === PLAYER_ROLES.B) return PLAYER_ROLES.A;
    return null;
  }

  private getPlayerColor(role: PlayerRole): number {
    return role === PLAYER_ROLES.A ? 0x38bdf8 : 0xfb923c;
  }

  // ── Level rendering ──────────────────────────────────────────

  private showLevelIntro(level: LevelSchema): void {
    const metadata = level.metadata;
    const title = metadata?.title ?? level.name;
    const parTime = metadata ? ` · PAR ${Math.round(metadata.parTimeMs / 1000)}S` : "";
    const difficulty = metadata ? `D${metadata.difficulty}` : level.id.toUpperCase();

    this.levelIntroText.setText(`${difficulty} · ${title}${parTime}`);
    this.levelHintText.setText(metadata?.introText ?? "");
    this.levelIntroVisibleUntil = this.time.now + 8000;
    this.levelIntroText.setVisible(true).setAlpha(1);
    this.levelHintText.setVisible(Boolean(metadata?.introText)).setAlpha(1);
  }

  private syncLevelIntro(time: number): void {
    if (time >= this.levelIntroVisibleUntil) {
      this.hideLevelIntro();
      return;
    }

    const alpha = Phaser.Math.Clamp((this.levelIntroVisibleUntil - time) / 1200, 0, 1);
    this.levelIntroText.setAlpha(alpha);
    this.levelHintText.setAlpha(alpha);
  }

  private hideLevelIntro(): void {
    this.levelIntroText.setVisible(false).setAlpha(0);
    this.levelHintText.setVisible(false).setAlpha(0);
    this.levelIntroVisibleUntil = 0;
  }

  private renderLevel(level: LevelSchema | null): void {
    for (const obj of this.levelObjects) obj.destroy();
    this.levelObjects = [];
    this.buttonViews = {};
    this.mechanismLinks = [];
    this.doorViews = {};
    this.doorIndicators = {};
    this.doorFeedbackLabels = {};
    this.trapViews = {};
    this.movingPlatformViews = {};
    this.movingPlatformShadows = {};
    this.exitRects = [];
    this.prevButtons = {};
    this.prevDoors = {};
    this.renderedLevelId = level?.id ?? null;

    if (!level) {
      this.hideLevelIntro();
      return;
    }
    this.showLevelIntro(level);

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

    this.renderMechanismLinks(level);

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

      const feedbackLabel = this.add
        .text(r.x + r.w / 2, r.y - 10, "LOCKED", {
          fontFamily: PIXEL_FONT,
          fontSize: "7px",
          color: "#fca5a5",
        })
        .setOrigin(0.5)
        .setDepth(7)
        .setVisible(false)
        .setAlpha(0);
      this.doorFeedbackLabels[door.id] = feedbackLabel;
      this.levelObjects.push(feedbackLabel);
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

  private renderMechanismLinks(level: LevelSchema): void {
    for (const button of level.buttons) {
      for (const target of button.targets) {
        if (!this.getMechanismTargetCenter(level, target.targetId, this.gameState)) {
          continue;
        }

        const graphics = this.add.graphics().setDepth(1.6);
        this.mechanismLinks.push({
          buttonId: button.id,
          targetId: target.targetId,
          action: target.action,
          graphics,
        });
        this.levelObjects.push(graphics);
      }
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
      view.setStrokeStyle(2, DOOR_FRAME, 1);

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

  private syncMechanismLinks(state: GameState, time: number): void {
    if (!state.level) return;

    for (const link of this.mechanismLinks) {
      const button = state.level.buttons.find((candidate) => candidate.id === link.buttonId);
      const targetCenter = this.getMechanismTargetCenter(state.level, link.targetId, state);

      if (!button || !targetCenter) {
        link.graphics.clear();
        continue;
      }

      const sourceCenter = this.getRectCenter(button.rect);
      const active = state.buttons[link.buttonId]?.active ?? false;
      const color = this.getMechanismLinkColor(state.level, link.targetId, link.action);
      this.drawMechanismLink(link.graphics, sourceCenter, targetCenter, color, active, time);
    }
  }

  private drawMechanismLink(
    graphics: Phaser.GameObjects.Graphics,
    source: PointLike,
    target: PointLike,
    color: number,
    active: boolean,
    time: number,
  ): void {
    graphics.clear();

    if (active) {
      graphics.lineStyle(3, color, 0.9);
      graphics.beginPath();
      graphics.moveTo(source.x, source.y);
      graphics.lineTo(target.x, target.y);
      graphics.strokePath();

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const dotCount = Math.max(2, Math.floor(length / 48));
      graphics.fillStyle(color, 0.95);

      for (let i = 0; i < dotCount; i += 1) {
        const t = (time * 0.0016 + i / dotCount) % 1;
        graphics.fillRect(source.x + dx * t - 3, source.y + dy * t - 3, 6, 6);
      }
      return;
    }

    graphics.lineStyle(2, 0x64748b, 0.32);
    this.drawDashedLine(graphics, source, target, 12, 8);
  }

  private drawDashedLine(
    graphics: Phaser.GameObjects.Graphics,
    source: PointLike,
    target: PointLike,
    dashLength: number,
    gapLength: number,
  ): void {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const step = dashLength + gapLength;

    for (let start = 0; start < length; start += step) {
      const end = Math.min(start + dashLength, length);
      const startRatio = start / length;
      const endRatio = end / length;
      graphics.beginPath();
      graphics.moveTo(source.x + dx * startRatio, source.y + dy * startRatio);
      graphics.lineTo(source.x + dx * endRatio, source.y + dy * endRatio);
      graphics.strokePath();
    }
  }

  private getMechanismTargetCenter(level: LevelSchema, targetId: string, state: GameState | null): PointLike | null {
    const door = level.doors.find((candidate) => candidate.id === targetId);
    if (door) return this.getRectCenter(door.rect);

    const trap = level.traps.find((candidate) => candidate.id === targetId);
    if (trap) {
      const trapState = state?.traps[targetId];
      return this.getRectCenter({
        ...trap.rect,
        x: trapState?.x ?? trap.rect.x,
        y: trapState?.y ?? trap.rect.y,
      });
    }

    const platform = level.platforms.find((candidate) => candidate.id === targetId && candidate.type === "moving");
    if (platform) {
      const platformState = state?.movingPlatforms[targetId];
      return this.getRectCenter({
        ...platform.rect,
        x: platformState?.x ?? platform.rect.x,
        y: platformState?.y ?? platform.rect.y,
      });
    }

    return null;
  }

  private getMechanismLinkColor(level: LevelSchema, targetId: string, action: string): number {
    const door = level.doors.find((candidate) => candidate.id === targetId);
    if (door) return getDoorColor(door.colorKey);

    const trap = level.traps.find((candidate) => candidate.id === targetId);
    if (trap?.type === "laser") return LASER_CORE;
    if (trap?.type === "crusher") return 0xf97316;
    if (trap?.type === "spike") return 0xf43f5e;

    const platform = level.platforms.find((candidate) => candidate.id === targetId && candidate.type === "moving");
    if (platform) return PLATFORM_MOVING;

    return action === "close" || action === "disable" || action === "stop" ? 0xf97316 : 0x22c55e;
  }

  private getRectCenter(rect: RectLike): PointLike {
    return {
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
    };
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

  private syncCameraFollow(role: PlayerRole, view: Phaser.GameObjects.Sprite): void {
    const camera = this.cameras.main;
    const followTarget = (camera as unknown as { _follow?: Phaser.GameObjects.GameObject | null })._follow;

    if (this.cameraFollowRole === role && followTarget === view) {
      return;
    }

    camera.startFollow(view, true, 0.08, 0.08);
    camera.setDeadzone(260, 160);
    this.cameraFollowRole = role;
  }

  private syncDoorBlockFeedback(state: GameState, time: number): void {
    const localPlayer = this.myRole ? state.players[this.myRole] : null;

    if (!state.level || !localPlayer?.alive || !localPlayer.connected) {
      this.hideDoorBlockFeedback();
      return;
    }

    const playerRect = {
      x: localPlayer.x,
      y: localPlayer.y,
      w: PLAYER_SIZE,
      h: PLAYER_SIZE,
    };

    for (const door of state.level.doors) {
      const view = this.doorViews[door.id];
      const label = this.doorFeedbackLabels[door.id];
      const isOpen = state.doors[door.id]?.open ?? door.startsOpen;
      const blocked = !isOpen && this.isPlayerPressingClosedDoor(playerRect, localPlayer.facing, door.rect);

      if (!view || !label) {
        continue;
      }

      if (blocked) {
        const pulse = 0.65 + Math.sin(time * 0.018) * 0.25;
        label.setVisible(true).setAlpha(pulse);
        view.setStrokeStyle(4, 0xfca5a5, 0.9);
      } else {
        label.setVisible(false).setAlpha(0);
      }
    }
  }

  private hideDoorBlockFeedback(): void {
    for (const label of Object.values(this.doorFeedbackLabels)) {
      label.setVisible(false).setAlpha(0);
    }
  }

  private isPlayerPressingClosedDoor(playerRect: RectLike, facing: -1 | 1, doorRect: RectLike): boolean {
    const verticalOverlap = playerRect.y < doorRect.y + doorRect.h && playerRect.y + playerRect.h > doorRect.y;
    const nearRightSide = facing === 1 && playerRect.x + playerRect.w >= doorRect.x - 8 && playerRect.x + playerRect.w <= doorRect.x + 10;
    const nearLeftSide = facing === -1 && playerRect.x <= doorRect.x + doorRect.w + 8 && playerRect.x >= doorRect.x + doorRect.w - 10;

    return verticalOverlap && (nearRightSide || nearLeftSide);
  }
}

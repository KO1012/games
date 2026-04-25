/**
 * Player animation system.
 *
 * The selection of animation state is implemented as a pure function
 * (`selectPlayerAnimState`) so it can be unit-tested without Phaser. The
 * `PlayerAnimator` class wraps the pure selector and applies visual updates
 * (squash/stretch, bob, alpha, frame swap) to a given Phaser image.
 *
 * If an external spritesheet was loaded by PreloadScene the animator will
 * play frame-based animations registered on the scene; otherwise it falls
 * back to procedural transforms only (which is what the earlier
 * implementation did).
 */
import { PLAYER_ROLES, PLAYER_SIZE, type PlayerRole, type PlayerSnapshot } from "@coop-game/shared";
import type Phaser from "phaser";

import { isAssetPresent } from "../assets/AssetRegistry.js";

export type PlayerAnimState = "idle" | "run" | "jump" | "fall" | "death";

export interface PlayerAnimSelection {
  state: PlayerAnimState;
  facing: 1 | -1;
}

const RUN_VX_THRESHOLD = 10;

/**
 * Pure animation state selector. Independently testable.
 *
 * Rules:
 * - Dead players → `death`.
 * - Airborne with vy < 0 → `jump`. With vy >= 0 → `fall`.
 * - Grounded with |vx| > threshold → `run`.
 * - Otherwise → `idle`.
 *
 * Facing follows the latest snapshot but stays previous when both vx ≈ 0 and
 * facing is undefined. Defaults to right-facing (1).
 */
export function selectPlayerAnimState(
  player: Pick<PlayerSnapshot, "alive" | "grounded" | "vx" | "vy" | "facing">,
): PlayerAnimSelection {
  const facing = player.facing === -1 ? -1 : 1;

  if (!player.alive) {
    return { state: "death", facing };
  }

  if (!player.grounded) {
    return { state: player.vy < 0 ? "jump" : "fall", facing };
  }

  if (Math.abs(player.vx) > RUN_VX_THRESHOLD) {
    return { state: "run", facing };
  }

  return { state: "idle", facing };
}

/**
 * Both players share a single character spritesheet (Kenney "Pixel Platformer",
 * 9 columns × 3 rows of 24×24 packed frames). Each role picks a row.
 */
const SHARED_SHEET_KEY = "ext_players";
const SHEET_COLS = 9;

/** Row index per role inside the shared sheet. */
const ROLE_ROW: Record<PlayerRole, number> = {
  [PLAYER_ROLES.A]: 0, // top row → blue character
  [PLAYER_ROLES.B]: 1, // middle row → yellow character
};

/**
 * External sheet frame edge in pixels. Kenney "Pixel Platformer" frames are
 * 24×24; with PLAYER_SIZE=48 we render at scale=2 to match collision size.
 * The procedural fallback uses a 48×48 texture which renders at scale=1.
 */
const EXTERNAL_FRAME_SIZE = 24;
const EXTERNAL_BASE_SCALE = PLAYER_SIZE / EXTERNAL_FRAME_SIZE;

/**
 * Per-state frame indices RELATIVE to the role's row (0-8). Mapping reflects
 * the typical Kenney "Pixel Platformer" character row layout:
 *   col 0: stand / idle
 *   col 1: walk A
 *   col 2: walk B
 *   col 3: jump (legs apart)
 *   col 4: hit / hurt
 * Run cycles between idle, walk-A, idle, walk-B for a 4-step gait.
 */
const SPRITE_FRAMES_RELATIVE: Record<PlayerAnimState, number[]> = {
  idle: [0],
  run: [1, 0, 2, 0],
  jump: [3],
  fall: [3],
  death: [4],
};

const FRAME_RATE: Record<PlayerAnimState, number> = {
  idle: 4,
  run: 10,
  jump: 1,
  fall: 1,
  death: 1,
};

export class PlayerAnimator {
  private scene: Phaser.Scene;
  private animsRegistered = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Register Phaser frame-based animations for both roles.
   * Safe to call when the spritesheet is missing – method is a no-op then.
   */
  public registerAnimations(): void {
    if (this.animsRegistered) return;
    if (!isAssetPresent(SHARED_SHEET_KEY)) return;

    for (const role of Object.values(PLAYER_ROLES)) {
      const rowOffset = ROLE_ROW[role] * SHEET_COLS;
      for (const stateKey of Object.keys(SPRITE_FRAMES_RELATIVE) as PlayerAnimState[]) {
        const animKey = this.animKey(role, stateKey);
        if (this.scene.anims.exists(animKey)) continue;
        const frames = SPRITE_FRAMES_RELATIVE[stateKey].map((col) => rowOffset + col);
        this.scene.anims.create({
          key: animKey,
          frames: this.scene.anims.generateFrameNumbers(SHARED_SHEET_KEY, { frames }),
          frameRate: FRAME_RATE[stateKey],
          repeat: stateKey === "idle" || stateKey === "run" ? -1 : 0,
        });
      }
    }

    this.animsRegistered = true;
  }

  /** Returns true if the shared external sheet has been loaded. */
  public hasExternalSheet(role: PlayerRole): boolean {
    void role; // accepted for future per-role sheets; currently shared
    return isAssetPresent(SHARED_SHEET_KEY);
  }

  /** Texture key to bind to the player image (external sheet or fallback). */
  public getTextureKey(role: PlayerRole): string {
    return this.hasExternalSheet(role) ? SHARED_SHEET_KEY : `player_${role.toLowerCase()}`;
  }

  /** Base scale to render the player at (depends on texture native size). */
  public getBaseScale(role: PlayerRole): number {
    return this.hasExternalSheet(role) ? EXTERNAL_BASE_SCALE : 1;
  }

  private animKey(role: PlayerRole, state: PlayerAnimState): string {
    return `${SHARED_SHEET_KEY}_${role}_${state}`;
  }

  /**
   * Apply the animation state to a Phaser image. Centralizes squash/stretch,
   * bob, alpha, dust emission decisions previously inlined in GameScene.
   */
  public apply(
    view: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    player: PlayerSnapshot,
    role: PlayerRole,
    isLocal: boolean,
    time: number,
  ): { selection: PlayerAnimSelection; emitDust: boolean } {
    const selection = selectPlayerAnimState(player);
    const baseAlpha = isLocal ? 1 : 0.85;
    let emitDust = false;

    // Frame-based animation when external sheet is available
    if (this.hasExternalSheet(role) && "play" in view) {
      const animKey = this.animKey(role, selection.state);
      const sprite = view as Phaser.GameObjects.Sprite;
      if (sprite.anims?.currentAnim?.key !== animKey && this.scene.anims.exists(animKey)) {
        sprite.play(animKey, true);
      }
    }

    view.setFlipX(selection.facing === -1);
    const base = this.getBaseScale(role);

    switch (selection.state) {
      case "death":
        view.setAlpha(0.18);
        view.setScale(base);
        break;

      case "jump":
        view.setScale(base * 0.88, base * 1.16);
        view.setAlpha(baseAlpha);
        break;

      case "fall":
        view.setScale(base * 1.1, base * 0.9);
        view.setAlpha(baseAlpha);
        break;

      case "run": {
        const bob = Math.sin(time * 0.012) * 1.5;
        view.setScale(base, base);
        view.y += bob;
        view.setAlpha(baseAlpha);
        emitDust = Math.random() < 0.08;
        break;
      }

      case "idle":
      default: {
        const breath = 1 + Math.sin(time * 0.003) * 0.025;
        view.setScale(base, base * breath);
        view.setAlpha(baseAlpha);
        break;
      }
    }

    return { selection, emitDust };
  }

  /** Centroid of the player rect (PLAYER_SIZE/2 offset). */
  public static centerOf(player: PlayerSnapshot): { x: number; y: number } {
    return { x: player.x + PLAYER_SIZE / 2, y: player.y + PLAYER_SIZE / 2 };
  }
}

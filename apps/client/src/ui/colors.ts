/**
 * Unified color token system for the pixel-art game.
 * All colors are 0xRRGGBB for Phaser usage.
 */

// ── Background & World ──────────────────────────────────────────
export const BG_DEEP = 0x0b0e1a;
export const BG_MID = 0x131729;
export const BG_TOP = 0x1a1f38;
export const WORLD_FILL = 0x0e1120;
export const WALL_COLOR = 0x1e2640;
export const WALL_HIGHLIGHT = 0x2a3355;

// ── Platforms ────────────────────────────────────────────────────
export const PLATFORM_SOLID = 0x3b4468;
export const PLATFORM_SOLID_TOP = 0x5c6590;
export const PLATFORM_SOLID_DARK = 0x252a44;
export const PLATFORM_ONEWAY = 0x4a5278;
export const PLATFORM_ONEWAY_TOP = 0x7b85b0;
export const PLATFORM_MOVING = 0x0e8a72;
export const PLATFORM_MOVING_TOP = 0x14c9a4;
export const PLATFORM_MOVING_DARK = 0x085c4c;

// ── Players ──────────────────────────────────────────────────────
export const PLAYER_A_BODY = 0x38bdf8;
export const PLAYER_A_DARK = 0x1a7ab5;
export const PLAYER_A_LIGHT = 0x7dd3fc;
export const PLAYER_A_EYE = 0xffffff;

export const PLAYER_B_BODY = 0xfb923c;
export const PLAYER_B_DARK = 0xc2650a;
export const PLAYER_B_LIGHT = 0xfdba74;
export const PLAYER_B_EYE = 0xffffff;

// ── Buttons ──────────────────────────────────────────────────────
export const BUTTON_IDLE = 0x6b5e10;
export const BUTTON_ACTIVE = 0xfacc15;
export const BUTTON_BORDER = 0xeab308;

// ── Doors ────────────────────────────────────────────────────────
export const DOOR_FRAME = 0x404860;
export const DOOR_INDICATOR_OPEN = 0x22c55e;
export const DOOR_INDICATOR_CLOSED = 0xef4444;

export function getDoorColor(colorKey: string | undefined): number {
  switch (colorKey) {
    case "blue":
      return 0x3b82f6;
    case "orange":
      return 0xfb923c;
    case "red":
      return 0xef4444;
    case "green":
      return 0x22c55e;
    default:
      return 0x8b5cf6;
  }
}

export function getDoorColorDark(colorKey: string | undefined): number {
  switch (colorKey) {
    case "blue":
      return 0x1e40af;
    case "orange":
      return 0x9a3412;
    case "red":
      return 0x991b1b;
    case "green":
      return 0x166534;
    default:
      return 0x5b21b6;
  }
}

// ── Traps ────────────────────────────────────────────────────────
export const SPIKE_COLOR = 0xdc2626;
export const SPIKE_DARK = 0x7f1d1d;
export const LASER_CORE = 0xff4444;
export const LASER_GLOW = 0xff8888;
export const CRUSHER_COLOR = 0xb91c1c;
export const CRUSHER_STRIPE = 0xeab308;

// ── Exit ─────────────────────────────────────────────────────────
export const EXIT_GLOW = 0x22c55e;
export const EXIT_FRAME = 0x16a34a;
export const EXIT_PARTICLE = 0x86efac;

// ── UI ───────────────────────────────────────────────────────────
export const UI_TEXT = 0xf8fafc;
export const UI_TEXT_DIM = 0x94a3b8;
export const UI_PANEL_BG = 0x0f172a;
export const UI_ACCENT = 0x38bdf8;
export const UI_ERROR = 0xfca5a5;

// ── Particles ────────────────────────────────────────────────────
export const DUST_COLOR = 0x94a3b8;
export const DEATH_COLORS = [0xef4444, 0xfca5a5, 0xffffff];
export const SPAWN_COLORS = [0x38bdf8, 0x7dd3fc, 0xffffff];

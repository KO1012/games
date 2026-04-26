/**
 * Unified color token system for the pixel-art game.
 * All colors are 0xRRGGBB for Phaser usage.
 */

// ── Background & World ──────────────────────────────────────────
export const BG_DEEP = 0x0b0e1a;
export const BG_MID = 0x102a32;
export const BG_TOP = 0x1d4f52;
export const WORLD_FILL = 0x080d13;
export const WALL_COLOR = 0x1d2b35;
export const WALL_HIGHLIGHT = 0x44616a;

// ── Platforms ────────────────────────────────────────────────────
export const PLATFORM_SOLID = 0x34434a;
export const PLATFORM_SOLID_TOP = 0x86d7cf;
export const PLATFORM_SOLID_DARK = 0x111a20;
export const PLATFORM_ONEWAY = 0x36535a;
export const PLATFORM_ONEWAY_TOP = 0xf4b24a;
export const PLATFORM_MOVING = 0x8a5a24;
export const PLATFORM_MOVING_TOP = 0xf4b24a;
export const PLATFORM_MOVING_DARK = 0x3a2818;

// ── Players ──────────────────────────────────────────────────────
export const PLAYER_A_BODY = 0x35d6c5;
export const PLAYER_A_DARK = 0x118174;
export const PLAYER_A_LIGHT = 0x8ff7ec;
export const PLAYER_A_EYE = 0xffffff;

export const PLAYER_B_BODY = 0xf59e0b;
export const PLAYER_B_DARK = 0x9a4f08;
export const PLAYER_B_LIGHT = 0xfcd34d;
export const PLAYER_B_EYE = 0xffffff;

// ── Buttons ──────────────────────────────────────────────────────
export const BUTTON_IDLE = 0x6d4b24;
export const BUTTON_ACTIVE = 0xf4b24a;
export const BUTTON_BORDER = 0xffd166;

// ── Doors ────────────────────────────────────────────────────────
export const DOOR_FRAME = 0x1b2630;
export const DOOR_INDICATOR_OPEN = 0x22c55e;
export const DOOR_INDICATOR_CLOSED = 0xef4444;

export function getDoorColor(colorKey: string | undefined): number {
  switch (colorKey) {
    case "blue":
      return 0x3b82f6;
    case "orange":
      return 0xf59e0b;
    case "red":
      return 0xff4f6d;
    case "green":
      return 0x35d6c5;
    default:
      return 0xc061ff;
  }
}

export function getDoorColorDark(colorKey: string | undefined): number {
  switch (colorKey) {
    case "blue":
      return 0x1e40af;
    case "orange":
      return 0x9a4f08;
    case "red":
      return 0x8a1028;
    case "green":
      return 0x118174;
    default:
      return 0x6d28a8;
  }
}

// ── Traps ────────────────────────────────────────────────────────
export const SPIKE_COLOR = 0xff4f6d;
export const SPIKE_DARK = 0x641221;
export const LASER_CORE = 0xff4fbf;
export const LASER_GLOW = 0xff91da;
export const CRUSHER_COLOR = 0x6b2430;
export const CRUSHER_STRIPE = 0xf4b24a;

// ── Exit ─────────────────────────────────────────────────────────
export const EXIT_GLOW = 0x35d6c5;
export const EXIT_FRAME = 0x118174;
export const EXIT_PARTICLE = 0x8ff7ec;

// ── UI ───────────────────────────────────────────────────────────
export const UI_TEXT = 0xf8fafc;
export const UI_TEXT_DIM = 0x94a3b8;
export const UI_PANEL_BG = 0x071018;
export const UI_ACCENT = 0x35d6c5;
export const UI_ERROR = 0xfca5a5;

// ── Particles ────────────────────────────────────────────────────
export const DUST_COLOR = 0x8aa4a6;
export const DEATH_COLORS = [0xff4f6d, 0xff91da, 0xffffff];
export const SPAWN_COLORS = [0x35d6c5, 0x8ff7ec, 0xffffff];

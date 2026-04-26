/**
 * Programmatic pixel-art texture generator.
 * Creates all game textures at runtime using Phaser Graphics,
 * so no external sprite assets are needed.
 */
import type Phaser from "phaser";

import {
  BUTTON_ACTIVE,
  BUTTON_BORDER,
  BUTTON_IDLE,
  CRUSHER_COLOR,
  CRUSHER_STRIPE,
  DOOR_FRAME,
  DOOR_INDICATOR_CLOSED,
  EXIT_FRAME,
  EXIT_GLOW,
  getDoorColor,
  getDoorColorDark,
  LASER_CORE,
  LASER_GLOW,
  PLATFORM_MOVING,
  PLATFORM_MOVING_DARK,
  PLATFORM_MOVING_TOP,
  PLATFORM_ONEWAY,
  PLATFORM_ONEWAY_TOP,
  PLATFORM_SOLID,
  PLATFORM_SOLID_DARK,
  PLATFORM_SOLID_TOP,
  PLAYER_A_BODY,
  PLAYER_A_DARK,
  PLAYER_A_EYE,
  PLAYER_A_LIGHT,
  PLAYER_B_BODY,
  PLAYER_B_DARK,
  PLAYER_B_EYE,
  PLAYER_B_LIGHT,
  SPIKE_COLOR,
  SPIKE_DARK,
  WALL_COLOR,
  WALL_HIGHLIGHT,
} from "../ui/colors.js";

const PX = 4; // base pixel size for the pixel art grid
const PLATFORM_TEXTURE_KEYS = ["platform_solid", "platform_oneway", "platform_moving"] as const;
const BUTTON_TEXTURE_KEYS = ["button_idle", "button_active"] as const;
const DOOR_TEXTURE_KEYS = [
  "door_blue",
  "door_orange",
  "door_red",
  "door_green",
  "door_purple",
] as const;
const TRAP_TEXTURE_KEYS = ["trap_spike", "trap_laser", "trap_crusher"] as const;

function hasAllTextures(scene: Phaser.Scene, keys: readonly string[]): boolean {
  return keys.every((key) => scene.textures.exists(key));
}

export function generateAllTextures(scene: Phaser.Scene): void {
  generatePlatformTextures(scene);
  generatePlayerTextures(scene);
  generateButtonTextures(scene);
  generateDoorTextures(scene);
  generateTrapTextures(scene);
  generateExitTexture(scene);
  generateWallTexture(scene);
  generateParticleTexture(scene);
}

// ── Platforms ────────────────────────────────────────────────────

function generatePlatformTextures(scene: Phaser.Scene): void {
  if (hasAllTextures(scene, PLATFORM_TEXTURE_KEYS)) return;

  // Solid platform tile (32x32)
  const solidG = scene.add.graphics();
  const ts = 32;
  solidG.fillStyle(PLATFORM_SOLID);
  solidG.fillRect(0, 0, ts, ts);
  // top highlight
  solidG.fillStyle(PLATFORM_SOLID_TOP);
  solidG.fillRect(0, 0, ts, PX);
  // bottom shadow
  solidG.fillStyle(PLATFORM_SOLID_DARK);
  solidG.fillRect(0, ts - PX, ts, PX);
  // lab-panel seams and rivets
  solidG.fillStyle(PLATFORM_SOLID_DARK, 0.35);
  solidG.fillRect(0, PX * 3, ts, 1);
  solidG.fillRect(ts / 2, PX, 1, ts - PX * 2);
  solidG.fillStyle(PLATFORM_SOLID_TOP, 0.55);
  for (let x = PX; x < ts; x += PX * 3) {
    solidG.fillRect(x, PX * 2, 2, 2);
  }
  solidG.fillStyle(0xf4b24a, 0.55);
  solidG.fillRect(ts - PX * 2, PX, PX, 1);
  solidG.generateTexture("platform_solid", ts, ts);
  solidG.destroy();

  // OneWay platform tile
  const owG = scene.add.graphics();
  owG.fillStyle(PLATFORM_ONEWAY, 0.6);
  owG.fillRect(0, 0, ts, ts);
  owG.fillStyle(0x0b1218, 0.25);
  owG.fillRect(0, PX * 2, ts, ts - PX * 2);
  owG.fillStyle(PLATFORM_ONEWAY_TOP);
  // dashed top
  for (let x = 0; x < ts; x += PX * 2) {
    owG.fillRect(x, 0, PX, PX);
  }
  owG.fillStyle(0x35d6c5, 0.35);
  owG.fillRect(PX, PX * 2, ts - PX * 2, 1);
  owG.generateTexture("platform_oneway", ts, ts);
  owG.destroy();

  // Moving platform tile
  const mvG = scene.add.graphics();
  mvG.fillStyle(PLATFORM_MOVING);
  mvG.fillRect(0, 0, ts, ts);
  mvG.fillStyle(PLATFORM_MOVING_TOP);
  mvG.fillRect(0, 0, ts, PX);
  mvG.fillStyle(PLATFORM_MOVING_DARK);
  mvG.fillRect(0, ts - PX, ts, PX);
  // brass rail and arrow marks
  mvG.fillStyle(0x111a20, 0.55);
  mvG.fillRect(PX, PX * 2, ts - PX * 2, PX);
  mvG.fillStyle(PLATFORM_MOVING_TOP, 0.5);
  mvG.fillRect(ts / 2 - PX, PX * 2, PX * 2, PX);
  mvG.fillRect(ts / 2 - PX / 2, PX * 3, PX, PX);
  mvG.fillStyle(0x35d6c5, 0.6);
  mvG.fillRect(PX, ts - PX * 2, PX, 1);
  mvG.fillRect(ts - PX * 2, ts - PX * 2, PX, 1);
  mvG.generateTexture("platform_moving", ts, ts);
  mvG.destroy();
}

// ── Players ──────────────────────────────────────────────────────

function generatePlayerTextures(scene: Phaser.Scene): void {
  generatePlayerSprite(
    scene,
    "player_a",
    PLAYER_A_BODY,
    PLAYER_A_DARK,
    PLAYER_A_LIGHT,
    PLAYER_A_EYE,
  );
  generatePlayerSprite(
    scene,
    "player_b",
    PLAYER_B_BODY,
    PLAYER_B_DARK,
    PLAYER_B_LIGHT,
    PLAYER_B_EYE,
  );
}

function generatePlayerSprite(
  scene: Phaser.Scene,
  key: string,
  body: number,
  dark: number,
  light: number,
  eye: number,
): void {
  // 48x48 pixel character
  const s = 48;
  const p = PX; // 4px grid
  const g = scene.add.graphics();

  // Body fill (center block)
  g.fillStyle(body);
  g.fillRect(p * 2, p * 2, s - p * 4, s - p * 3);

  // Head (top region)
  g.fillStyle(body);
  g.fillRect(p, p, s - p * 2, p * 3);

  // Darker shading on sides
  g.fillStyle(dark);
  g.fillRect(p, p * 4, p, s - p * 6);
  g.fillRect(s - p * 2, p * 4, p, s - p * 6);

  // Light highlight on top-left
  g.fillStyle(light);
  g.fillRect(p * 2, p, p * 2, p);

  // Eyes
  g.fillStyle(eye);
  g.fillRect(p * 3, p * 2, p, p);
  g.fillRect(s - p * 4, p * 2, p, p);

  // Pupils
  g.fillStyle(0x111111);
  g.fillRect(p * 3 + 2, p * 2, 2, p);
  g.fillRect(s - p * 4 + 2, p * 2, 2, p);

  // Feet
  g.fillStyle(dark);
  g.fillRect(p * 2, s - p, p * 2, p);
  g.fillRect(s - p * 4, s - p, p * 2, p);

  g.generateTexture(key, s, s);
  g.destroy();
}

// ── Buttons ──────────────────────────────────────────────────────

function generateButtonTextures(scene: Phaser.Scene): void {
  if (hasAllTextures(scene, BUTTON_TEXTURE_KEYS)) return;

  const bw = 64;
  const bh = 24;

  // Idle button
  const ig = scene.add.graphics();
  ig.fillStyle(BUTTON_IDLE);
  ig.fillRect(0, 0, bw, bh);
  ig.fillStyle(0x111a20, 0.35);
  ig.fillRect(PX, PX * 2, bw - PX * 2, bh - PX * 3);
  ig.fillStyle(BUTTON_BORDER);
  ig.fillRect(0, 0, bw, PX);
  ig.fillRect(0, 0, PX, bh);
  ig.fillRect(bw - PX, 0, PX, bh);
  ig.fillStyle(0x35d6c5, 0.5);
  ig.fillRect(bw - PX * 3, PX, PX, PX);
  ig.generateTexture("button_idle", bw, bh);
  ig.destroy();

  // Active button
  const ag = scene.add.graphics();
  ag.fillStyle(BUTTON_ACTIVE);
  ag.fillRect(0, 0, bw, bh);
  ag.fillStyle(BUTTON_BORDER);
  ag.fillRect(0, bh - PX, bw, PX);
  ag.fillStyle(0xfff1a8);
  ag.fillRect(PX, PX, bw - PX * 2, PX);
  ag.fillStyle(0x35d6c5, 0.8);
  ag.fillRect(bw - PX * 3, PX * 2, PX, PX);
  ag.generateTexture("button_active", bw, bh);
  ag.destroy();
}

// ── Doors ────────────────────────────────────────────────────────

function generateDoorTextures(scene: Phaser.Scene): void {
  if (hasAllTextures(scene, DOOR_TEXTURE_KEYS)) return;

  const colors = ["blue", "orange", "red", "green", "purple"];
  for (const color of colors) {
    generateDoorTexture(scene, color);
  }
}

function generateDoorTexture(scene: Phaser.Scene, colorKey: string): void {
  const w = 40;
  const h = 64;
  const g = scene.add.graphics();
  const main = getDoorColor(colorKey);
  const dark = getDoorColorDark(colorKey);

  // Frame
  g.fillStyle(DOOR_FRAME);
  g.fillRect(0, 0, w, h);

  // Door body
  g.fillStyle(main);
  g.fillRect(PX, PX, w - PX * 2, h - PX * 2);
  g.fillStyle(0x071018, 0.35);
  g.fillRect(PX * 2, PX * 2, w - PX * 4, h - PX * 4);

  // Vertical bars
  g.fillStyle(dark);
  for (let x = PX * 2; x < w - PX * 2; x += PX * 2) {
    g.fillRect(x, PX, PX / 2, h - PX * 2);
  }

  // Indicator light
  g.fillStyle(DOOR_INDICATOR_CLOSED);
  g.fillRect(w / 2 - PX / 2, PX * 2, PX, PX);
  g.fillStyle(0xffffff, 0.28);
  g.fillRect(PX * 2, PX * 2, PX, h - PX * 4);

  g.generateTexture(`door_${colorKey}`, w, h);
  g.destroy();
}

// ── Traps ────────────────────────────────────────────────────────

function generateTrapTextures(scene: Phaser.Scene): void {
  if (hasAllTextures(scene, TRAP_TEXTURE_KEYS)) return;

  // Spike tile (32x16)
  const sg = scene.add.graphics();
  const sw = 32;
  const sh = 16;
  sg.fillStyle(SPIKE_DARK);
  sg.fillRect(0, 0, sw, sh);
  // triangular teeth
  sg.fillStyle(SPIKE_COLOR);
  for (let x = 0; x < sw; x += 8) {
    sg.fillTriangle(x, sh, x + 4, 0, x + 8, sh);
  }
  sg.fillStyle(0xff91da, 0.55);
  for (let x = 2; x < sw; x += 8) {
    sg.fillRect(x + 2, 3, 1, 5);
  }
  sg.generateTexture("trap_spike", sw, sh);
  sg.destroy();

  // Laser (8x32)
  const lg = scene.add.graphics();
  lg.fillStyle(LASER_GLOW, 0.3);
  lg.fillRect(0, 0, 8, 32);
  lg.fillStyle(LASER_CORE);
  lg.fillRect(2, 0, 4, 32);
  lg.fillStyle(0xffffff, 0.7);
  lg.fillRect(3, 0, 2, 32);
  lg.generateTexture("trap_laser", 8, 32);
  lg.destroy();

  // Crusher tile (32x32)
  const cg = scene.add.graphics();
  cg.fillStyle(CRUSHER_COLOR);
  cg.fillRect(0, 0, 32, 32);
  // warning stripes
  cg.fillStyle(CRUSHER_STRIPE, 0.5);
  for (let i = 0; i < 32; i += 8) {
    cg.fillRect(i, i, PX, 32 - i);
  }
  cg.fillStyle(0x7f1d1d);
  cg.fillRect(0, 28, 32, PX);
  cg.fillStyle(0x111a20, 0.45);
  cg.fillRect(PX, PX, 32 - PX * 2, PX);
  cg.fillRect(PX, 32 - PX * 3, 32 - PX * 2, PX);
  cg.generateTexture("trap_crusher", 32, 32);
  cg.destroy();
}

// ── Exit ─────────────────────────────────────────────────────────

function generateExitTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists("exit_zone")) return;

  const w = 72;
  const h = 96;
  const g = scene.add.graphics();

  // Outer glow
  g.fillStyle(EXIT_GLOW, 0.15);
  g.fillRect(0, 0, w, h);

  // Frame
  g.fillStyle(EXIT_FRAME);
  g.fillRect(0, 0, w, PX);
  g.fillRect(0, h - PX, w, PX);
  g.fillRect(0, 0, PX, h);
  g.fillRect(w - PX, 0, PX, h);

  // Inner glow gradient
  g.fillStyle(EXIT_GLOW, 0.25);
  g.fillRect(PX, PX, w - PX * 2, h - PX * 2);
  g.fillStyle(EXIT_GLOW, 0.12);
  g.fillRect(PX * 2, PX * 2, w - PX * 4, h - PX * 4);
  g.fillStyle(0xff4fbf, 0.16);
  g.fillRect(PX * 3, PX * 3, w - PX * 6, h - PX * 6);

  // Top ornament
  g.fillStyle(0x86efac);
  g.fillRect(w / 2 - PX, PX, PX * 2, PX);

  g.generateTexture("exit_zone", w, h);
  g.destroy();
}

// ── Walls ────────────────────────────────────────────────────────

function generateWallTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists("wall_tile")) return;

  const ts = 32;
  const g = scene.add.graphics();
  g.fillStyle(WALL_COLOR);
  g.fillRect(0, 0, ts, ts);
  // Industrial stripes
  g.fillStyle(WALL_HIGHLIGHT, 0.2);
  g.fillRect(0, PX, ts, PX / 2);
  g.fillRect(0, ts - PX * 2, ts, PX / 2);

  g.fillStyle(0x0a0e1a, 0.3);
  for (let y = 0; y < ts; y += PX * 3) {
    g.fillRect(0, y, ts, 1);
  }
  g.fillStyle(0xf4b24a, 0.28);
  g.fillRect(PX * 2, PX * 2, PX, PX);
  g.fillStyle(0xff4fbf, 0.18);
  g.fillRect(ts - PX * 2, ts - PX * 3, PX, PX * 2);
  g.generateTexture("wall_tile", ts, ts);
  g.destroy();
}

// ── Particles ────────────────────────────────────────────────────

function generateParticleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists("pixel_particle")) return;

  const g = scene.add.graphics();
  g.fillStyle(0xffffff);
  g.fillRect(0, 0, PX, PX);
  g.generateTexture("pixel_particle", PX, PX);
  g.destroy();
}

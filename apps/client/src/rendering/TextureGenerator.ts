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
  // pixel detail
  solidG.fillStyle(PLATFORM_SOLID_DARK, 0.3);
  for (let x = 0; x < ts; x += PX * 2) {
    solidG.fillRect(x, PX * 2, PX, PX);
  }
  solidG.generateTexture("platform_solid", ts, ts);
  solidG.destroy();

  // OneWay platform tile
  const owG = scene.add.graphics();
  owG.fillStyle(PLATFORM_ONEWAY, 0.6);
  owG.fillRect(0, 0, ts, ts);
  owG.fillStyle(PLATFORM_ONEWAY_TOP);
  // dashed top
  for (let x = 0; x < ts; x += PX * 2) {
    owG.fillRect(x, 0, PX, PX);
  }
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
  // arrow marks
  mvG.fillStyle(PLATFORM_MOVING_TOP, 0.5);
  mvG.fillRect(ts / 2 - PX, PX * 2, PX * 2, PX);
  mvG.fillRect(ts / 2 - PX / 2, PX * 3, PX, PX);
  mvG.generateTexture("platform_moving", ts, ts);
  mvG.destroy();
}

// ── Players ──────────────────────────────────────────────────────

function generatePlayerTextures(scene: Phaser.Scene): void {
  generatePlayerSprite(scene, "player_a", PLAYER_A_BODY, PLAYER_A_DARK, PLAYER_A_LIGHT, PLAYER_A_EYE);
  generatePlayerSprite(scene, "player_b", PLAYER_B_BODY, PLAYER_B_DARK, PLAYER_B_LIGHT, PLAYER_B_EYE);
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
  const bw = 64;
  const bh = 24;

  // Idle button
  const ig = scene.add.graphics();
  ig.fillStyle(BUTTON_IDLE);
  ig.fillRect(0, 0, bw, bh);
  ig.fillStyle(BUTTON_BORDER);
  ig.fillRect(0, 0, bw, PX);
  ig.fillRect(0, 0, PX, bh);
  ig.fillRect(bw - PX, 0, PX, bh);
  ig.generateTexture("button_idle", bw, bh);
  ig.destroy();

  // Active button
  const ag = scene.add.graphics();
  ag.fillStyle(BUTTON_ACTIVE);
  ag.fillRect(0, 0, bw, bh);
  ag.fillStyle(BUTTON_BORDER);
  ag.fillRect(0, bh - PX, bw, PX);
  ag.fillStyle(0xfef08a);
  ag.fillRect(PX, PX, bw - PX * 2, PX);
  ag.generateTexture("button_active", bw, bh);
  ag.destroy();
}

// ── Doors ────────────────────────────────────────────────────────

function generateDoorTextures(scene: Phaser.Scene): void {
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

  // Vertical bars
  g.fillStyle(dark);
  for (let x = PX * 2; x < w - PX * 2; x += PX * 2) {
    g.fillRect(x, PX, PX / 2, h - PX * 2);
  }

  // Indicator light
  g.fillStyle(DOOR_INDICATOR_CLOSED);
  g.fillRect(w / 2 - PX / 2, PX * 2, PX, PX);

  g.generateTexture(`door_${colorKey}`, w, h);
  g.destroy();
}

// ── Traps ────────────────────────────────────────────────────────

function generateTrapTextures(scene: Phaser.Scene): void {
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
  cg.generateTexture("trap_crusher", 32, 32);
  cg.destroy();
}

// ── Exit ─────────────────────────────────────────────────────────

function generateExitTexture(scene: Phaser.Scene): void {
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

  // Top ornament
  g.fillStyle(0x86efac);
  g.fillRect(w / 2 - PX, PX, PX * 2, PX);

  g.generateTexture("exit_zone", w, h);
  g.destroy();
}

// ── Walls ────────────────────────────────────────────────────────

function generateWallTexture(scene: Phaser.Scene): void {
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
  g.generateTexture("wall_tile", ts, ts);
  g.destroy();
}

// ── Particles ────────────────────────────────────────────────────

function generateParticleTexture(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff);
  g.fillRect(0, 0, PX, PX);
  g.generateTexture("pixel_particle", PX, PX);
  g.destroy();
}

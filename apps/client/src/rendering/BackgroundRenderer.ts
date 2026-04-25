/**
 * Parallax background renderer.
 *
 * Layers (back to front):
 *   1. Vertical gradient sky (procedural).
 *   2. Far layer: distant skyline / nebula. Uses external image when present;
 *      otherwise procedurally drawn distant peaks.
 *   3. Mid layer: silhouetted ridges. External image or procedural ridges.
 *   4. Near layer: drifting fog band (procedural).
 *   5. Star dust (procedural, multi-layer with twinkle).
 *
 * Each layer uses a different parallax factor so camera scroll produces a
 * cohesive depth illusion. The implementation auto-detects whether external
 * sprites exist via AssetRegistry.
 */
import type Phaser from "phaser";

import { isAssetPresent } from "../assets/AssetRegistry.js";
import { BG_DEEP, BG_MID, BG_TOP, DUST_COLOR } from "../ui/colors.js";

interface Star {
  x: number;
  y: number;
  speed: number;
  alpha: number;
  size: number;
  layer: number;
}

interface FogBand {
  x: number;
  y: number;
  speed: number;
  width: number;
  alpha: number;
}

export class BackgroundRenderer {
  private scene: Phaser.Scene;
  private width: number;
  private height: number;

  private skyGradient!: Phaser.GameObjects.Graphics;
  private starGraphics!: Phaser.GameObjects.Graphics;
  private fogGraphics!: Phaser.GameObjects.Graphics;

  private farLayer!: Phaser.GameObjects.Graphics | Phaser.GameObjects.TileSprite;
  private midLayer!: Phaser.GameObjects.Graphics | Phaser.GameObjects.TileSprite;

  private stars: Star[] = [];
  private fogBands: FogBand[] = [];

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.create();
  }

  private create(): void {
    const w = this.width;
    const h = this.height;

    // ── Sky gradient ──────────────────────────────────────────────
    this.skyGradient = this.scene.add.graphics().setDepth(-100).setScrollFactor(0);
    const steps = 24;
    const stepH = Math.ceil(h / steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const color = lerpColor(BG_DEEP, t < 0.5 ? BG_MID : BG_TOP, t < 0.5 ? t * 2 : (t - 0.5) * 2);
      this.skyGradient.fillStyle(color);
      this.skyGradient.fillRect(0, i * stepH, w, stepH + 1);
    }

    // Subtle radial vignette overlay on top of sky
    const vignette = this.scene.add.graphics().setDepth(-99).setScrollFactor(0);
    vignette.fillStyle(0x000000, 0.18);
    vignette.fillRect(0, 0, w, 60);
    vignette.fillStyle(0x000000, 0.25);
    vignette.fillRect(0, h - 80, w, 80);

    // ── Far layer: external image or procedural skyline ──────────
    if (isAssetPresent("ext_bg_far")) {
      this.farLayer = this.scene.add
        .tileSprite(0, h - 240, w * 2, 240, "ext_bg_far")
        .setOrigin(0)
        .setDepth(-95)
        .setScrollFactor(0)
        .setAlpha(0.65);
    } else {
      this.farLayer = this.drawDistantPeaks(w, h);
    }

    // ── Mid layer: external image or procedural ridges ────────────
    if (isAssetPresent("ext_bg_mid")) {
      this.midLayer = this.scene.add
        .tileSprite(0, h - 180, w * 2, 180, "ext_bg_mid")
        .setOrigin(0)
        .setDepth(-93)
        .setScrollFactor(0)
        .setAlpha(0.85);
    } else {
      this.midLayer = this.drawNearRidges(w, h);
    }

    // ── Stars ─────────────────────────────────────────────────────
    this.starGraphics = this.scene.add.graphics().setDepth(-90).setScrollFactor(0);
    for (let i = 0; i < 110; i++) {
      const layer = Math.floor(Math.random() * 3);
      this.stars.push({
        x: Math.random() * w * 2,
        y: Math.random() * h * 0.7,
        speed: 0.06 + Math.random() * (0.18 + layer * 0.18),
        alpha: 0.18 + Math.random() * 0.32 + layer * 0.12,
        size: layer === 2 ? 3 : layer === 1 ? 2 : 1,
        layer,
      });
    }

    // ── Foreground fog bands ──────────────────────────────────────
    this.fogGraphics = this.scene.add.graphics().setDepth(-88).setScrollFactor(0);
    for (let i = 0; i < 4; i++) {
      this.fogBands.push({
        x: Math.random() * w * 1.5,
        y: h * (0.45 + Math.random() * 0.5),
        speed: 6 + Math.random() * 14,
        width: 240 + Math.random() * 220,
        alpha: 0.04 + Math.random() * 0.06,
      });
    }
  }

  // ── Procedural layer drawing ──────────────────────────────────

  private drawDistantPeaks(w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics().setDepth(-95).setScrollFactor(0);
    g.fillStyle(0x182037, 0.85);
    g.beginPath();
    g.moveTo(0, h);
    let x = 0;
    while (x < w + 80) {
      const peakHeight = 120 + Math.sin(x * 0.012) * 40 + Math.sin(x * 0.04) * 18;
      g.lineTo(x, h - peakHeight);
      x += 60 + Math.sin(x * 0.07) * 30;
    }
    g.lineTo(w + 80, h);
    g.closePath();
    g.fillPath();
    return g;
  }

  private drawNearRidges(w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics().setDepth(-93).setScrollFactor(0);
    g.fillStyle(0x0d1426, 0.95);
    g.beginPath();
    g.moveTo(0, h);
    let x = 0;
    while (x < w + 60) {
      const ridgeHeight = 70 + Math.sin(x * 0.025) * 30 + Math.cos(x * 0.07) * 22;
      g.lineTo(x, h - ridgeHeight);
      x += 40 + Math.cos(x * 0.05) * 18;
    }
    g.lineTo(w + 60, h);
    g.closePath();
    g.fillPath();

    // Top highlight on ridges
    g.lineStyle(1, 0x3a4566, 0.35);
    g.beginPath();
    let hx = 0;
    g.moveTo(0, h);
    while (hx < w + 60) {
      const ridgeHeight = 70 + Math.sin(hx * 0.025) * 30 + Math.cos(hx * 0.07) * 22;
      g.lineTo(hx, h - ridgeHeight);
      hx += 40 + Math.cos(hx * 0.05) * 18;
    }
    g.strokePath();
    return g;
  }

  // ── Frame update ──────────────────────────────────────────────

  public update(time: number, delta: number): void {
    const cam = this.scene.cameras.main;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;
    const dt = delta / 1000;

    // Far layer parallax
    if ("setTilePosition" in this.farLayer) {
      (this.farLayer as Phaser.GameObjects.TileSprite).setTilePosition(scrollX * 0.12, 0);
    } else {
      this.farLayer.setPosition(-scrollX * 0.12, -scrollY * 0.05);
    }

    // Mid layer parallax (faster)
    if ("setTilePosition" in this.midLayer) {
      (this.midLayer as Phaser.GameObjects.TileSprite).setTilePosition(scrollX * 0.28, 0);
    } else {
      this.midLayer.setPosition(-scrollX * 0.28, -scrollY * 0.1);
    }

    // Stars
    this.starGraphics.clear();
    for (const star of this.stars) {
      star.y -= star.speed * dt * 12;
      const parallaxX = 0.04 + star.layer * 0.04;
      const parallaxY = 0.04 + star.layer * 0.04;

      let renderX = star.x - scrollX * parallaxX;
      let renderY = star.y - scrollY * parallaxY;

      if (renderY < -4) {
        star.y += this.height + 4;
        renderY += this.height + 4;
      } else if (renderY > this.height + 4) {
        star.y -= this.height + 4;
        renderY -= this.height + 4;
      }

      if (renderX < -4) {
        star.x += this.width + 4;
        renderX += this.width + 4;
      } else if (renderX > this.width + 4) {
        star.x -= this.width + 4;
        renderX -= this.width + 4;
      }

      const flicker = 0.65 + Math.sin(star.x * 3 + star.y * 2 + time * 0.002) * 0.35;
      this.starGraphics.fillStyle(DUST_COLOR, star.alpha * flicker);
      this.starGraphics.fillRect(Math.floor(renderX), Math.floor(renderY), star.size, star.size);
    }

    // Fog bands
    this.fogGraphics.clear();
    for (const band of this.fogBands) {
      band.x -= band.speed * dt;
      if (band.x + band.width < -60) {
        band.x = this.width + 80;
        band.y = this.height * (0.45 + Math.random() * 0.5);
      }
      const renderX = band.x - scrollX * 0.45;
      const renderY = band.y - scrollY * 0.18;
      this.fogGraphics.fillStyle(0x94a3b8, band.alpha);
      this.fogGraphics.fillEllipse(renderX, renderY, band.width, band.width * 0.18);
    }
  }

  public destroy(): void {
    this.skyGradient.destroy();
    this.starGraphics.destroy();
    this.fogGraphics.destroy();
    this.farLayer.destroy();
    this.midLayer.destroy();
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | blue;
}

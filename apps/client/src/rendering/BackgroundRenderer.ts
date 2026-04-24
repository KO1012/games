/**
 * Parallax pixel-art background with multi-layered star dust and gradient layers.
 */
import type Phaser from "phaser";

import { BG_DEEP, BG_MID, BG_TOP, DUST_COLOR } from "../ui/colors.js";

interface Star {
  x: number;
  y: number;
  speed: number;
  alpha: number;
  size: number;
  layer: number; // 0: back, 1: mid, 2: front
}

export class BackgroundRenderer {
  private scene: Phaser.Scene;
  private bgLayer!: Phaser.GameObjects.Graphics;
  private stars: Star[] = [];
  private starGraphics!: Phaser.GameObjects.Graphics;
  private gridLayer!: Phaser.GameObjects.Graphics;
  private width: number;
  private height: number;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.create();
  }

  private create(): void {
    const w = this.width;
    const h = this.height;

    // Gradient background (static)
    this.bgLayer = this.scene.add.graphics().setDepth(-100).setScrollFactor(0);
    const steps = 12;
    const stepH = Math.ceil(h / steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const color = lerpColor(BG_DEEP, t < 0.5 ? BG_MID : BG_TOP, t < 0.5 ? t * 2 : (t - 0.5) * 2);
      this.bgLayer.fillStyle(color);
      this.bgLayer.fillRect(0, i * stepH, w, stepH + 1);
    }

    // Background grid lines (subtle, slow parallax)
    this.gridLayer = this.scene.add.graphics().setDepth(-95);
    this.gridLayer.lineStyle(1, 0x4a5278, 0.06);
    
    // Draw an oversized grid so it can scroll
    for (let x = -w; x < w * 2; x += 64) {
      this.gridLayer.moveTo(x, -h);
      this.gridLayer.lineTo(x, h * 2);
    }
    for (let y = -h; y < h * 2; y += 64) {
      this.gridLayer.moveTo(-w, y);
      this.gridLayer.lineTo(w * 2, y);
    }
    this.gridLayer.strokePath();

    // Multi-layer Stars
    this.starGraphics = this.scene.add.graphics().setDepth(-90).setScrollFactor(0);
    
    // Create stars for different layers
    for (let i = 0; i < 80; i++) {
      const layer = Math.floor(Math.random() * 3); // 0, 1, or 2
      this.stars.push({
        x: Math.random() * w * 2,
        y: Math.random() * h * 2,
        speed: 0.1 + Math.random() * (0.2 + layer * 0.2),
        alpha: 0.15 + Math.random() * 0.3 + layer * 0.1,
        size: layer === 2 ? 3 : layer === 1 ? 2 : 1,
        layer: layer,
      });
    }
  }

  public update(_time: number, delta: number): void {
    const cam = this.scene.cameras.main;
    const scrollX = cam.scrollX;
    const scrollY = cam.scrollY;

    // Subtle parallax for grid
    this.gridLayer.setPosition(-scrollX * 0.05, -scrollY * 0.05);

    this.starGraphics.clear();
    const dt = delta / 1000;

    for (const star of this.stars) {
      // Natural drifting
      star.y -= star.speed * dt * 15;
      
      // Wrap around logic (relative to camera to keep them on screen)
      // Parallax factor based on layer: Front (2) moves more than Back (0)
      const parallaxFactorX = 0.05 + star.layer * 0.05;
      const parallaxFactorY = 0.05 + star.layer * 0.05;
      
      let renderX = star.x - scrollX * parallaxFactorX;
      let renderY = star.y - scrollY * parallaxFactorY;

      // Wrap around bounds (camera view width/height)
      const w = this.scene.sys.game.config.width as number;
      const h = this.scene.sys.game.config.height as number;

      // If out of bounds, wrap them
      if (renderY < -4) {
        star.y += h + 4;
        renderY += h + 4;
      } else if (renderY > h + 4) {
        star.y -= h + 4;
        renderY -= h + 4;
      }

      if (renderX < -4) {
        star.x += w + 4;
        renderX += w + 4;
      } else if (renderX > w + 4) {
        star.x -= w + 4;
        renderX -= w + 4;
      }

      // Twinkle
      const flicker = 0.7 + Math.sin(star.x * 3 + star.y * 2 + _time * 0.002) * 0.3;
      this.starGraphics.fillStyle(DUST_COLOR, star.alpha * flicker);
      this.starGraphics.fillRect(Math.floor(renderX), Math.floor(renderY), star.size, star.size);
    }
  }

  public destroy(): void {
    this.bgLayer.destroy();
    this.starGraphics.destroy();
    this.gridLayer.destroy();
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

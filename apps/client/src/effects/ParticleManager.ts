/**
 * Particle effects manager – using Phaser 3.60+ native ParticleEmitter.
 */
import Phaser from "phaser";

import { DEATH_COLORS, DUST_COLOR, EXIT_PARTICLE, SPAWN_COLORS } from "../ui/colors.js";

export class ParticleManager {
  private scene: Phaser.Scene;
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private landEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private deathEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private spawnEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private exitEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createEmitters();
  }

  private createEmitters(): void {
    // Dust
    this.dustEmitter = this.scene.add.particles(0, 0, "pixel_particle", {
      lifespan: { min: 250, max: 400 },
      speedX: { min: -15, max: 15 },
      speedY: { min: -20, max: -5 },
      gravityY: 10,
      scale: { start: 1, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: DUST_COLOR,
      emitting: false,
    }).setDepth(5);

    // Land Impact
    this.landEmitter = this.scene.add.particles(0, 0, "pixel_particle", {
      lifespan: { min: 200, max: 300 },
      speedX: { min: -40, max: 40 },
      speedY: { min: -10, max: 0 },
      gravityY: 0,
      scaleX: { start: 1, end: 0.1 },
      scaleY: { start: 1, end: 0.1 },
      alpha: { start: 0.8, end: 0 },
      tint: DUST_COLOR,
      emitting: false,
    }).setDepth(5);

    // Death Emitters (one per color)
    for (const color of DEATH_COLORS) {
      this.deathEmitters.push(
        this.scene.add.particles(0, 0, "pixel_particle", {
          lifespan: { min: 350, max: 550 },
          speed: { min: 30, max: 80 },
          scale: { start: 1.5, end: 0 },
          alpha: { start: 1, end: 0 },
          rotate: { min: 0, max: 360 },
          tint: color,
          gravityY: 40,
          emitting: false,
        }).setDepth(20)
      );
    }

    // Spawn Emitters (one per color)
    for (const color of SPAWN_COLORS) {
      this.spawnEmitters.push(
        this.scene.add.particles(0, 0, "pixel_particle", {
          lifespan: { min: 400, max: 600 },
          speedY: { min: -60, max: -30 },
          speedX: { min: -5, max: 5 },
          scale: { start: 1, end: 0 },
          alpha: { start: 0.8, end: 0 },
          tint: color,
          emitting: false,
        }).setDepth(15)
      );
    }

    // Exit Glow
    this.exitEmitter = this.scene.add.particles(0, 0, "pixel_particle", {
      lifespan: { min: 600, max: 1000 },
      speedY: { min: -30, max: -10 },
      speedX: { min: -5, max: 5 },
      scale: { start: 1, end: 0.5 },
      alpha: { start: 0.6, end: 0 },
      tint: EXIT_PARTICLE,
      emitting: false,
      frequency: 100, // Used for manual emission control
    }).setDepth(3);
  }

  public emitDust(x: number, y: number): void {
    this.dustEmitter.emitParticleAt(x, y, Phaser.Math.Between(3, 6));
  }

  public emitLandImpact(x: number, y: number): void {
    this.landEmitter.emitParticleAt(x, y, 6);
  }

  public emitDeath(x: number, y: number): void {
    for (const emitter of this.deathEmitters) {
      emitter.emitParticleAt(x, y, Phaser.Math.Between(4, 6));
    }
  }

  public emitRespawn(x: number, y: number): void {
    for (let i = 0; i < this.spawnEmitters.length; i++) {
      const emitter = this.spawnEmitters[i];
      // Delay effect for spawn column
      this.scene.time.delayedCall(i * 40, () => {
        emitter.emitParticleAt(x, y + 20, Phaser.Math.Between(2, 4));
      });
    }
  }

  public emitExitGlow(x: number, y: number, w: number, h: number): void {
    if (Math.random() > 0.15) return;
    this.exitEmitter.emitParticleAt(x + Math.random() * w, y + h, 1);
  }
}

/**
 * Screen-level visual effects: shake, flash, fade.
 */
import type Phaser from "phaser";

export class ScreenEffects {
  private scene: Phaser.Scene;
  private flashOverlay: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Brief camera shake (death, heavy landing). */
  public shake(intensity = 0.006, duration = 80): void {
    this.scene.cameras.main.shake(duration, intensity);
  }

  /** White flash overlay. */
  public flash(duration = 200): void {
    if (this.flashOverlay) {
      this.flashOverlay.destroy();
    }

    const cam = this.scene.cameras.main;
    this.flashOverlay = this.scene.add
      .rectangle(cam.scrollX, cam.scrollY, cam.width, cam.height, 0xffffff, 0.6)
      .setOrigin(0)
      .setDepth(100)
      .setScrollFactor(0);

    this.scene.tweens.add({
      targets: this.flashOverlay,
      alpha: 0,
      duration,
      onComplete: () => {
        this.flashOverlay?.destroy();
        this.flashOverlay = null;
      },
    });
  }

  /** Fade in from black. */
  public fadeIn(duration = 600): void {
    this.scene.cameras.main.fadeIn(duration, 0, 0, 0);
  }

  /** Fade out to black. */
  public fadeOut(duration = 400): void {
    this.scene.cameras.main.fadeOut(duration, 0, 0, 0);
  }
}

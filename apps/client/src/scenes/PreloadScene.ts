/**
 * Preload scene – attempts to load every entry in the asset manifest, then
 * marks each entry as present/missing in the AssetRegistry so downstream
 * systems can decide whether to use external assets or procedural fallbacks.
 *
 * If a file is missing (404), Phaser fires a `loaderror` event; we swallow it
 * and continue. The game must remain playable with zero external assets.
 */
import { DEFAULT_CLIENT_HEIGHT, DEFAULT_CLIENT_WIDTH } from "@coop-game/shared";
import Phaser from "phaser";

import {
  AUDIO_ASSETS,
  SPRITE_ASSETS,
  type AudioAsset,
  type SpriteAsset,
} from "../assets/manifest.js";
import { markAssetMissing, markAssetPresent } from "../assets/AssetRegistry.js";

const PIXEL_FONT = "'Press Start 2P', monospace";

export class PreloadScene extends Phaser.Scene {
  private barFill!: Phaser.GameObjects.Rectangle;
  private barFrame!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;

  constructor() {
    super("PreloadScene");
  }

  public preload(): void {
    if (this.input.keyboard) this.input.keyboard.enabled = false;

    this.cameras.main.setBackgroundColor("#080d13");
    this.createLoadingUi();
    this.queueAssets();
    this.attachLoaderEvents();
  }

  public create(): void {
    this.scene.start("GameScene");
  }

  // ── Asset queuing ───────────────────────────────────────────────

  private queueAssets(): void {
    for (const sprite of SPRITE_ASSETS) {
      this.queueSprite(sprite);
    }
    for (const audio of AUDIO_ASSETS) {
      this.queueAudio(audio);
    }
  }

  private queueSprite(asset: SpriteAsset): void {
    if (asset.kind === "image") {
      this.load.image(asset.key, asset.path);
      return;
    }

    this.load.spritesheet(asset.key, asset.path, {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      margin: asset.margin ?? 0,
      spacing: asset.spacing ?? 0,
    });
  }

  private queueAudio(asset: AudioAsset): void {
    this.load.audio(asset.key, asset.paths);
  }

  // ── Loader events ───────────────────────────────────────────────

  private attachLoaderEvents(): void {
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      markAssetPresent(key);
    });

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      markAssetMissing(file.key);
      console.warn(`[assets] missing ${file.key} (${file.src}) – using procedural fallback`);
    });

    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      this.barFill.width = (this.barFrame.width - 4) * progress;
      this.statusText.setText(`LOADING ${Math.round(progress * 100)}%`);
    });

    this.load.on(Phaser.Loader.Events.COMPLETE, () => {
      this.statusText.setText("READY");
    });
  }

  // ── UI ──────────────────────────────────────────────────────────

  private createLoadingUi(): void {
    const w = DEFAULT_CLIENT_WIDTH;
    const h = DEFAULT_CLIENT_HEIGHT;

    this.titleText = this.add
      .text(w / 2, h / 2 - 60, "PUZZLE RUNNERS", {
        color: "#f8fafc",
        fontFamily: PIXEL_FONT,
        fontSize: "24px",
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h / 2 - 28, "co-op puzzle platformer", {
        color: "#64748b",
        fontFamily: PIXEL_FONT,
        fontSize: "9px",
      })
      .setOrigin(0.5);

    const barWidth = 360;
    const barHeight = 14;
    this.barFrame = this.add
      .rectangle(w / 2, h / 2 + 24, barWidth, barHeight, 0x131729)
      .setStrokeStyle(2, 0x38bdf8);

    this.barFill = this.add
      .rectangle(w / 2 - barWidth / 2 + 2, h / 2 + 24, 0, barHeight - 4, 0x38bdf8)
      .setOrigin(0, 0.5);

    this.statusText = this.add
      .text(w / 2, h / 2 + 56, "LOADING 0%", {
        color: "#8aa4a6",
        fontFamily: PIXEL_FONT,
        fontSize: "10px",
      })
      .setOrigin(0.5);
  }
}

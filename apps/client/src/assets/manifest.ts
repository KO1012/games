/**
 * Asset manifest – declares all external sprite/audio files that PreloadScene
 * will attempt to load. Every entry is optional: if a file is missing,
 * the system falls back to procedurally generated textures and synthesized
 * Web Audio sounds. See AssetRegistry for runtime presence tracking.
 */

export const ASSET_BASE = "assets";

export type SpriteAsset =
  | { kind: "image"; key: string; path: string }
  | {
      kind: "spritesheet";
      key: string;
      path: string;
      frameWidth: number;
      frameHeight: number;
      margin?: number;
      spacing?: number;
    };

export interface AudioAsset {
  key: string;
  /** Multiple paths for browser fallback (ogg → mp3). */
  paths: string[];
  category: "music" | "sfx";
  defaultVolume?: number;
  loop?: boolean;
}

/**
 * Sprite assets that will be loaded at startup if available.
 *
 * Players share a single Kenney "Pixel Platformer" character sheet
 * (`tilemap-characters_packed.png`, 9×3 grid of 24×24 frames). Player roles
 * pick different rows at runtime via `PlayerAnimator`.
 */
export const SPRITE_ASSETS: SpriteAsset[] = [
  {
    kind: "spritesheet",
    key: "ext_players",
    path: `${ASSET_BASE}/sprites/players.png`,
    frameWidth: 24,
    frameHeight: 24,
  },
];

/** Audio assets loaded by Phaser. SFX keys mirror SoundManager event names. */
export const AUDIO_ASSETS: AudioAsset[] = [
  {
    key: "music_menu",
    paths: [`${ASSET_BASE}/audio/music/menu_loop.ogg`],
    category: "music",
    defaultVolume: 0.45,
    loop: true,
  },
  {
    key: "music_level",
    paths: [`${ASSET_BASE}/audio/music/level_loop.ogg`],
    category: "music",
    defaultVolume: 0.4,
    loop: true,
  },
  {
    key: "music_victory",
    paths: [`${ASSET_BASE}/audio/music/victory_loop.ogg`],
    category: "music",
    defaultVolume: 0.5,
    loop: true,
  },
  { key: "sfx_jump", paths: [`${ASSET_BASE}/audio/sfx/jump.ogg`], category: "sfx", defaultVolume: 0.5 },
  { key: "sfx_land", paths: [`${ASSET_BASE}/audio/sfx/land.ogg`], category: "sfx", defaultVolume: 0.4 },
  {
    key: "sfx_button_press",
    paths: [`${ASSET_BASE}/audio/sfx/button_press.ogg`],
    category: "sfx",
    defaultVolume: 0.5,
  },
  {
    key: "sfx_button_release",
    paths: [`${ASSET_BASE}/audio/sfx/button_release.ogg`],
    category: "sfx",
    defaultVolume: 0.4,
  },
  {
    key: "sfx_door_open",
    paths: [`${ASSET_BASE}/audio/sfx/door_open.ogg`],
    category: "sfx",
    defaultVolume: 0.5,
  },
  {
    key: "sfx_door_close",
    paths: [`${ASSET_BASE}/audio/sfx/door_close.ogg`],
    category: "sfx",
    defaultVolume: 0.5,
  },
  { key: "sfx_death", paths: [`${ASSET_BASE}/audio/sfx/death.ogg`], category: "sfx", defaultVolume: 0.55 },
  { key: "sfx_respawn", paths: [`${ASSET_BASE}/audio/sfx/respawn.ogg`], category: "sfx", defaultVolume: 0.45 },
  { key: "sfx_interact", paths: [`${ASSET_BASE}/audio/sfx/interact.ogg`], category: "sfx", defaultVolume: 0.4 },
  {
    key: "sfx_level_complete",
    paths: [`${ASSET_BASE}/audio/sfx/level_complete.ogg`],
    category: "sfx",
    defaultVolume: 0.6,
  },
  {
    key: "sfx_game_complete",
    paths: [`${ASSET_BASE}/audio/sfx/game_complete.ogg`],
    category: "sfx",
    defaultVolume: 0.6,
  },
  {
    key: "sfx_laser_hum",
    paths: [`${ASSET_BASE}/audio/sfx/laser_hum.ogg`],
    category: "sfx",
    defaultVolume: 0.25,
  },
];

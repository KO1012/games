/**
 * SFX manager.
 *
 * Each event has two execution paths:
 *   1. If an external OGG was loaded into Phaser cache (asset present),
 *      play it through Phaser's sound system at the user-configured volume.
 *   2. Otherwise synthesize via Web Audio API – preserves the original
 *      retro-style SFX so the game stays audible without external assets.
 *
 * `unlockAudio()` resumes the AudioContext on first user gesture so mobile
 * Safari and Chromium do not block audio.
 */
import type Phaser from "phaser";

import { isAssetPresent } from "../assets/AssetRegistry.js";
import { AUDIO_ASSETS, type AudioAsset } from "../assets/manifest.js";

import { effectiveSfxVolume, getAudioPreferences } from "./preferences.js";

let audioContext: AudioContext | null = null;
let phaserScene: Phaser.Scene | null = null;
const audioByKey = new Map<string, AudioAsset>();
for (const a of AUDIO_ASSETS) audioByKey.set(a.key, a);

function getContext(): AudioContext {
  if (!audioContext) {
    const Ctor: typeof AudioContext =
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new Ctor();
  }
  return audioContext;
}

/** Bind a scene that owns the Phaser sound cache (call once after Preload). */
export function bindSfxScene(scene: Phaser.Scene | null): void {
  phaserScene = scene;
}

/** Resume audio on user gesture. Safe to call repeatedly. */
export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  // Phaser's sound manager also lazily resumes; nothing extra needed here.
}

function currentVolume(scaleFactor: number): number {
  return effectiveSfxVolume() * scaleFactor;
}

function playFromPhaser(key: string, volumeScale: number): boolean {
  if (!phaserScene || !isAssetPresent(key)) return false;
  const asset = audioByKey.get(key);
  if (!asset) return false;
  const volume = currentVolume(asset.defaultVolume ?? 0.6) * volumeScale;
  if (volume <= 0) return true; // muted: pretend success to skip synth fallback
  try {
    phaserScene.sound.play(key, { volume });
    return true;
  } catch {
    return false;
  }
}

// ── Procedural synth helpers ─────────────────────────────────────

function synthTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volumeScale = 1,
): void {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const v = currentVolume(0.15) * volumeScale;
  if (v <= 0) return;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(v, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function synthSweep(
  fromFreq: number,
  toFreq: number,
  duration: number,
  type: OscillatorType,
  volumeScale = 1,
): void {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const v = currentVolume(0.15) * volumeScale;
  if (v <= 0) return;

  osc.type = type;
  osc.frequency.setValueAtTime(fromFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(toFreq, ctx.currentTime + duration);
  gain.gain.setValueAtTime(v, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function synthNoise(duration: number, volumeScale = 1): void {
  const ctx = getContext();
  const v = currentVolume(0.08) * volumeScale;
  if (v <= 0) return;

  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(v, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(2000, ctx.currentTime);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

// ── Public SFX events ────────────────────────────────────────────

export function playJump(): void {
  if (playFromPhaser("sfx_jump", 1)) return;
  synthSweep(280, 560, 0.13, "square", 0.85);
}

export function playLand(): void {
  if (playFromPhaser("sfx_land", 1)) return;
  synthNoise(0.08, 1);
  synthTone(120, 0.06, "square", 0.5);
}

export function playButtonPress(): void {
  if (playFromPhaser("sfx_button_press", 1)) return;
  synthTone(520, 0.08, "square", 0.85);
  setTimeout(() => synthTone(660, 0.06, "square", 0.7), 50);
}

export function playButtonRelease(): void {
  if (playFromPhaser("sfx_button_release", 1)) return;
  synthTone(440, 0.06, "square", 0.45);
}

export function playDoorOpen(): void {
  if (playFromPhaser("sfx_door_open", 1)) return;
  synthSweep(200, 400, 0.22, "square", 0.7);
}

export function playDoorClose(): void {
  if (playFromPhaser("sfx_door_close", 1)) return;
  synthSweep(400, 150, 0.22, "square", 0.7);
}

export function playDeath(): void {
  if (playFromPhaser("sfx_death", 1)) return;
  synthSweep(440, 80, 0.4, "square", 1);
  synthNoise(0.15, 1.1);
}

export function playRespawn(): void {
  if (playFromPhaser("sfx_respawn", 1)) return;
  synthSweep(330, 880, 0.32, "triangle", 0.7);
}

export function playLevelComplete(): void {
  if (playFromPhaser("sfx_level_complete", 1)) return;
  const notes = [523, 659, 784, 1047];
  for (let i = 0; i < notes.length; i++) {
    setTimeout(() => synthTone(notes[i], 0.2, "square", 0.85), i * 120);
  }
}

export function playLevelStart(): void {
  // Always procedural – there is no dedicated start asset slot.
  synthTone(440, 0.12, "square", 0.55);
  setTimeout(() => synthTone(554, 0.12, "square", 0.55), 100);
  setTimeout(() => synthTone(659, 0.15, "square", 0.7), 200);
}

export function playInteract(): void {
  if (playFromPhaser("sfx_interact", 1)) return;
  synthTone(600, 0.06, "square", 0.7);
}

export function playGameComplete(): void {
  if (playFromPhaser("sfx_game_complete", 1)) return;
  const melody = [523, 659, 784, 659, 784, 1047];
  for (let i = 0; i < melody.length; i++) {
    setTimeout(() => synthTone(melody[i], 0.25, "square", 0.92), i * 150);
  }
}

export function playLaserHum(): void {
  if (playFromPhaser("sfx_laser_hum", 1)) return;
  synthTone(80, 0.3, "sawtooth", 0.2);
}

export function getSfxRuntime(): {
  contextState: AudioContextState | null;
  preferences: ReturnType<typeof getAudioPreferences>;
} {
  return {
    contextState: audioContext?.state ?? null,
    preferences: getAudioPreferences(),
  };
}

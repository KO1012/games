/**
 * Volume preferences with localStorage persistence.
 * Independent of Phaser so it can be used during the boot phase before
 * the game scene exists.
 */

const STORAGE_KEY = "coop-game:audio-prefs:v1";

export interface AudioPreferences {
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
}

const DEFAULTS: AudioPreferences = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
};

let cached: AudioPreferences | null = null;
const listeners = new Set<(prefs: AudioPreferences) => void>();

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function read(): AudioPreferences {
  if (cached) return cached;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
      cached = {
        musicVolume: clamp01(parsed.musicVolume ?? DEFAULTS.musicVolume),
        sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULTS.sfxVolume),
        muted: Boolean(parsed.muted),
      };
      return cached;
    }
  } catch {
    // localStorage unavailable; fall through to defaults
  }

  cached = { ...DEFAULTS };
  return cached;
}

function write(prefs: AudioPreferences): void {
  cached = prefs;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable; keep cached value in memory only
  }
  for (const listener of listeners) listener(prefs);
}

export function getAudioPreferences(): AudioPreferences {
  return { ...read() };
}

export function setMusicVolume(value: number): void {
  write({ ...read(), musicVolume: clamp01(value) });
}

export function setSfxVolume(value: number): void {
  write({ ...read(), sfxVolume: clamp01(value) });
}

export function setMuted(muted: boolean): void {
  write({ ...read(), muted });
}

export function toggleMuted(): boolean {
  const next = !read().muted;
  write({ ...read(), muted: next });
  return next;
}

/** Subscribes to changes; returns unsubscribe function. */
export function onAudioPreferencesChange(
  listener: (prefs: AudioPreferences) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Effective volume given mute. */
export function effectiveMusicVolume(prefs: AudioPreferences = read()): number {
  return prefs.muted ? 0 : prefs.musicVolume;
}

export function effectiveSfxVolume(prefs: AudioPreferences = read()): number {
  return prefs.muted ? 0 : prefs.sfxVolume;
}

/** Test helper. */
export function __resetAudioPreferences(): void {
  cached = null;
  listeners.clear();
}

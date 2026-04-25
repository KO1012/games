/**
 * Music manager.
 *
 * Provides scene-based background music with a graceful fallback: when an
 * external OGG track was loaded by PreloadScene we play it through Phaser's
 * sound system at the user-configured volume. Otherwise a small procedural
 * chiptune sequencer renders an ambient loop using Web Audio API so menus
 * and gameplay still feel alive without any binary assets.
 */
import type Phaser from "phaser";

import { isAssetPresent } from "../assets/AssetRegistry.js";

import {
  effectiveMusicVolume,
  getAudioPreferences,
  onAudioPreferencesChange,
} from "./preferences.js";

export type MusicTrack = "menu" | "level" | "victory" | null;

const PHASER_KEY: Record<Exclude<MusicTrack, null>, string> = {
  menu: "music_menu",
  level: "music_level",
  victory: "music_victory",
};

// ── Procedural sequencer ────────────────────────────────────────

type StepNote = { note: number | null; duration: number };

interface ProceduralPattern {
  bpm: number;
  bass: StepNote[];
  lead: StepNote[];
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  bassGain: number;
  leadGain: number;
}

/** Notes are MIDI numbers, null = rest. */
const PATTERNS: Record<Exclude<MusicTrack, null>, ProceduralPattern> = {
  menu: {
    bpm: 88,
    bass: [
      { note: 45, duration: 4 },
      { note: 50, duration: 4 },
      { note: 48, duration: 4 },
      { note: 43, duration: 4 },
    ],
    lead: [
      { note: 69, duration: 1 },
      { note: 72, duration: 1 },
      { note: 76, duration: 1 },
      { note: null, duration: 1 },
      { note: 74, duration: 1 },
      { note: 72, duration: 1 },
      { note: 69, duration: 1 },
      { note: null, duration: 1 },
      { note: 67, duration: 1 },
      { note: 72, duration: 1 },
      { note: 76, duration: 1 },
      { note: null, duration: 1 },
      { note: 74, duration: 2 },
      { note: 72, duration: 2 },
    ],
    bassWave: "triangle",
    leadWave: "square",
    bassGain: 0.18,
    leadGain: 0.08,
  },
  level: {
    bpm: 120,
    bass: [
      { note: 36, duration: 2 },
      { note: 36, duration: 2 },
      { note: 41, duration: 2 },
      { note: 41, duration: 2 },
      { note: 43, duration: 2 },
      { note: 43, duration: 2 },
      { note: 38, duration: 2 },
      { note: 38, duration: 2 },
    ],
    lead: [
      { note: 72, duration: 1 },
      { note: 76, duration: 1 },
      { note: 79, duration: 1 },
      { note: 76, duration: 1 },
      { note: null, duration: 1 },
      { note: 74, duration: 1 },
      { note: 72, duration: 1 },
      { note: 69, duration: 1 },
      { note: 67, duration: 1 },
      { note: 72, duration: 1 },
      { note: 76, duration: 1 },
      { note: 79, duration: 1 },
      { note: null, duration: 1 },
      { note: 76, duration: 1 },
      { note: 74, duration: 1 },
      { note: 72, duration: 1 },
    ],
    bassWave: "sawtooth",
    leadWave: "square",
    bassGain: 0.14,
    leadGain: 0.07,
  },
  victory: {
    bpm: 110,
    bass: [
      { note: 48, duration: 2 },
      { note: 52, duration: 2 },
      { note: 55, duration: 2 },
      { note: 60, duration: 2 },
    ],
    lead: [
      { note: 72, duration: 1 },
      { note: 76, duration: 1 },
      { note: 79, duration: 1 },
      { note: 84, duration: 1 },
      { note: 79, duration: 1 },
      { note: 76, duration: 1 },
      { note: 72, duration: 2 },
    ],
    bassWave: "triangle",
    leadWave: "square",
    bassGain: 0.2,
    leadGain: 0.1,
  },
};

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

class ProceduralMusic {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private active = false;
  private timerId: number | null = null;
  private nextBassTime = 0;
  private nextLeadTime = 0;
  private bassIndex = 0;
  private leadIndex = 0;
  private currentPattern: ProceduralPattern | null = null;

  public start(track: Exclude<MusicTrack, null>): void {
    this.stop();

    const Ctor: typeof AudioContext =
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(effectiveMusicVolume(), this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.currentPattern = PATTERNS[track];
    this.bassIndex = 0;
    this.leadIndex = 0;
    this.nextBassTime = this.ctx.currentTime + 0.05;
    this.nextLeadTime = this.ctx.currentTime + 0.05;
    this.active = true;

    // Schedule slightly ahead with a periodic timer; cheap and reliable.
    this.timerId = window.setInterval(() => this.scheduleAhead(), 80);
  }

  public stop(): void {
    this.active = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    try {
      this.masterGain?.disconnect();
    } catch {
      // disconnect may throw if already disconnected; ignore
    }
    this.masterGain = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
  }

  public setVolume(volume: number): void {
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
    }
  }

  private scheduleAhead(): void {
    if (!this.active || !this.ctx || !this.masterGain || !this.currentPattern) return;
    const horizon = this.ctx.currentTime + 0.4;
    const beatLength = 60 / this.currentPattern.bpm / 2; // step = 1/8 note

    while (this.nextBassTime < horizon) {
      const step = this.currentPattern.bass[this.bassIndex];
      this.scheduleNote(step, beatLength, this.nextBassTime, this.currentPattern.bassWave, this.currentPattern.bassGain);
      this.nextBassTime += step.duration * beatLength;
      this.bassIndex = (this.bassIndex + 1) % this.currentPattern.bass.length;
    }

    while (this.nextLeadTime < horizon) {
      const step = this.currentPattern.lead[this.leadIndex];
      this.scheduleNote(step, beatLength, this.nextLeadTime, this.currentPattern.leadWave, this.currentPattern.leadGain);
      this.nextLeadTime += step.duration * beatLength;
      this.leadIndex = (this.leadIndex + 1) % this.currentPattern.lead.length;
    }
  }

  private scheduleNote(
    step: StepNote,
    beatLength: number,
    when: number,
    wave: OscillatorType,
    gainScale: number,
  ): void {
    if (!this.ctx || !this.masterGain || step.note === null) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dur = step.duration * beatLength * 0.95;

    osc.type = wave;
    osc.frequency.setValueAtTime(midiToFreq(step.note), when);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(gainScale, when + 0.01);
    gain.gain.linearRampToValueAtTime(gainScale * 0.7, when + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }
}

// ── Public manager ──────────────────────────────────────────────

export class MusicManager {
  private scene: Phaser.Scene | null = null;
  private currentTrack: MusicTrack = null;
  private phaserSound: Phaser.Sound.BaseSound | null = null;
  private procedural = new ProceduralMusic();
  private prefsUnsubscribe: (() => void) | null = null;

  public bind(scene: Phaser.Scene): void {
    this.scene = scene;
    if (!this.prefsUnsubscribe) {
      this.prefsUnsubscribe = onAudioPreferencesChange((prefs) => {
        this.applyVolume(prefs.muted ? 0 : prefs.musicVolume);
      });
    }
  }

  public play(track: MusicTrack): void {
    if (track === this.currentTrack) return;
    this.stop();
    this.currentTrack = track;
    if (track === null) return;

    const phaserKey = PHASER_KEY[track];
    const volume = effectiveMusicVolume();

    if (this.scene && isAssetPresent(phaserKey) && volume > 0) {
      try {
        this.phaserSound = this.scene.sound.add(phaserKey, { loop: true, volume });
        this.phaserSound.play();
        return;
      } catch {
        // fall through to procedural
      }
    }

    if (volume > 0) {
      this.procedural.start(track);
    }
  }

  public stop(): void {
    this.currentTrack = null;
    if (this.phaserSound) {
      try {
        this.phaserSound.stop();
        this.phaserSound.destroy();
      } catch {
        // ignore destroy errors during teardown
      }
      this.phaserSound = null;
    }
    this.procedural.stop();
  }

  public destroy(): void {
    this.stop();
    if (this.prefsUnsubscribe) {
      this.prefsUnsubscribe();
      this.prefsUnsubscribe = null;
    }
  }

  private applyVolume(volume: number): void {
    const prefs = getAudioPreferences();
    const v = prefs.muted ? 0 : volume;
    if (this.phaserSound && "setVolume" in this.phaserSound) {
      try {
        (this.phaserSound as Phaser.Sound.BaseSound & { setVolume(v: number): void }).setVolume(v);
      } catch {
        // ignore set-volume errors on unsupported sound types
      }
    }
    this.procedural.setVolume(v);

    // If track is selected but volume rose from 0, we may need to start procedural.
    if (this.currentTrack && v > 0 && !this.phaserSound) {
      // Restart procedural to ensure audio context exists.
      this.procedural.stop();
      this.procedural.start(this.currentTrack);
    }
  }
}

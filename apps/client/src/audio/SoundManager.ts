/**
 * Retro synthesized sound effects using Web Audio API.
 * No external audio files required – all sounds are generated procedurally.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

/** Must be called from a user gesture to unlock audio on mobile/Chrome. */
export function unlockAudio(): void {
  const ac = getContext();
  if (ac.state === "suspended") {
    void ac.resume();
  }
}

// ── Utility ──────────────────────────────────────────────────────

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.15,
  rampDown = true,
): void {
  const ac = getContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ac.currentTime);
  gain.gain.setValueAtTime(volume, ac.currentTime);

  if (rampDown) {
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  }

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
}

function playNoise(duration: number, volume = 0.06): void {
  const ac = getContext();
  const bufferSize = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ac.createBufferSource();
  source.buffer = buffer;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);

  const filter = ac.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(2000, ac.currentTime);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  source.start();
}

// ── Sound Effects ────────────────────────────────────────────────

export function playJump(): void {
  const ac = getContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(280, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(560, ac.currentTime + 0.1);
  gain.gain.setValueAtTime(0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.15);
}

export function playLand(): void {
  playNoise(0.08, 0.08);
  playTone(120, 0.06, "square", 0.06);
}

export function playButtonPress(): void {
  playTone(520, 0.08, "square", 0.12);
  setTimeout(() => playTone(660, 0.06, "square", 0.1), 50);
}

export function playButtonRelease(): void {
  playTone(440, 0.06, "square", 0.06);
}

export function playDoorOpen(): void {
  const ac = getContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(200, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(400, ac.currentTime + 0.2);
  gain.gain.setValueAtTime(0.1, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.25);
}

export function playDoorClose(): void {
  const ac = getContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(400, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(150, ac.currentTime + 0.2);
  gain.gain.setValueAtTime(0.1, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.25);
}

export function playDeath(): void {
  const ac = getContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(440, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.4);
  gain.gain.setValueAtTime(0.15, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.4);

  playNoise(0.15, 0.1);
}

export function playRespawn(): void {
  const ac = getContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(330, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.3);
  gain.gain.setValueAtTime(0.1, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.35);
}

export function playLevelComplete(): void {
  const notes = [523, 659, 784, 1047];
  for (let i = 0; i < notes.length; i++) {
    setTimeout(() => playTone(notes[i], 0.2, "square", 0.12), i * 120);
  }
}

export function playLevelStart(): void {
  playTone(440, 0.12, "square", 0.08);
  setTimeout(() => playTone(554, 0.12, "square", 0.08), 100);
  setTimeout(() => playTone(659, 0.15, "square", 0.1), 200);
}

export function playInteract(): void {
  playTone(600, 0.06, "square", 0.1);
}

export function playGameComplete(): void {
  const melody = [523, 659, 784, 659, 784, 1047];
  for (let i = 0; i < melody.length; i++) {
    setTimeout(() => playTone(melody[i], 0.25, "square", 0.13), i * 150);
  }
}

export function playLaserHum(): void {
  playTone(80, 0.3, "sawtooth", 0.03, true);
}

"use client";

import { getTone, getVolume } from "./prefs";

/**
 * Notification tones, synthesized with the Web Audio API rather than shipped
 * as recordings: a bell is a few inharmonic partials decaying at different
 * rates, a xylophone bar a bright fundamental with a fourth-harmonic overtone
 * that dies fast, and so on. The same code renders a tone to a WAV file so
 * it can be saved to the phone and chosen as MW Chat's notification sound.
 */

type Ctx = BaseAudioContext;

/** [frequency ratio, level, decay as a share of the note's decay] */
type Partial = [number, number, number];

interface NoteOptions {
  partials?: Partial[];
  type?: OscillatorType;
  attack?: number;
  decay?: number;
  level?: number;
  detune?: number;
}

function note(ctx: Ctx, out: AudioNode, t: number, freq: number, o: NoteOptions = {}) {
  const { partials = [[1, 1, 1]], type = "sine", attack = 0.004, decay = 1, level = 0.35, detune = 0 } = o;
  for (const [ratio, gain, share] of partials) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * ratio, t);
    if (detune) osc.detune.setValueAtTime(detune, t);
    const g = ctx.createGain();
    const peak = Math.max(0.0002, level * gain);
    const end = t + attack + decay * share;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(end + 0.05);
  }
}

const BELL: Partial[] = [
  [0.5, 0.35, 1.3],
  [1, 0.7, 1],
  [1.19, 0.3, 0.7],
  [1.5, 0.22, 0.6],
  [2, 0.35, 0.5],
  [2.74, 0.14, 0.35],
  [4.07, 0.07, 0.22],
];
const CHIME: Partial[] = [
  [1, 0.7, 1],
  [2.76, 0.2, 0.45],
  [5.4, 0.07, 0.2],
];
const XYLO: Partial[] = [
  [1, 0.8, 1],
  [3.93, 0.22, 0.3],
  [9.5, 0.05, 0.1],
];
const MARIMBA: Partial[] = [
  [1, 0.85, 1],
  [4, 0.14, 0.35],
  [10, 0.03, 0.1],
];
const KALIMBA: Partial[] = [
  [1, 0.8, 1],
  [5.9, 0.08, 0.15],
];

export interface Tone {
  id: string;
  name: string;
  /** Seconds of sound, for rendering to a file. */
  length: number;
  play: (ctx: Ctx, out: AudioNode, t: number) => void;
  /** A recording to play instead (the spoken alert), from public/sounds. */
  sample?: string;
}

/** A burst of noise through a band-pass filter: breath, the rasp in a bark. */
function noise(ctx: Ctx, out: AudioNode, t: number, dur: number, freq: number, q: number, level: number) {
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/** One "woof": a rough voice falling in pitch, shaped by a mouth-like filter, with breath. */
function bark(ctx: Ctx, out: AudioNode, t: number, pitch: number) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(430 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(270 * pitch, t + 0.05);
  osc.frequency.exponentialRampToValueAtTime(170 * pitch, t + 0.17);
  const mouth = ctx.createBiquadFilter();
  mouth.type = "bandpass";
  mouth.frequency.value = 780;
  mouth.Q.value = 2.2;
  const soft = ctx.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = 2400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.0, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(mouth).connect(soft).connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.24);
  noise(ctx, out, t, 0.13, 1500, 1.1, 0.35);
}

export const TONES: Tone[] = [
  {
    id: "bell",
    name: "Bell",
    length: 2.6,
    play: (c, o, t) => note(c, o, t, 659.25, { partials: BELL, decay: 2.3, level: 0.32 }),
  },
  {
    id: "chime",
    name: "Chime",
    length: 2,
    play: (c, o, t) => {
      note(c, o, t, 783.99, { partials: CHIME, decay: 1.6 });
      note(c, o, t + 0.18, 1318.5, { partials: CHIME, decay: 1.5, level: 0.3 });
    },
  },
  {
    id: "xylophone",
    name: "Xylophone",
    length: 0.9,
    play: (c, o, t) =>
      [1046.5, 1318.5, 1568].forEach((f, i) =>
        note(c, o, t + i * 0.09, f, { partials: XYLO, attack: 0.002, decay: 0.45, level: 0.32 }),
      ),
  },
  {
    id: "marimba",
    name: "Marimba",
    length: 1.3,
    play: (c, o, t) => {
      note(c, o, t, 392, { partials: MARIMBA, attack: 0.003, decay: 0.9, level: 0.45 });
      note(c, o, t + 0.14, 587.33, { partials: MARIMBA, attack: 0.003, decay: 0.85, level: 0.42 });
    },
  },
  {
    id: "glass",
    name: "Glass",
    length: 2.6,
    play: (c, o, t) => {
      note(c, o, t, 1568, { partials: [[1, 0.6, 1], [2, 0.08, 0.5]], attack: 0.006, decay: 2.3, level: 0.5 });
      // A second voice a few cents off makes the slow shimmer of struck glass.
      note(c, o, t, 1568, { attack: 0.006, decay: 2.3, level: 0.3, detune: 7 });
    },
  },
  {
    id: "harp",
    name: "Harp",
    length: 1.4,
    play: (c, o, t) =>
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        note(c, o, t + i * 0.07, f, { type: "triangle", partials: [[1, 0.7, 1], [2, 0.15, 0.6]], attack: 0.003, decay: 0.9, level: 0.3 }),
      ),
  },
  {
    id: "dingdong",
    name: "Ding-dong",
    length: 2,
    play: (c, o, t) => {
      note(c, o, t, 659.25, { partials: BELL.slice(1, 5), decay: 1.3, level: 0.3 });
      note(c, o, t + 0.36, 523.25, { partials: BELL.slice(1, 5), decay: 1.4, level: 0.3 });
    },
  },
  {
    id: "triad",
    name: "Triad",
    length: 1.2,
    play: (c, o, t) =>
      [1046.5, 1318.5, 1568].forEach((f, i) =>
        note(c, o, t + i * 0.12, f, { attack: 0.01, decay: 0.7, level: 0.24 }),
      ),
  },
  {
    id: "kalimba",
    name: "Kalimba",
    length: 1.1,
    play: (c, o, t) => {
      note(c, o, t, 880, { partials: KALIMBA, attack: 0.002, decay: 0.7, level: 0.38 });
      note(c, o, t + 0.16, 1318.5, { partials: KALIMBA, attack: 0.002, decay: 0.75, level: 0.34 });
    },
  },
  {
    id: "crystal",
    name: "Crystal",
    length: 0.9,
    play: (c, o, t) =>
      [1318.5, 1975.5, 2637].forEach((f, i) =>
        note(c, o, t + i * 0.06, f, { partials: [[1, 0.7, 1], [2.01, 0.1, 0.4]], attack: 0.002, decay: 0.5, level: 0.4 }),
      ),
  },
  {
    id: "pop",
    name: "Soft pop",
    length: 0.4,
    play: (c, o, t) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(1300, t + 0.05);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.95, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g).connect(o);
      osc.start(t);
      osc.stop(t + 0.25);
    },
  },
  {
    id: "carlock",
    name: "Car lock",
    length: 0.5,
    // Two quick rising chirps, like a key fob locking a car.
    play: (c, o, t) =>
      [0, 0.17].forEach((dt) => {
        const osc = c.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(2300, t + dt);
        osc.frequency.linearRampToValueAtTime(3100, t + dt + 0.07);
        const f = c.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 5000;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.4, t + dt + 0.004);
        g.gain.setValueAtTime(0.4, t + dt + 0.07);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.095);
        osc.connect(f).connect(g).connect(o);
        osc.start(t + dt);
        osc.stop(t + dt + 0.11);
      }),
  },
  {
    id: "siren",
    name: "Fire engine",
    length: 2.5,
    // A siren's wail: up, a moment at the top, then down.
    play: (c, o, t) => {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.18);
      g.gain.setValueAtTime(0.3, t + 1.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.35);
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 2600;
      f.connect(g).connect(o);
      (["sawtooth", "sine"] as const).forEach((type, i) => {
        const osc = c.createOscillator();
        osc.type = type;
        const fr = osc.frequency;
        fr.setValueAtTime(520, t);
        fr.exponentialRampToValueAtTime(1350, t + 0.95);
        fr.setValueAtTime(1350, t + 1.25);
        fr.exponentialRampToValueAtTime(560, t + 2.3);
        const level = c.createGain();
        level.gain.value = i === 0 ? 0.55 : 0.9;
        osc.connect(level).connect(f);
        osc.start(t);
        osc.stop(t + 2.4);
      });
    },
  },
  {
    id: "bark",
    name: "Bark",
    length: 0.8,
    play: (c, o, t) => {
      bark(c, o, t, 1);
      bark(c, o, t + 0.3, 0.93);
    },
  },
  {
    id: "heymichael",
    name: "Hey Michael!",
    length: 1.1,
    sample: "/sounds/hey-michael.wav",
    play: () => {},
  },
];

export const SILENT = "none";

export function findTone(id: string): Tone | undefined {
  return TONES.find((t) => t.id === id);
}

/** Volume, then a gentle compressor so stacked partials never clip. */
function master(ctx: Ctx, volume: number): AudioNode {
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.ratio.value = 4;
  gain.connect(comp).connect(ctx.destination);
  return gain;
}

let live: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  live ??= new AudioContext();
  return live;
}

/**
 * Browsers only let a page make sound after the person has touched it.
 * Called on the first tap or key press so later tones can play.
 */
export function unlockAudio() {
  const ctx = context();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

const samples = new Map<string, Promise<AudioBuffer>>();

/** A recording, fetched and decoded once. */
function sample(ctx: BaseAudioContext, src: string): Promise<AudioBuffer> {
  if (!samples.has(src)) {
    samples.set(
      src,
      fetch(src)
        .then((r) => r.arrayBuffer())
        .then((b) => ctx.decodeAudioData(b))
        .catch((e) => {
          samples.delete(src);
          throw e;
        }),
    );
  }
  return samples.get(src)!;
}

function playSample(ctx: BaseAudioContext, out: AudioNode, t: number, buffer: AudioBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(out);
  src.start(t);
}

export function playTone(id: string, volume: number) {
  const tone = findTone(id);
  const ctx = context();
  if (!tone || !ctx || volume <= 0) return;
  const start = tone.sample
    ? () => {
        sample(ctx, tone.sample!)
          .then((b) => playSample(ctx, master(ctx, volume), ctx.currentTime + 0.02, b))
          .catch(() => {});
      }
    : () => tone.play(ctx, master(ctx, volume), ctx.currentTime + 0.02);
  if (ctx.state === "suspended") ctx.resume().then(start).catch(() => {});
  else start();
}

/** Renders a tone to a 16-bit mono WAV file. */
export async function toneFile(id: string, volume = 0.9): Promise<Blob | null> {
  const tone = findTone(id);
  if (tone?.sample) {
    // Already a sound file: hand it over as it is.
    const res = await fetch(tone.sample).catch(() => null);
    return res?.ok ? res.blob() : null;
  }
  if (!tone || typeof OfflineAudioContext === "undefined") return null;
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(rate * (tone.length + 0.3)), rate);
  tone.play(ctx, master(ctx, volume), 0.02);
  const buffer = await ctx.startRendering();
  return wav(buffer);
}

function wav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(bytes);
  const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}

/** The chosen tone for an incoming chat or message, if the app is on screen. */
export function chime() {
  if (typeof document === "undefined" || document.visibilityState !== "visible") return;
  const id = getTone();
  if (id !== SILENT) playTone(id, getVolume());
}

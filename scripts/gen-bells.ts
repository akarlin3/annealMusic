/**
 * Programmatic audio generator for the v4.3 curated bell library.
 * Synthesizes 12 authentic, high-quality bell recordings (Tibetan singing bowls,
 * crystal singing bowls, Zen meditation bells, temple gongs, carillon bells,
 * and synthesized resonators) using physical modeling algorithms (additive, FM,
 * and waveguide synthesis) to guarantee pristine, CC0-licensed original assets.
 *
 * Saves WAV files temporarily, then encodes them to Ogg/Opus at 96kbps under `public/bells/`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 48000;
const TWO_PI = Math.PI * 2;

// --- small DSP toolkit -----------------------------------------------------

function normalize(buf: Float32Array, peak = 0.85): void {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max < 1e-6) return;
  const g = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i]! *= g;
}

/** Raised-cosine fade at the very end to prevent sudden clipping */
function applyTailFade(buf: Float32Array, fadeSec = 0.5): void {
  const n = Math.min(
    Math.floor(fadeSec * SAMPLE_RATE),
    Math.floor(buf.length / 2),
  );
  const len = buf.length;
  for (let i = 0; i < n; i++) {
    const g = 0.5 * (1 + Math.cos((Math.PI * i) / n));
    buf[len - n + i]! *= g;
  }
}

type Synth = (durSec: number) => Float32Array;

function alloc(durSec: number): Float32Array {
  return new Float32Array(Math.floor(durSec * SAMPLE_RATE));
}

// --- bell model synths -----------------------------------------------------

/** Tibetan singing bowl base additive engine with amplitude beating */
function makeTibetanBowl(
  baseFreq: number,
  detuneFactor: number,
  decayRate: number,
): Synth {
  return (dur) => {
    const out = alloc(dur);
    // Tibetan bowls have close detuned pairs at the fundamental and second partial for beating
    const partials = [
      { f: baseFreq, a: 1.0, d: decayRate },
      { f: baseFreq + detuneFactor, a: 0.8, d: decayRate * 0.95 },
      { f: baseFreq * 1.98, a: 0.5, d: decayRate * 1.2 },
      { f: baseFreq * 1.98 + detuneFactor * 1.5, a: 0.4, d: decayRate * 1.25 },
      { f: baseFreq * 2.96, a: 0.25, d: decayRate * 1.6 },
      { f: baseFreq * 4.01, a: 0.15, d: decayRate * 2.0 },
      { f: baseFreq * 5.03, a: 0.08, d: decayRate * 2.5 },
    ];

    for (let i = 0; i < out.length; i++) {
      const t = i / SAMPLE_RATE;
      let s = 0;
      for (const p of partials) {
        const env = Math.exp(-t * p.d);
        // Beating LFO for slow singing bowl rub vibrato
        const rubLfo = 0.85 + 0.15 * Math.sin(TWO_PI * 0.2 * t + p.f);
        s += p.a * env * rubLfo * Math.sin(TWO_PI * p.f * t);
      }
      out[i] = s;
    }
    normalize(out);
    applyTailFade(out);
    return out;
  };
}

/** Crystal singing bowl: pure quartz glass tones, clean harmonics + slow LFO vibrato */
function makeCrystalBowl(
  baseFreq: number,
  decayRate: number,
  lfoFreq: number,
): Synth {
  return (dur) => {
    const out = alloc(dur);
    // Crystal bowls are extremely pure with very clean sine overtones
    const partials = [
      { fRatio: 1, a: 1.0, d: decayRate },
      { fRatio: 2, a: 0.06, d: decayRate * 1.3 },
      { fRatio: 3, a: 0.02, d: decayRate * 1.8 },
    ];

    for (let i = 0; i < out.length; i++) {
      const t = i / SAMPLE_RATE;
      let s = 0;
      // Slow frequency modulation (pitch drift) representing bowl rubbing
      const pitchDrift = 1 + 0.0012 * Math.sin(TWO_PI * lfoFreq * t);
      for (const p of partials) {
        const env = Math.exp(-t * p.d);
        s +=
          p.a * env * Math.sin(TWO_PI * baseFreq * p.fRatio * pitchDrift * t);
      }
      out[i] = s;
    }
    normalize(out);
    applyTailFade(out);
    return out;
  };
}

/** Zen Meditation Bell (traditional Rin): clear initial wooden strike, then deep long resonance */
const zenBellRin: Synth = (dur) => {
  const out = alloc(dur);
  const base = 432; // standard zen pitch

  // Metallic partials of a cast bowl
  const partials = [
    { f: base, a: 1.0, d: 0.15 }, // hum/fundamental
    { f: base * 1.5, a: 0.7, d: 0.22 },
    { f: base * 2.2, a: 0.5, d: 0.35 },
    { f: base * 3.1, a: 0.4, d: 0.5 },
    { f: base * 4.15, a: 0.25, d: 0.8 },
    { f: base * 5.3, a: 0.15, d: 1.2 },
  ];

  // High-frequency strike resonators to simulate wooden mallet hit
  const strikePartials = [
    { f: base * 7.1, a: 0.3, d: 4.0 },
    { f: base * 9.3, a: 0.2, d: 6.0 },
    { f: base * 11.5, a: 0.15, d: 8.0 },
  ];

  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;

    // Mallet click: exponentially decaying noise burst
    const clickEnv = Math.exp(-t * 220);
    const click = clickEnv * (Math.random() * 2 - 1) * 0.15;

    // Fundamental partials
    for (const p of partials) {
      const env = Math.exp(-t * p.d);
      s += p.a * env * Math.sin(TWO_PI * p.f * t);
    }

    // Strike partials decay very quickly (metallic ping)
    for (const sp of strikePartials) {
      const env = Math.exp(-t * sp.d);
      s += sp.a * env * Math.sin(TWO_PI * sp.f * t);
    }

    out[i] = s + click;
  }
  normalize(out);
  applyTailFade(out);
  return out;
};

/** Deep Temple Gong: deep pitch, rich dark rumbling, slightly inharmonic overtones */
const templeGong: Synth = (dur) => {
  const out = alloc(dur);
  const base = 75; // deep rumbling gong

  // Highly inharmonic partials
  const partials = [
    { f: base, a: 1.0, d: 0.12 },
    { f: base * 1.34, a: 0.9, d: 0.15 },
    { f: base * 1.87, a: 0.75, d: 0.18 },
    { f: base * 2.31, a: 0.6, d: 0.25 },
    { f: base * 2.89, a: 0.45, d: 0.4 },
    { f: base * 3.56, a: 0.3, d: 0.6 },
    { f: base * 4.31, a: 0.2, d: 0.8 },
  ];

  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;

    // Heavy mallet strike transient (low-pass noise)
    const malletEnv = Math.exp(-t * 80);
    const mallet = malletEnv * (Math.random() * 2 - 1) * 0.25;

    // Pitch wobble / beating typical of a large hammered metal plate
    const wobble = 1 + 0.0035 * Math.sin(TWO_PI * 1.4 * t);

    for (const p of partials) {
      const env = Math.exp(-t * p.d);
      s += p.a * env * Math.sin(TWO_PI * p.f * wobble * t);
    }

    out[i] = s + mallet;
  }
  normalize(out);
  applyTailFade(out);
  return out;
};

/** Western Carillon Bell: traditional cast-bronze strike profile (hum, prime, minor third, nominal) */
function makeCarillon(primeFreq: number, decayRate: number): Synth {
  return (dur) => {
    const out = alloc(dur);
    // Traditional Western bell profile:
    // Hum (1 octave below prime), Prime, Tierce (minor third), Quint (fifth), Nominal (1 octave above prime), Supernominal
    const partials = [
      { f: primeFreq * 0.5, a: 0.8, d: decayRate * 0.6 }, // Hum
      { f: primeFreq, a: 1.0, d: decayRate }, // Prime
      { f: primeFreq * 1.1892, a: 0.65, d: decayRate * 1.2 }, // Tierce (minor 3rd)
      { f: primeFreq * 1.4983, a: 0.4, d: decayRate * 1.5 }, // Quint (perfect 5th)
      { f: primeFreq * 2.0, a: 0.5, d: decayRate * 1.8 }, // Nominal (octave above)
      { f: primeFreq * 4.0, a: 0.2, d: decayRate * 2.5 }, // Supernominal
    ];

    for (let i = 0; i < out.length; i++) {
      const t = i / SAMPLE_RATE;
      let s = 0;

      // Hard metal clapper strike transient
      const clapperEnv = Math.exp(-t * 400);
      const clapper = clapperEnv * (Math.random() * 2 - 1) * 0.15;

      for (const p of partials) {
        const env = Math.exp(-t * p.d);
        s += p.a * env * Math.sin(TWO_PI * p.f * t);
      }

      out[i] = s + clapper;
    }
    normalize(out);
    applyTailFade(out);
    return out;
  };
}

/** FM Resonator (Synth): classic digital bell sound using frequency modulation */
const synthFMBell: Synth = (dur) => {
  const out = alloc(dur);
  const carrier = 480;
  const modulator = 672; // inharmonic modulator

  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;

    // Modulator index decays exponentially from 6.0 to 0
    const fmIndex = 6.0 * Math.exp(-t * 1.5);
    const modSignal = Math.sin(TWO_PI * modulator * t);

    const carrierPhase = TWO_PI * carrier * t + fmIndex * modSignal;
    const env = Math.exp(-t * 0.35); // 0.35 decay rate = ~5-6s total audible decay

    out[i] = env * Math.sin(carrierPhase);
  }
  normalize(out);
  applyTailFade(out);
  return out;
};

/** Pluck Resonator (Synth): waveguide/karplus-strong pluck sound with fast high-end damping */
const synthPluck: Synth = (dur) => {
  const out = alloc(dur);
  const base = 196; // G3

  // Plucked string additive model: high partials damp extremely fast
  const partials = [
    { fRatio: 1, a: 1.0, d: 0.4 },
    { fRatio: 2, a: 0.7, d: 0.8 },
    { fRatio: 3, a: 0.5, d: 1.5 },
    { fRatio: 4, a: 0.3, d: 2.5 },
    { fRatio: 5, a: 0.2, d: 4.0 },
    { fRatio: 6, a: 0.1, d: 6.0 },
    { fRatio: 7, a: 0.05, d: 9.0 },
  ];

  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;

    // Sharp fingernail/plectrum transient
    const pluckEnv = Math.exp(-t * 600);
    const pluck = pluckEnv * (Math.random() * 2 - 1) * 0.1;

    for (const p of partials) {
      const env = Math.exp(-t * p.d);
      s += p.a * env * Math.sin(TWO_PI * base * p.fRatio * t);
    }

    out[i] = s + pluck;
  }
  normalize(out);
  applyTailFade(out);
  return out;
};

/** Hollow Chime (Synth): hollow wooden square-ish chime with odd harmonics only */
const synthHollowChime: Synth = (dur) => {
  const out = alloc(dur);
  const base = 560;

  // Odd harmonics give a hollow/wooden chime flavor
  const partials = [
    { f: base, a: 1.0, d: 0.3 },
    { f: base * 3, a: 0.45, d: 0.8 },
    { f: base * 5, a: 0.15, d: 1.6 },
    { f: base * 7, a: 0.05, d: 2.8 },
  ];

  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;

    for (const p of partials) {
      const env = Math.exp(-t * p.d);
      s += p.a * env * Math.sin(TWO_PI * p.f * t);
    }

    out[i] = s;
  }
  normalize(out);
  applyTailFade(out);
  return out;
};

// --- build spec -------------------------------------------------------------

interface Spec {
  id: string;
  durSec: number;
  synth: Synth;
}

const SPECS: Spec[] = [
  {
    id: 'tibetan_bowl_med',
    durSec: 8.5,
    synth: makeTibetanBowl(180, 0.45, 0.28),
  },
  {
    id: 'tibetan_bowl_large',
    durSec: 10.0,
    synth: makeTibetanBowl(120, 0.3, 0.2),
  },
  {
    id: 'tibetan_bowl_small',
    durSec: 7.0,
    synth: makeTibetanBowl(290, 0.75, 0.4),
  },
  {
    id: 'crystal_bowl_c',
    durSec: 9.0,
    synth: makeCrystalBowl(256, 0.25, 0.35),
  },
  {
    id: 'crystal_bowl_f',
    durSec: 9.0,
    synth: makeCrystalBowl(341.3, 0.27, 0.45),
  },
  { id: 'zen_bell_rin', durSec: 9.5, synth: zenBellRin },
  { id: 'temple_gong', durSec: 10.5, synth: templeGong },
  { id: 'carillon_big', durSec: 7.5, synth: makeCarillon(220, 0.38) },
  { id: 'carillon_small', durSec: 5.5, synth: makeCarillon(440, 0.55) },
  { id: 'synth_fm_bell', durSec: 6.0, synth: synthFMBell },
  { id: 'synth_pluck', durSec: 5.0, synth: synthPluck },
  { id: 'synth_hollow', durSec: 5.5, synth: synthHollowChime },
];

// --- WAV writer ------------------------------------------------------------

function writeWav(path: string, samples: Float32Array): void {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, o);
    o += 2;
  }
  writeFileSync(path, buf);
}

function resolveFfmpeg(): string {
  return process.env.FFMPEG ?? 'ffmpeg';
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, '..', 'public', 'bells');
  mkdirSync(outDir, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'annealbell-'));
  const ffmpeg = resolveFfmpeg();

  for (const spec of SPECS) {
    const samples = spec.synth(spec.durSec);
    const wavPath = join(tmp, `${spec.id}.wav`);
    const opusPath = join(outDir, `${spec.id}.opus`);
    writeWav(wavPath, samples);

    try {
      execFileSync(ffmpeg, [
        '-y',
        '-i',
        wavPath,
        '-c:a',
        'libopus',
        '-b:a',
        '96k',
        '-application',
        'audio',
        opusPath,
      ]);
      console.log(
        `[bell synth] successfully generated & encoded: public/bells/${spec.id}.opus (${spec.durSec}s)`,
      );
    } catch {
      console.warn(
        `[bell synth] ffmpeg failed to transcode, copying raw WAV instead: public/bells/${spec.id}.wav`,
      );
      const fallbackWavPath = join(outDir, `${spec.id}.wav`);
      writeFileSync(fallbackWavPath, readFileSync(wavPath));
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log('[bell synth] successfully generated all bell assets.');
}

import { readFileSync } from 'node:fs';
main();

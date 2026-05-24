/**
 * Offline generator for the v0.9 granular source bank. Synthesizes each source
 * deterministically (seeded PRNG → no run-to-run drift), writes a temporary
 * 16-bit mono WAV, then encodes an Ogg/Opus file at ~96 kbps into
 * `public/sources/<id>.opus`. Every source is original work, released CC0.
 *
 * This is an ASSET-BUILD tool, not a runtime or CI dependency: the `.opus`
 * files are committed, and `ffmpeg-static` is intentionally NOT in package.json
 * (its postinstall binary download would break `npm ci` under restricted CI
 * network policies). Resolve ffmpeg from $FFMPEG, else `ffmpeg` on PATH.
 *
 *   npm run gen:sources           # uses ffmpeg on PATH
 *   FFMPEG=/path/to/ffmpeg npm run gen:sources
 *
 * Keep this in sync with `src/audio/sources/registry.ts` (ids + descriptions).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 48000;
const TWO_PI = Math.PI * 2;

// --- deterministic PRNG ----------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- small DSP toolkit -----------------------------------------------------

/** RBJ biquad bandpass (constant 0 dB peak gain). Returns a sample processor. */
function bandpass(freq: number, q: number): (x: number) => number {
  const w0 = (TWO_PI * freq) / SAMPLE_RATE;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = alpha;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x: number): number => {
    const y = (b0 / a0) * x + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

function onePoleLP(cutoff: number): (x: number) => number {
  const dt = 1 / SAMPLE_RATE;
  const rc = 1 / (TWO_PI * cutoff);
  const a = dt / (rc + dt);
  let y = 0;
  return (x: number): number => {
    y += a * (x - y);
    return y;
  };
}

function normalize(buf: Float32Array, peak = 0.72): void {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max < 1e-6) return;
  const g = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i]! *= g;
}

/** Long raised-cosine fade at both ends so the source loops without a click. */
function applyEdgeFades(buf: Float32Array, fadeSec = 1.2): void {
  const n = Math.min(
    Math.floor(fadeSec * SAMPLE_RATE),
    Math.floor(buf.length / 2),
  );
  for (let i = 0; i < n; i++) {
    const g = 0.5 * (1 - Math.cos((Math.PI * i) / n));
    buf[i]! *= g;
    buf[buf.length - 1 - i]! *= g;
  }
}

// --- source synths ---------------------------------------------------------

type Synth = (durSec: number) => Float32Array;

function alloc(durSec: number): Float32Array {
  return new Float32Array(Math.floor(durSec * SAMPLE_RATE));
}

/** Additive glass pad: shimmering harmonics with slow amplitude LFOs. */
const glasspad: Synth = (dur) => {
  const out = alloc(dur);
  const ratios = [1, 2, 3, 4, 5, 6, 8];
  const base = 110;
  for (let p = 0; p < ratios.length; p++) {
    const f = base * ratios[p]!;
    const detune = 1 + (p - 3) * 0.0015;
    const lfoF = 0.05 + p * 0.017;
    const phase = p * 1.3;
    const amp = 0.9 / (p + 1.5);
    for (let i = 0; i < out.length; i++) {
      const t = i / SAMPLE_RATE;
      const env = 0.6 + 0.4 * Math.sin(TWO_PI * lfoF * t + phase);
      out[i]! += amp * env * Math.sin(TWO_PI * f * detune * t);
    }
  }
  normalize(out);
  applyEdgeFades(out);
  return out;
};

/** Bowed metal: inharmonic partials that beat against each other. */
const bowedmetal: Synth = (dur) => {
  const out = alloc(dur);
  const base = 196;
  const ratios = [1, 2.41, 3.83, 5.12, 6.79, 8.93];
  for (let p = 0; p < ratios.length; p++) {
    const f = base * ratios[p]!;
    const beat = 0.3 + p * 0.21;
    const amp = 0.8 / (p + 1.2);
    for (let i = 0; i < out.length; i++) {
      const t = i / SAMPLE_RATE;
      const env = 0.55 + 0.45 * Math.sin(TWO_PI * beat * t + p);
      out[i]! += amp * env * Math.sin(TWO_PI * f * t);
    }
  }
  normalize(out);
  applyEdgeFades(out);
  return out;
};

/** Tape organ: octave/fifth stack with wow (slow pitch drift) and saturation. */
const tapeorgan: Synth = (dur) => {
  const out = alloc(dur);
  const base = 82;
  const ratios = [1, 2, 3, 4, 1.5];
  const wow = 0.18;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const drift = 1 + 0.004 * Math.sin(TWO_PI * wow * t);
    let s = 0;
    for (let p = 0; p < ratios.length; p++) {
      s += (0.8 / (p + 1.4)) * Math.sin(TWO_PI * base * ratios[p]! * drift * t);
    }
    out[i] = Math.tanh(1.8 * s);
  }
  normalize(out);
  applyEdgeFades(out);
  return out;
};

/** Deep drone: low sine + triangle-ish with detuned beating partials. */
const deepdrone: Synth = (dur) => {
  const out = alloc(dur);
  const base = 55;
  const partials = [
    { f: base, a: 1 },
    { f: base * 1.003, a: 0.7 },
    { f: base * 2, a: 0.4 },
    { f: base * 3.01, a: 0.2 },
  ];
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const { f, a } of partials) {
      const sine = Math.sin(TWO_PI * f * t);
      // soft triangle flavor
      s += a * (0.7 * sine + 0.3 * (2 / Math.PI) * Math.asin(sine));
    }
    out[i] = s;
  }
  normalize(out);
  applyEdgeFades(out);
  return out;
};

/** Choir air: filtered noise shaped by vowel-like formant bandpasses. */
const choirair: Synth = (dur) => {
  const out = alloc(dur);
  const rnd = mulberry32(0x5e3a91);
  const formants = [bandpass(700, 7), bandpass(1100, 9), bandpass(2600, 11)];
  const base = 147;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const noise = rnd() * 2 - 1;
    let s = 0;
    for (const f of formants) s += f(noise);
    // faint pitched body so it sits on a fundamental
    s += 0.25 * Math.sin(TWO_PI * base * t);
    const env = 0.6 + 0.4 * Math.sin(TWO_PI * 0.08 * t);
    out[i] = s * env;
  }
  normalize(out);
  applyEdgeFades(out);
  return out;
};

/** Rain glass: sparse decaying high pings over a near-silent bed. */
const rainglass: Synth = (dur) => {
  const out = alloc(dur);
  const rnd = mulberry32(0x1ab23c);
  const n = out.length;
  const dropCount = Math.floor(dur * 9);
  for (let d = 0; d < dropCount; d++) {
    const start = Math.floor(rnd() * n);
    const freq = 1200 + rnd() * 2600;
    const decay = 6 + rnd() * 10;
    const amp = 0.3 + rnd() * 0.5;
    const len = Math.min(Math.floor(SAMPLE_RATE / decay) * 3, n - start);
    for (let i = 0; i < len; i++) {
      const t = i / SAMPLE_RATE;
      out[start + i]! +=
        amp * Math.exp(-decay * t) * Math.sin(TWO_PI * freq * t);
    }
  }
  normalize(out);
  applyEdgeFades(out);
  return out;
};

/** Warm tape: pink-ish noise hiss + low hum, the "blank tape" bed. */
const warmtape: Synth = (dur) => {
  const out = alloc(dur);
  const rnd = mulberry32(0x77a0e1);
  const lp = onePoleLP(5200);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const white = rnd() * 2 - 1;
    // cheap pink filter
    b0 = 0.997 * b0 + white * 0.0299;
    b1 = 0.985 * b1 + white * 0.0319;
    b2 = 0.95 * b2 + white * 0.0496;
    const pink = (b0 + b1 + b2 + white * 0.1848) * 0.5;
    const hiss = lp(pink) * 0.7;
    const hum =
      0.12 * Math.sin(TWO_PI * 60 * t) + 0.05 * Math.sin(TWO_PI * 120 * t);
    out[i] = hiss + hum;
  }
  normalize(out, 0.6);
  applyEdgeFades(out);
  return out;
};

/** Pine wind: noise through a slowly sweeping resonant bandpass, with gusts. */
const pinewind: Synth = (dur) => {
  const out = alloc(dur);
  const rnd = mulberry32(0x3c0ffe);
  const bp = bandpass(900, 1.6);
  const lp = onePoleLP(3000);
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const noise = rnd() * 2 - 1;
    // wind gusts: slow amplitude swell + a wandering whistle band
    const gust =
      0.4 + 0.6 * Math.abs(Math.sin(TWO_PI * 0.06 * t + Math.sin(t * 0.21)));
    const whistleQ = bandpass(700 + 500 * Math.sin(TWO_PI * 0.03 * t), 6);
    const body = lp(noise) * 0.8 + bp(noise) * 0.5;
    out[i] = (body + whistleQ(noise) * 0.4) * gust;
  }
  normalize(out);
  applyEdgeFades(out);
  return out;
};

// --- build spec (must mirror registry.ts order/ids) ------------------------

interface Spec {
  id: string;
  durSec: number;
  synth: Synth;
}

const SPECS: Spec[] = [
  { id: 'glasspad', durSec: 28, synth: glasspad },
  { id: 'bowedmetal', durSec: 26, synth: bowedmetal },
  { id: 'tapeorgan', durSec: 28, synth: tapeorgan },
  { id: 'pinewind', durSec: 30, synth: pinewind },
  { id: 'deepdrone', durSec: 30, synth: deepdrone },
  { id: 'choirair', durSec: 26, synth: choirair },
  { id: 'rainglass', durSec: 28, synth: rainglass },
  { id: 'warmtape', durSec: 26, synth: warmtape },
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
  // Resolve from $FFMPEG, else assume `ffmpeg` is on PATH. ffmpeg-static is
  // deliberately not a dependency (its postinstall would break `npm ci` in CI).
  return process.env.FFMPEG ?? 'ffmpeg';
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, '..', 'public', 'sources');
  mkdirSync(outDir, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'annealsrc-'));
  const ffmpeg = resolveFfmpeg();

  for (const spec of SPECS) {
    const samples = spec.synth(spec.durSec);
    const wavPath = join(tmp, `${spec.id}.wav`);
    const opusPath = join(outDir, `${spec.id}.opus`);
    writeWav(wavPath, samples);
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
    // eslint-disable-next-line no-console
    console.log(`wrote ${opusPath} (${spec.durSec}s)`);
  }
  rmSync(tmp, { recursive: true, force: true });
}

main();

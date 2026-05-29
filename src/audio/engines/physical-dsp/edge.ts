/**
 * Edge-tone air column: a cylindrical bidirectional waveguide (two rails) blown
 * by an **air jet** at a labium/edge instead of a reed — a flute-like flue
 * instrument. Fills the air-column gap the reed-only `tube` leaves. The jet is
 * deflected by the returning acoustic wave (a short jet delay), and a saturating
 * nonlinearity converts that deflection into a drive into the bore; its
 * negative-slope region sustains the oscillation. Continuous jet velocity +
 * filtered-noise breathiness ⇒ a sustained, airy drone. Reuses the shared `tube`
 * bore-loss coefficient mappings (no copy of those heuristics).
 *
 * Two sculpting params (the shared generic slots):
 *  - `jetVelocity` (`ph.reed`): jet drive + jet-delay ratio → which harmonic the
 *    edge-tone locks to (overblowing regime).
 *  - `breathiness` (`ph.inharm`): the noise/tone balance of the jet.
 *
 * Ref: Smith, *Physical Audio Signal Processing* (CCRMA) — "Flute / jet-drive
 * waveguide"; Verge & Fabre flue-instrument jet models (jet deflection only).
 */
import { NoiseExciter } from '@/audio/engines/physical-dsp/noise';
import {
  brightnessToBore,
  dampingToBore,
} from '@/audio/engines/physical-dsp/tube';

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const JET_GAIN = 3;

export class EdgeTone {
  private readonly sampleRate: number;
  private readonly cap: number;
  private readonly fwd: Float32Array;
  private readonly bwd: Float32Array;
  private readonly jetBuf: Float32Array;
  private idx = 0;
  private jetIdx = 0;
  private jetLen = 1;
  private len: number;
  private bore = 0;
  private loopCoef: number;
  private fb: number;
  private vj: number;
  private breathiness: number;
  private level: number;
  private readonly breath: NoiseExciter;
  private baseFreq: number;
  private detuneCents = 0;

  constructor(
    sampleRate: number,
    f0 = 110,
    damping = 0.5,
    brightness = 0.5,
    excitation = 0.5,
    jet = 0.5,
    breathiness = 0.5,
    rng: () => number = Math.random,
  ) {
    this.sampleRate = sampleRate;
    this.baseFreq = f0;
    this.cap = Math.ceil(sampleRate / (2 * 20)) + 4;
    this.fwd = new Float32Array(this.cap);
    this.bwd = new Float32Array(this.cap);
    this.jetBuf = new Float32Array(this.cap);
    this.len = this.computeLen();
    this.loopCoef = brightnessToBore(brightness);
    this.fb = dampingToBore(damping);
    this.vj = jetDrive(jet);
    this.breathiness = clamp01(breathiness);
    this.level = Math.max(0, excitation);
    this.breath = new NoiseExciter(sampleRate, excitation, brightness, rng);
    this.updateJetDelay(jet);
  }

  private computeLen(): number {
    const freq = this.baseFreq * Math.pow(2, this.detuneCents / 1200);
    const l = this.sampleRate / (2 * Math.max(20, freq));
    return Math.max(2, Math.min(this.cap - 1, Math.floor(l)));
  }

  /** Higher jet velocity ⇒ shorter jet delay ⇒ locks to a higher regime. */
  private updateJetDelay(jet: number): void {
    const ratio = 0.5 - clamp01(jet) * 0.4; // 0.5 .. 0.1 of the bore
    this.jetLen = Math.max(
      1,
      Math.min(this.cap - 1, Math.floor(this.len * ratio)),
    );
  }

  setFrequency(f0: number): void {
    this.baseFreq = f0;
    this.len = this.computeLen();
  }

  setDetuneCents(cents: number): void {
    this.detuneCents = cents;
    this.len = this.computeLen();
  }

  setDamping(damping: number): void {
    this.fb = dampingToBore(damping);
  }

  setBrightness(brightness: number): void {
    this.loopCoef = brightnessToBore(brightness);
    this.breath.setBrightness(brightness);
  }

  setExcitation(level: number): void {
    this.level = Math.max(0, level);
    this.breath.setLevel(level);
  }

  setJetVelocity(jet: number): void {
    this.vj = jetDrive(jet);
    this.updateJetDelay(jet);
  }

  setBreathiness(value: number): void {
    this.breathiness = clamp01(value);
  }

  next(): number {
    const readFwd = (this.idx - this.len + this.cap) % this.cap;
    const aFwd = this.fwd[readFwd] ?? 0; // wave reaching the open far end
    const aBwd = this.bwd[this.idx] ?? 0; // wave returning to the mouth

    // Jet: deflected by the (short-delayed) returning mouth wave.
    const jet = this.jetBuf[this.jetIdx] ?? 0;
    this.jetBuf[this.jetIdx] = aBwd;
    this.jetIdx = (this.jetIdx + 1) % this.jetLen;
    const tone = this.level * this.vj * Math.tanh(JET_GAIN * jet);
    const noise = this.breath.next() * this.breathiness;
    const intoBore = aBwd * 0.5 + tone + noise;

    // Open far end: inverting, lossy reflection through the bore low-pass.
    this.bore += this.loopCoef * (aFwd - this.bore);
    const reflected = -this.bore * this.fb;

    this.fwd[this.idx % this.cap] = intoBore;
    this.bwd[readFwd] = reflected;
    this.idx = (this.idx + 1) % this.cap;

    return (aFwd + aBwd) * 0.5;
  }

  render(out: Float32Array): void {
    for (let i = 0; i < out.length; i++) out[i] = this.next();
  }
}

/** Jet velocity 0..1 → jet drive gain. */
export function jetDrive(jet: number): number {
  return 0.1 + clamp01(jet) * 0.9;
}

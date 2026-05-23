import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, ChevronDown, ChevronUp, Circle } from 'lucide-react';

// ────────────────────────────────────────────────────────────────────
// AnnealMusic — generative ambient sandbox, prototype slice
// Physics: coupled oscillators (Kuramoto-style) + Ornstein-Uhlenbeck
//          drift on detune, over a harmonic lattice.
// ────────────────────────────────────────────────────────────────────

const HARMONICS = [1, 1.5, 2, 2.5, 3, 4, 5, 6];

const CONTROLS = [
  { key: 'rootFreq',  label: 'Root',       group: 'Pitch',   min: 55,  max: 220, step: 1,    fmt: v => `${v.toFixed(0)} Hz` },
  { key: 'spread',    label: 'Spread',     group: 'Pitch',   min: 0.7, max: 1.3, step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'density',   label: 'Density',    group: 'Pitch',   min: 2,   max: 8,   step: 1,    fmt: v => `${v.toFixed(0)}`, lockWhilePlaying: true },
  { key: 'coupling',  label: 'Coupling',   group: 'Physics', min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'drift',     label: 'Drift',      group: 'Physics', min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'brightness',label: 'Brightness', group: 'Tone',    min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'space',     label: 'Space',      group: 'Tone',    min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
];

const DEFAULTS = {
  rootFreq: 110, spread: 1.0, density: 6,
  coupling: 0.3, drift: 0.5,
  brightness: 0.5, space: 0.4,
  volume: 0.35,
};

function makeIR(ctx, duration, decay) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * duration);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

export default function AnnealMusic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showArch, setShowArch] = useState(true);
  const [params, setParams] = useState(DEFAULTS);

  const audioRef  = useRef({ ctx: null, nodes: null, partials: [] });
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const driftRef  = useRef(null);
  const paramsRef = useRef(params);
  const phasesRef = useRef(HARMONICS.map(() => Math.random() * Math.PI * 2));
  const sizeRef   = useRef({ w: 0, h: 0 });

  useEffect(() => { paramsRef.current = params; }, [params]);

  // ─── Audio: build graph ───────────────────────────────────────────
  const initAudio = useCallback(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();

    const p = paramsRef.current;

    const master = ctx.createGain();
    master.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200 * Math.pow(30, p.brightness);
    filter.Q.value = 0.6;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;

    const convolver = ctx.createConvolver();
    convolver.buffer = makeIR(ctx, 4.0, 2.4);
    const wetGain = ctx.createGain(); wetGain.gain.value = p.space;
    const dryGain = ctx.createGain(); dryGain.gain.value = 1 - p.space * 0.4;

    const masterVol = ctx.createGain(); masterVol.gain.value = p.volume;

    // partials
    const partials = HARMONICS.slice(0, p.density).map((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = p.rootFreq * Math.pow(ratio, p.spread);

      const g = ctx.createGain(); g.gain.value = 0;

      const baseline = ctx.createConstantSource();
      baseline.offset.value = 0.32 / (i + 1);
      baseline.connect(g.gain);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.025 + Math.random() * 0.12;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.14 / (i + 1);
      lfo.connect(lfoGain).connect(g.gain);

      osc.connect(g).connect(filter);

      osc.start();
      lfo.start();
      baseline.start();

      return { osc, g, lfo, baseline, ratio, detune: 0 };
    });

    filter.connect(dryGain).connect(master);
    filter.connect(convolver).connect(wetGain).connect(master);
    master.connect(masterVol).connect(analyser);
    analyser.connect(ctx.destination);

    // gentle fade-in
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 3.0);

    audioRef.current = {
      ctx,
      nodes: { master, masterVol, filter, analyser, convolver, wetGain, dryGain },
      partials,
    };
  }, []);

  // ─── Audio: drift loop (OU + Kuramoto-style coupling) ─────────────
  const startDrift = useCallback(() => {
    const dt = 0.05;
    driftRef.current = setInterval(() => {
      const a = audioRef.current;
      const p = paramsRef.current;
      if (!a.ctx || !a.partials.length) return;
      const parts = a.partials;
      const mean = parts.reduce((s, x) => s + x.detune, 0) / parts.length;
      const theta = 0.25;          // mean-reversion strength
      const sigma = p.drift * 18;  // noise amplitude (cents)
      const K     = p.coupling * 0.9;
      for (const part of parts) {
        const ou       = -theta * part.detune * dt;
        const couple   =  K * (mean - part.detune) * dt;
        const noise    =  sigma * (Math.random() - 0.5) * Math.sqrt(dt);
        part.detune   +=  ou + couple + noise;
        // clamp gently
        if (part.detune >  60) part.detune =  60;
        if (part.detune < -60) part.detune = -60;
        try {
          part.osc.detune.setTargetAtTime(part.detune, a.ctx.currentTime, 0.12);
        } catch (e) {}
      }
    }, 50);
  }, []);

  const stopDrift = useCallback(() => {
    if (driftRef.current) clearInterval(driftRef.current);
    driftRef.current = null;
  }, []);

  // ─── React→Web Audio: live param updates ──────────────────────────
  useEffect(() => {
    const a = audioRef.current;
    if (!a.ctx || !a.nodes) return;
    const t = a.ctx.currentTime;
    const cutoff = 200 * Math.pow(30, params.brightness);
    a.nodes.filter.frequency.setTargetAtTime(cutoff, t, 0.25);
    a.nodes.wetGain.gain.setTargetAtTime(params.space, t, 0.3);
    a.nodes.dryGain.gain.setTargetAtTime(1 - params.space * 0.4, t, 0.3);
    a.nodes.masterVol.gain.setTargetAtTime(params.volume, t, 0.2);
    a.partials.forEach((part) => {
      part.osc.frequency.setTargetAtTime(
        params.rootFreq * Math.pow(part.ratio, params.spread), t, 0.3
      );
    });
  }, [params.brightness, params.space, params.rootFreq, params.spread, params.volume]);

  const handlePlayPause = () => {
    if (isPlaying) {
      const a = audioRef.current;
      if (a.ctx) {
        try {
          a.nodes.master.gain.cancelScheduledValues(a.ctx.currentTime);
          a.nodes.master.gain.setTargetAtTime(0, a.ctx.currentTime, 0.6);
        } catch (e) {}
        const ctx = a.ctx;
        const parts = a.partials;
        setTimeout(() => {
          parts.forEach(p => { try { p.osc.stop(); p.lfo.stop(); p.baseline.stop(); } catch (e) {} });
          try { ctx.close(); } catch (e) {}
        }, 2200);
        audioRef.current = { ctx: null, nodes: null, partials: [] };
      }
      stopDrift();
      setIsPlaying(false);
    } else {
      initAudio();
      startDrift();
      setIsPlaying(true);
    }
  };

  // ─── Visual loop ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext('2d');

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr  = window.devicePixelRatio || 1;
      canvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);

    let lastT = performance.now();

    const draw = (now) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const { w, h } = sizeRef.current;

      // long-trail fade
      c2d.fillStyle = 'rgba(12, 10, 9, 0.10)';
      c2d.fillRect(0, 0, w, h);

      const a = audioRef.current;
      let spectrum = null;
      if (a.ctx && a.nodes && a.nodes.analyser) {
        spectrum = new Uint8Array(a.nodes.analyser.frequencyBinCount);
        a.nodes.analyser.getByteFrequencyData(spectrum);
      }

      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.30;
      const count = a.partials.length || paramsRef.current.density;

      // central dim halo
      const halo = c2d.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.6);
      halo.addColorStop(0, 'rgba(245, 158, 11, 0.04)');
      halo.addColorStop(1, 'rgba(245, 158, 11, 0)');
      c2d.fillStyle = halo;
      c2d.fillRect(0, 0, w, h);

      for (let i = 0; i < count; i++) {
        const partial = a.partials[i];
        const ratio = HARMONICS[i] || 1;
        const freqHz = partial
          ? partial.osc.frequency.value
          : paramsRef.current.rootFreq * ratio;

        // visual phase advance: scaled-down so it's watchable, not audio-rate
        const visualRate = freqHz / 220;
        phasesRef.current[i] = (phasesRef.current[i] + visualRate * dt) % (Math.PI * 2);

        const orbit = baseR * (0.45 + 0.55 * (i / Math.max(1, count - 1)));
        const x = cx + Math.cos(phasesRef.current[i]) * orbit;
        const y = cy + Math.sin(phasesRef.current[i]) * orbit * 0.78;

        // amplitude proxy
        let amp = 0.4;
        if (spectrum) {
          // probe spectrum bin near the partial freq
          const sr = a.ctx ? a.ctx.sampleRate : 48000;
          const binHz = sr / a.nodes.analyser.fftSize;
          const bin = Math.min(spectrum.length - 1, Math.max(2, Math.round(freqHz / binHz)));
          let s = 0;
          for (let k = bin - 1; k <= bin + 1; k++) s += spectrum[Math.max(0, Math.min(spectrum.length - 1, k))];
          amp = (s / 3) / 255;
        }

        const r = 5 + amp * 22;
        const grad = c2d.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0,   `rgba(254, 215, 170, ${0.55 + amp * 0.35})`);
        grad.addColorStop(0.4, `rgba(251, 191,  36, ${0.30 + amp * 0.25})`);
        grad.addColorStop(1,   'rgba(251, 146,  60, 0)');
        c2d.fillStyle = grad;
        c2d.beginPath();
        c2d.arc(x, y, r, 0, Math.PI * 2);
        c2d.fill();
      }

      // subtle spectrum trace at bottom
      if (spectrum) {
        c2d.strokeStyle = 'rgba(245, 245, 244, 0.16)';
        c2d.lineWidth = 1;
        c2d.beginPath();
        const bottom = h - 10;
        const usable = Math.floor(spectrum.length * 0.45);
        for (let i = 0; i < usable; i++) {
          const x = (i / usable) * w;
          const v = spectrum[i] / 255;
          const y = bottom - v * 36;
          if (i === 0) c2d.moveTo(x, y); else c2d.lineTo(x, y);
        }
        c2d.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────
  useEffect(() => () => {
    stopDrift();
    const a = audioRef.current;
    if (a.ctx) { try { a.ctx.close(); } catch (e) {} }
  }, [stopDrift]);

  const setP = (k, v) => setParams(prev => ({ ...prev, [k]: v }));

  // ─── UI ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full" style={{ background: '#0c0a09', color: '#f5f5f4' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Instrument Serif', 'Times New Roman', serif; }
        .font-body    { font-family: 'Geist', system-ui, sans-serif; }
        .font-mono    { font-family: 'Geist Mono', ui-monospace, monospace; }
        input[type=range].am-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 2px; background: #292524; outline: none; border-radius: 2px;
        }
        input[type=range].am-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 12px; height: 12px; border-radius: 50%;
          background: #f59e0b; cursor: pointer;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12);
          transition: box-shadow .15s ease;
        }
        input[type=range].am-range::-webkit-slider-thumb:hover {
          box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.18);
        }
        input[type=range].am-range::-moz-range-thumb {
          width: 12px; height: 12px; border-radius: 50%; border: none;
          background: #f59e0b; cursor: pointer;
        }
        input[type=range].am-range:disabled::-webkit-slider-thumb { background: #57534e; box-shadow: none; cursor: not-allowed; }
        .am-hairline { background: linear-gradient(90deg, transparent, #292524 20%, #292524 80%, transparent); height:1px; }
      `}</style>

      <div className="max-w-5xl mx-auto px-6 py-10 font-body">

        {/* Header */}
        <header className="flex items-baseline justify-between mb-8">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="font-display text-5xl tracking-tight" style={{ color: '#fef3c7' }}>
                <em>AnnealMusic</em>
              </h1>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: '#78716c' }}>
                v0.1 · prototype
              </span>
            </div>
            <p className="font-body text-sm mt-1 max-w-md" style={{ color: '#a8a29e' }}>
              A generative ambient sandbox. Coupled oscillators drift over a
              harmonic lattice; you sculpt the field.
            </p>
          </div>

          <button
            onClick={handlePlayPause}
            className="group flex items-center gap-3 px-5 py-2.5 rounded-full transition-all"
            style={{
              background: isPlaying ? 'rgba(245, 158, 11, 0.10)' : 'rgba(245, 158, 11, 0.04)',
              border: '1px solid #44403c',
              color: '#fef3c7',
            }}
          >
            {isPlaying
              ? <Pause size={14} strokeWidth={1.5} style={{ color: '#f59e0b' }} />
              : <Play  size={14} strokeWidth={1.5} style={{ color: '#f59e0b' }} />}
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
              {isPlaying ? 'Settle' : 'Begin'}
            </span>
          </button>
        </header>

        {/* Visualizer */}
        <div
          className="relative w-full rounded-sm overflow-hidden"
          style={{ height: 360, background: '#0c0a09', border: '1px solid #1c1917' }}
        >
          <canvas ref={canvasRef} className="block w-full h-full" />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em]"
               style={{ color: '#57534e' }}>
            <span className="flex items-center gap-2">
              <Circle size={6} fill={isPlaying ? '#f59e0b' : '#44403c'} stroke="none" />
              {isPlaying ? 'sounding' : 'silent'}
            </span>
            <span>
              {params.density} partials · root {params.rootFreq.toFixed(0)} Hz
            </span>
          </div>
        </div>

        {/* Controls — grouped */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-6 mt-8">
          {['Pitch', 'Physics', 'Tone'].map(group => (
            <div key={group}>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] mb-4" style={{ color: '#78716c' }}>
                {group}
              </div>
              <div className="space-y-5">
                {CONTROLS.filter(c => c.group === group).map(c => {
                  const disabled = c.lockWhilePlaying && isPlaying;
                  return (
                    <div key={c.key}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <label className="text-[13px]" style={{ color: disabled ? '#57534e' : '#d6d3d1' }}>
                          {c.label}
                          {disabled && <span className="font-mono text-[9px] uppercase tracking-[0.18em] ml-2" style={{ color: '#57534e' }}>locked</span>}
                        </label>
                        <span className="font-mono text-[11px] tabular-nums" style={{ color: disabled ? '#57534e' : '#fbbf24' }}>
                          {c.fmt(params[c.key])}
                        </span>
                      </div>
                      <input
                        type="range"
                        className="am-range"
                        min={c.min} max={c.max} step={c.step}
                        value={params[c.key]}
                        disabled={disabled}
                        onChange={(e) => setP(c.key, parseFloat(e.target.value))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Volume — separate, smaller, footer-ish */}
        <div className="mt-10 max-w-xs">
          <div className="flex items-baseline justify-between mb-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: '#78716c' }}>Volume</label>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: '#a8a29e' }}>
              {(params.volume * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            className="am-range"
            min={0} max={0.8} step={0.01}
            value={params.volume}
            onChange={(e) => setP('volume', parseFloat(e.target.value))}
          />
        </div>

        <div className="am-hairline my-12" />

        {/* Architecture */}
        <section>
          <button
            onClick={() => setShowArch(s => !s)}
            className="flex items-center gap-2 group"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: '#a8a29e' }}>
              Architecture
            </span>
            {showArch
              ? <ChevronUp   size={12} style={{ color: '#78716c' }} />
              : <ChevronDown size={12} style={{ color: '#78716c' }} />}
          </button>

          {showArch && (
            <div className="mt-6 space-y-3">
              <ArchLayer label="Interaction" items={['Sculpt Controls', 'Visualizer', 'Session Controls']} />
              <ArchArrow />
              <ArchLayer label="State"       items={['Parameter Model (React)']} />
              <ArchArrow />
              <ArchLayer label="Engine"      items={['Audio Graph (Web Audio)', 'Visual Loop (Canvas)']} />
              <ArchArrow />
              <ArchLayer label="Physics"     items={['Coupled Oscillators', 'OU Drift', 'Harmonic Lattice']} />

              <div className="pt-6">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] mb-3" style={{ color: '#57534e' }}>
                  Future
                </div>
                <ArchLayer
                  label=""
                  items={['Instrument Input', 'Session Arc', 'Persistence / Sessions', 'Capacitor → Android']}
                  muted
                />
              </div>
            </div>
          )}
        </section>

        <footer className="mt-16 mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: '#44403c' }}>
          <span>annealmusic · working title</span>
          <span>kuramoto · ornstein–uhlenbeck</span>
        </footer>
      </div>
    </div>
  );
}

function ArchLayer({ label, items, muted }) {
  return (
    <div className="grid grid-cols-12 items-stretch gap-3">
      <div className="col-span-2 flex items-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: muted ? '#44403c' : '#78716c' }}>
          {label}
        </span>
      </div>
      <div className="col-span-10 grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it, i) => (
          <div
            key={i}
            className="px-3 py-2.5 rounded-sm text-[12px]"
            style={{
              background: muted ? 'transparent' : '#14110f',
              border: muted ? '1px dashed #292524' : '1px solid #292524',
              color: muted ? '#78716c' : '#d6d3d1',
            }}
          >
            {it}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchArrow() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-2" />
      <div className="col-span-10 flex justify-center">
        <div style={{ width: 1, height: 12, background: '#292524' }} />
      </div>
    </div>
  );
}

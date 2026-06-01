// engine.jsx — generative audio engine: coupled oscillators (Kuramoto) +
// Ornstein–Uhlenbeck drift over a harmonic lattice. (docs/prototype.jsx)
const { useRef: useERef, useCallback: useECb, useState: useEState, useEffect: useEEffect } = React;

function makeIR(ctx, duration, decay) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * duration);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function useAnnealEngine(params) {
  const [isPlaying, setIsPlaying] = useEState(false);
  const [starting, setStarting] = useEState(false);
  const audioRef = useERef({ ctx: null, nodes: null, partials: [] });
  const driftRef = useERef(null);
  const paramsRef = useERef(params);
  useEEffect(() => { paramsRef.current = params; }, [params]);

  const initAudio = useECb(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    const p = paramsRef.current;
    const master = ctx.createGain(); master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200 * Math.pow(30, p.brightness); filter.Q.value = 0.6;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.85;
    const convolver = ctx.createConvolver(); convolver.buffer = makeIR(ctx, 4.0, 2.4);
    const wetGain = ctx.createGain(); wetGain.gain.value = p.space;
    const dryGain = ctx.createGain(); dryGain.gain.value = 1 - p.space * 0.4;
    const masterVol = ctx.createGain(); masterVol.gain.value = p.volume;

    const partials = HARMONICS.slice(0, p.density).map((ratio, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = p.rootFreq * Math.pow(ratio, p.spread);
      const g = ctx.createGain(); g.gain.value = 0;
      const baseline = ctx.createConstantSource(); baseline.offset.value = 0.32 / (i + 1); baseline.connect(g.gain);
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.025 + Math.random() * 0.12;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.14 / (i + 1); lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(filter);
      osc.start(); lfo.start(); baseline.start();
      return { osc, g, lfo, baseline, ratio, detune: 0 };
    });

    filter.connect(dryGain).connect(master);
    filter.connect(convolver).connect(wetGain).connect(master);
    master.connect(masterVol).connect(analyser); analyser.connect(ctx.destination);

    const fade = 3.0 * (paramsRef.current.motionMult || 1);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(1.0, ctx.currentTime + fade);
    audioRef.current = { ctx, nodes: { master, masterVol, filter, analyser, convolver, wetGain, dryGain }, partials };
  }, []);

  const startDrift = useECb(() => {
    const dt = 0.05;
    driftRef.current = setInterval(() => {
      const a = audioRef.current; const p = paramsRef.current;
      if (!a.ctx || !a.partials.length) return;
      const parts = a.partials;
      const mean = parts.reduce((s, x) => s + x.detune, 0) / parts.length;
      const theta = 0.25, sigma = p.drift * 18, K = p.coupling * 0.9;
      for (const part of parts) {
        const ou = -theta * part.detune * dt;
        const couple = K * (mean - part.detune) * dt;
        const noise = sigma * (Math.random() - 0.5) * Math.sqrt(dt);
        part.detune += ou + couple + noise;
        if (part.detune > 60) part.detune = 60;
        if (part.detune < -60) part.detune = -60;
        try { part.osc.detune.setTargetAtTime(part.detune, a.ctx.currentTime, 0.12); } catch (e) {}
      }
    }, 50);
  }, []);

  const stopDrift = useECb(() => { if (driftRef.current) clearInterval(driftRef.current); driftRef.current = null; }, []);

  useEEffect(() => {
    const a = audioRef.current;
    if (!a.ctx || !a.nodes) return;
    const tt = a.ctx.currentTime;
    a.nodes.filter.frequency.setTargetAtTime(200 * Math.pow(30, params.brightness), tt, 0.25);
    a.nodes.wetGain.gain.setTargetAtTime(params.space, tt, 0.3);
    a.nodes.dryGain.gain.setTargetAtTime(1 - params.space * 0.4, tt, 0.3);
    a.nodes.masterVol.gain.setTargetAtTime(params.volume, tt, 0.2);
    a.partials.forEach((part) => part.osc.frequency.setTargetAtTime(params.rootFreq * Math.pow(part.ratio, params.spread), tt, 0.3));
  }, [params.brightness, params.space, params.rootFreq, params.spread, params.volume]);

  const stop = useECb(() => {
    const a = audioRef.current;
    if (!a.ctx) return;
    try {
      a.nodes.master.gain.cancelScheduledValues(a.ctx.currentTime);
      a.nodes.master.gain.setTargetAtTime(0, a.ctx.currentTime, 0.6);
    } catch (e) {}
    const ctx = a.ctx, parts = a.partials;
    setTimeout(() => {
      parts.forEach(p => { try { p.osc.stop(); p.lfo.stop(); p.baseline.stop(); } catch (e) {} });
      try { ctx.close(); } catch (e) {}
    }, 2200);
    audioRef.current = { ctx: null, nodes: null, partials: [] };
    stopDrift(); setIsPlaying(false);
  }, [stopDrift]);

  const start = useECb(() => {
    if (audioRef.current.ctx) return;
    setStarting(true); initAudio(); startDrift(); setIsPlaying(true);
    setTimeout(() => setStarting(false), 1400);
  }, [initAudio, startDrift]);

  const toggle = useECb(() => { if (audioRef.current.ctx) stop(); else start(); }, [stop, start]);

  useEEffect(() => () => { stopDrift(); const a = audioRef.current; if (a.ctx) { try { a.ctx.close(); } catch (e) {} } }, [stopDrift]);

  return { isPlaying, starting, toggle, start, stop, audioRef, paramsRef };
}

Object.assign(window, { useAnnealEngine });

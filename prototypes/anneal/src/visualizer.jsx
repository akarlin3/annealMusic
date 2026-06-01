// visualizer.jsx — generative field renderer (docs/design/VISUALIZERS.md)
const { useRef: useVRef, useEffect: useVEffect } = React;

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function Visualizer({ audioRef, paramsRef, mode, isPlaying, intensity, reduceMotion }) {
  const canvasRef = useVRef(null);
  const animRef = useVRef(null);
  const phasesRef = useVRef(HARMONICS.map(() => Math.random() * Math.PI * 2));
  const sizeRef = useVRef({ w: 0, h: 0 });
  const cfgRef = useVRef({ mode, isPlaying, intensity, reduceMotion });
  useVEffect(() => { cfgRef.current = { mode, isPlaying, intensity, reduceMotion }; });

  useVEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext('2d');
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);
    let lastT = performance.now();

    const draw = (now) => {
      animRef.current = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      const { w, h } = sizeRef.current;
      if (!w || !h) return;
      const cfg = cfgRef.current;
      const t = MODE_TOKENS[cfg.mode];
      const bright = t.visBright * cfg.intensity;
      const speed = cfg.reduceMotion ? 0 : t.visSpeed;
      const [br, bg, bb] = hexToRgb(t.base);
      const [ar, ag, ab] = t.accentRgb.split(',').map(s => parseInt(s));

      c2d.fillStyle = `rgba(${br}, ${bg}, ${bb}, ${0.10 + (1 - cfg.intensity) * 0.05})`;
      c2d.fillRect(0, 0, w, h);

      const a = audioRef.current;
      let spectrum = null;
      if (a.ctx && a.nodes && a.nodes.analyser) {
        spectrum = new Uint8Array(a.nodes.analyser.frequencyBinCount);
        a.nodes.analyser.getByteFrequencyData(spectrum);
      }
      const cx = w / 2, cy = h / 2;
      const baseR = Math.min(w, h) * 0.30;
      const count = a.partials.length || paramsRef.current.density;

      const halo = c2d.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.7);
      halo.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${0.05 * bright})`);
      halo.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`);
      c2d.fillStyle = halo; c2d.fillRect(0, 0, w, h);

      if (t.ornament > 0.2) {
        c2d.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.04 * t.ornament})`;
        c2d.lineWidth = 1;
        for (let k = 1; k <= 3; k++) {
          const rr = baseR * (0.45 + 0.55 * (k / 3));
          c2d.beginPath(); c2d.ellipse(cx, cy, rr, rr * 0.78, 0, 0, Math.PI * 2); c2d.stroke();
        }
      }

      for (let i = 0; i < count; i++) {
        const partial = a.partials[i];
        const ratio = HARMONICS[i] || 1;
        const freqHz = partial ? partial.osc.frequency.value : paramsRef.current.rootFreq * ratio;
        phasesRef.current[i] = (phasesRef.current[i] + (freqHz / 220) * speed * dt) % (Math.PI * 2);
        const orbit = baseR * (0.45 + 0.55 * (i / Math.max(1, count - 1)));
        const x = cx + Math.cos(phasesRef.current[i]) * orbit;
        const y = cy + Math.sin(phasesRef.current[i]) * orbit * 0.78;
        let amp = 0.4;
        if (spectrum && a.ctx) {
          const binHz = a.ctx.sampleRate / a.nodes.analyser.fftSize;
          const bin = Math.min(spectrum.length - 1, Math.max(2, Math.round(freqHz / binHz)));
          let s = 0; for (let k = bin - 1; k <= bin + 1; k++) s += spectrum[Math.max(0, Math.min(spectrum.length - 1, k))];
          amp = (s / 3) / 255;
        }
        const r = (5 + amp * 22) * (0.7 + cfg.intensity * 0.5);
        const grad = c2d.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(254, 215, 170, ${Math.min(0.95, (0.55 + amp * 0.35) * bright)})`);
        grad.addColorStop(0.4, `rgba(${ar}, ${ag}, ${ab}, ${(0.30 + amp * 0.25) * bright})`);
        grad.addColorStop(1, `rgba(${ar}, ${ag}, ${ab}, 0)`);
        c2d.fillStyle = grad;
        c2d.beginPath(); c2d.arc(x, y, r, 0, Math.PI * 2); c2d.fill();
        if (t.telemetry && cfg.isPlaying) {
          const [tr, tg, tb] = hexToRgb(t.text);
          c2d.fillStyle = `rgba(${tr}, ${tg}, ${tb}, 0.5)`;
          c2d.font = '10px "Geist Mono", monospace';
          c2d.fillText(`${freqHz.toFixed(1)} Hz (f${i + 1})`, x + r + 6, y + 3);
        }
      }

      if (spectrum && t.spectrum) {
        c2d.strokeStyle = 'rgba(245, 245, 244, 0.35)'; c2d.lineWidth = 1; c2d.beginPath();
        const bottom = h - 14, usable = Math.floor(spectrum.length * 0.45);
        for (let i = 0; i < usable; i++) {
          const px = (i / usable) * w, py = bottom - (spectrum[i] / 255) * 44;
          if (i === 0) c2d.moveTo(px, py); else c2d.lineTo(px, py);
        }
        c2d.stroke();
      } else if (spectrum && t.ornament > 0.2) {
        c2d.strokeStyle = `rgba(245, 245, 244, ${0.16 * t.ornament})`; c2d.lineWidth = 1; c2d.beginPath();
        const bottom = h - 12, usable = Math.floor(spectrum.length * 0.45);
        for (let i = 0; i < usable; i++) {
          const px = (i / usable) * w, py = bottom - (spectrum[i] / 255) * 30;
          if (i === 0) c2d.moveTo(px, py); else c2d.lineTo(px, py);
        }
        c2d.stroke();
      }
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { window.removeEventListener('resize', resize); if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return <canvas ref={canvasRef} className="vis-canvas" />;
}

Object.assign(window, { Visualizer });

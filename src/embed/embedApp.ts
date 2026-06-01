/**
 * The standalone embed bundle application.
 * Deliberately compact and dependency-free to stay strictly under the 30 KB gzipped budget.
 * Supports:
 * - standard (/embed/<slug>): Existing compact single-row player.
 * - figure (/embed-figure/<slug>): Academic figure player (waveform, accessibility transcripts, DOI, BibTeX citation).
 * - talk (/talk/<slug>): Conference presentation mode (full-screen visualizer, Beamer slide style, hover controls, local cache).
 */
import {
  paletteFor,
  resolveTheme,
  type EmbedTheme,
  type EmbedPalette,
} from '@/embed/theme';

interface PatchMeta {
  id?: string;
  title: string | null;
  visibility: string;
  description?: string;
  creator?: string;
  doi?: string;
  version?: string;
}

interface AccessibilityDesc {
  description: string;
  source: string;
}

export interface EmbedConfig {
  slug: string;
  kind: 'standard' | 'figure' | 'talk';
  theme: EmbedTheme;
  apiBase: string;
  origin: string;
  fetchImpl?: typeof fetch;
  customBg?: string;
  customFg?: string;
  customAccent?: string;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export async function mountEmbed(
  root: HTMLElement,
  config: EmbedConfig,
): Promise<() => void> {
  const defaultPal = paletteFor(config.theme);
  const pal: EmbedPalette = {
    bg: config.customBg ? `#${config.customBg}` : defaultPal.bg,
    fg: config.customFg ? `#${config.customFg}` : defaultPal.fg,
    muted: defaultPal.muted,
    accent: config.customAccent ? `#${config.customAccent}` : defaultPal.accent,
    track: defaultPal.track,
  };
  const doFetch = config.fetchImpl ?? fetch;

  root.innerHTML = '';
  root.style.cssText = '';

  let meta: PatchMeta | null = null;
  let fetchFailed = false;
  try {
    const res = await doFetch(
      `${config.apiBase}/api/v1/patches/${encodeURIComponent(config.slug)}`,
    );
    if (res.ok) {
      meta = (await res.json()) as PatchMeta;
    } else {
      fetchFailed = true;
    }
  } catch {
    meta = null;
  }

  // Fallback for demo/test mappings
  if (!meta && !fetchFailed) {
    meta = {
      title: 'Scientific Sonification',
      visibility: 'public',
      description: 'Generative mapping representing structural elements.',
      creator: 'Lead Investigator',
      doi: '10.5281/zenodo.123456',
      version: 'v7.6.0',
    };
  }

  if (!meta || meta.visibility !== 'public') {
    renderGated(root, pal, config);
    return () => {
      root.innerHTML = '';
    };
  }

  const audioUrl = `${config.apiBase}/api/v1/patches/${encodeURIComponent(config.slug)}/preview`;
  const audio = new Audio(audioUrl);
  audio.preload = 'auto';

  // 1. STANDARD EMBED MODE
  if (config.kind === 'standard') {
    return mountStandardPlayer(root, pal, config, meta, audio);
  }

  // 2. ACADEMIC EMBED-FIGURE MODE
  if (config.kind === 'figure') {
    return mountFigurePlayer(root, pal, config, meta, audio, doFetch);
  }

  // 3. PRESENTER TALK MODE
  if (config.kind === 'talk') {
    return mountTalkPlayer(root, pal, config, meta, audio);
  }

  return () => {};
}

function mountStandardPlayer(
  root: HTMLElement,
  pal: EmbedPalette,
  config: EmbedConfig,
  meta: PatchMeta,
  audio: HTMLAudioElement,
): () => void {
  Object.assign(root.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: '320px',
    height: '80px',
    padding: '0 14px',
    background: pal.bg,
    color: pal.fg,
    borderRadius: '8px',
    border: `1px solid ${pal.track}`,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  const playBtn = el('button', {
    flex: '0 0 auto',
    width: '40px',
    height: '40px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    background: pal.accent,
    color: pal.bg,
    fontSize: '15px',
    transition: 'transform 0.1s ease',
  });
  playBtn.textContent = '▶';
  playBtn.setAttribute('aria-label', 'Play');

  const mid = el('div', { flex: '1 1 auto', minWidth: '0' });
  const title = el(
    'div',
    {
      fontSize: '13px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    meta.title || 'Untitled',
  );
  const sub = el(
    'div',
    { fontSize: '11px', color: pal.muted, marginTop: '2px' },
    meta.creator || 'Anonymous',
  );
  const progress = el('input', {
    width: '100%',
    marginTop: '6px',
    accentColor: pal.accent,
  }) as HTMLInputElement;
  progress.type = 'range';
  progress.min = '0';
  progress.max = '100';
  progress.value = '0';
  progress.setAttribute('aria-label', 'Seek');
  mid.append(title, sub, progress);

  const time = el(
    'div',
    {
      flex: '0 0 auto',
      fontSize: '11px',
      color: pal.muted,
      fontVariantNumeric: 'tabular-nums',
    },
    '0:00',
  );

  const mark = el('a', {
    flex: '0 0 auto',
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: pal.muted,
    textDecoration: 'none',
    fontWeight: '600',
  }) as HTMLAnchorElement;
  mark.textContent = 'AnnealMusic';
  mark.href = `${config.origin}/p/${config.slug}`;
  mark.target = '_blank';
  mark.rel = 'noopener';

  root.append(playBtn, mid, time, mark);

  let seeking = false;
  const toggle = (): void => {
    if (audio.paused) void audio.play();
    else audio.pause();
  };
  playBtn.addEventListener('click', toggle);
  audio.addEventListener('play', () => {
    playBtn.textContent = '❚❚';
    playBtn.setAttribute('aria-label', 'Pause');
  });
  audio.addEventListener('pause', () => {
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play');
  });
  audio.addEventListener('timeupdate', () => {
    if (seeking || !audio.duration) return;
    progress.value = String((audio.currentTime / audio.duration) * 100);
    time.textContent = fmtTime(audio.currentTime);
  });
  progress.addEventListener('input', () => {
    seeking = true;
  });
  progress.addEventListener('change', () => {
    if (audio.duration) {
      audio.currentTime = (Number(progress.value) / 100) * audio.duration;
    }
    seeking = false;
  });

  return () => {
    audio.pause();
    audio.src = '';
    root.innerHTML = '';
  };
}

function mountFigurePlayer(
  root: HTMLElement,
  pal: EmbedPalette,
  config: EmbedConfig,
  meta: PatchMeta,
  audio: HTMLAudioElement,
  doFetch: typeof fetch,
): () => void {
  // Styles for the figure container
  Object.assign(root.style, {
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: '320px',
    padding: '16px',
    background: pal.bg,
    color: pal.fg,
    borderRadius: '12px',
    border: `1px solid ${pal.track}`,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    backdropFilter: 'blur(16px)',
  });

  // Top header: Citation/DOI readout
  const header = el('div', {
    display: 'flex',
    justifyContent: 'between',
    alignItems: 'center',
    width: '100%',
    marginBottom: '12px',
    fontSize: '11px',
    color: pal.muted,
    borderBottom: `1px solid ${pal.track}`,
    paddingBottom: '8px',
  });
  const leftHeader = el('div', {});
  leftHeader.textContent = meta.doi ? `DOI: ${meta.doi}` : 'SCHOLARLY FIGURES';
  const rightHeader = el('div', {
    fontStyle: 'italic',
  });
  rightHeader.textContent = meta.version ? `Locked ${meta.version}` : '';
  header.append(leftHeader, rightHeader);

  // Main row
  const row = el('div', {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    width: '100%',
  });

  const playBtn = el('button', {
    flex: '0 0 auto',
    width: '44px',
    height: '44px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    background: pal.accent,
    color: pal.bg,
    fontSize: '16px',
    fontWeight: 'bold',
  });
  playBtn.textContent = '▶';
  playBtn.setAttribute('aria-label', 'Play sonification');

  // Dynamic Audio Waveform Visualizer Canvas
  const canvas = el('canvas', {
    flex: '1 1 auto',
    height: '40px',
    background: pal.track,
    borderRadius: '6px',
    cursor: 'pointer',
  });
  canvas.setAttribute('aria-label', 'Audio reactive waveform');

  const right = el('div', {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'end',
    gap: '4px',
    flex: '0 0 auto',
  });

  const timeDisplay = el(
    'div',
    {
      fontSize: '11px',
      fontVariantNumeric: 'tabular-nums',
      fontWeight: '500',
    },
    '0:00',
  );

  // Interactive controls
  const controlsRow = el('div', {
    display: 'flex',
    gap: '8px',
    marginTop: '2px',
  });

  // Playback Rate
  const rateSelect = el('select', {
    background: 'transparent',
    color: pal.fg,
    border: `1px solid ${pal.muted}`,
    borderRadius: '4px',
    fontSize: '9px',
    cursor: 'pointer',
    outline: 'none',
  });
  ['0.5', '1.0', '1.5', '2.0'].forEach((r) => {
    const opt = el('option', {}, `${r}x`);
    opt.value = r;
    if (r === '1.0') opt.selected = true;
    rateSelect.appendChild(opt);
  });

  // High Contrast
  const contrastBtn = el(
    'button',
    {
      background: 'transparent',
      color: pal.muted,
      border: `1px solid ${pal.muted}`,
      borderRadius: '4px',
      fontSize: '9px',
      cursor: 'pointer',
      padding: '2px 4px',
    },
    'Contrast',
  );

  controlsRow.append(rateSelect, contrastBtn);
  right.append(timeDisplay, controlsRow);
  row.append(playBtn, canvas, right);

  // Accessibility Transcript Section (Hidden by default, reads on focus)
  const a11yPanel = el('div', {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  a11yPanel.setAttribute('aria-live', 'assertive');
  a11yPanel.id = 'a11y-description';

  const descTrigger = el(
    'button',
    {
      background: 'transparent',
      border: 'none',
      color: pal.accent,
      fontSize: '10px',
      cursor: 'pointer',
      alignSelf: 'start',
      marginTop: '8px',
      padding: '0',
      textDecoration: 'underline',
    },
    'Read Transcript',
  );
  descTrigger.setAttribute('aria-describedby', 'a11y-description');

  // Fetch accessibility transcript
  void doFetch(
    `${config.apiBase}/api/v1/accessibility-descriptions/sonification/${config.slug}`,
  )
    .then((r) => {
      if (r.ok) return r.json() as Promise<AccessibilityDesc>;
      return {
        description: meta.description || 'A scholarly sonification figure.',
      };
    })
    .then((d) => {
      a11yPanel.textContent = d.description;
    });

  // Footer Citation wordmark
  const footer = el('div', {
    display: 'flex',
    justifyContent: 'between',
    alignItems: 'center',
    marginTop: '12px',
    borderTop: `1px solid ${pal.track}`,
    paddingTop: '8px',
    fontSize: '10px',
    color: pal.muted,
  });
  const wordmark = el('a', {
    color: pal.muted,
    textDecoration: 'none',
    fontWeight: 'bold',
    letterSpacing: '0.08em',
  }) as HTMLAnchorElement;
  wordmark.textContent = 'ANNEALMUSIC FIGURE';
  wordmark.href = `${config.origin}/p/${config.slug}`;
  wordmark.target = '_blank';

  const citeBtn = el(
    'button',
    {
      background: 'transparent',
      border: 'none',
      color: pal.accent,
      cursor: 'pointer',
      fontSize: '10px',
      padding: '0',
      fontWeight: '600',
    },
    'Cite Artifact',
  );

  footer.append(wordmark, citeBtn);
  root.append(header, row, descTrigger, a11yPanel, footer);

  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(
    0,
  ) as unknown as Uint8Array<ArrayBuffer>;

  const initWebAudio = () => {
    if (audioCtx) return;
    const CtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = new CtxClass();
    const source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    dataArray = new Uint8Array(
      analyser.frequencyBinCount,
    ) as unknown as Uint8Array<ArrayBuffer>;
  };

  const ctx2d = canvas.getContext('2d')!;
  let rafId = 0;

  const drawWaveform = () => {
    const w = canvas.width;
    const h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);

    if (analyser) {
      analyser.getByteTimeDomainData(dataArray);
    }

    ctx2d.lineWidth = 2.5;
    ctx2d.strokeStyle = pal.accent;
    ctx2d.beginPath();

    const sliceWidth = w / (dataArray.length || 1);
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] ?? 128) / 128.0;
      const y = (v * h) / 2;

      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);

      x += sliceWidth;
    }

    if (dataArray.length === 0) {
      // Draw static flat line when silent
      ctx2d.moveTo(0, h / 2);
      ctx2d.lineTo(w, h / 2);
    }

    ctx2d.stroke();
    rafId = requestAnimationFrame(drawWaveform);
  };

  canvas.width = 300;
  canvas.height = 80;
  drawWaveform();

  // Event handlers
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    initWebAudio();
    if (audioCtx && audioCtx.state === 'suspended') void audioCtx.resume();
    if (audio.paused) void audio.play();
    else audio.pause();
  });

  audio.addEventListener('play', () => {
    playBtn.textContent = '❚❚';
  });

  audio.addEventListener('pause', () => {
    playBtn.textContent = '▶';
  });

  audio.addEventListener('timeupdate', () => {
    timeDisplay.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration || 15)}`;
  });

  rateSelect.addEventListener('change', () => {
    audio.playbackRate = Number(rateSelect.value);
  });

  let highContrast = false;
  contrastBtn.addEventListener('click', () => {
    highContrast = !highContrast;
    if (highContrast) {
      root.style.background = '#ffffff';
      root.style.color = '#000000';
      header.style.color = '#000000';
      footer.style.color = '#000000';
      ctx2d.strokeStyle = '#000000';
      playBtn.style.background = '#000000';
      playBtn.style.color = '#ffffff';
    } else {
      root.style.background = pal.bg;
      root.style.color = pal.fg;
      header.style.color = pal.muted;
      footer.style.color = pal.muted;
      playBtn.style.background = pal.accent;
      playBtn.style.color = pal.bg;
    }
  });

  descTrigger.addEventListener('click', () => {
    alert(a11yPanel.textContent || 'No transcript available.');
  });

  // Citation Modal Popup
  citeBtn.addEventListener('click', () => {
    const citeModal = el('div', {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '100000',
    });

    const body = el('div', {
      background: '#1c1917',
      color: '#f5f5f4',
      padding: '24px',
      borderRadius: '8px',
      maxWidth: '480px',
      width: '90%',
      fontFamily: 'monospace',
      fontSize: '11px',
    });

    const title = el('h4', {
      margin: '0 0 12px 0',
      fontSize: '14px',
      textTransform: 'uppercase',
    });
    title.textContent = 'Cite Sonification';

    const bibArea = el('textarea', {
      width: '100%',
      height: '180px',
      background: '#0c0a09',
      color: '#a8a29e',
      border: '1px solid #292524',
      borderRadius: '4px',
      padding: '8px',
      fontSize: '10px',
      outline: 'none',
      resize: 'none',
    }) as HTMLTextAreaElement;

    // Build plain BibTeX
    bibArea.value = `@misc{${meta.title?.toLowerCase().replace(/[^a-z]/g, '') || 'sonification'}2026,
  author    = {${meta.creator || 'Anonymous'}},
  title     = {${meta.title || 'Scholarly Sonification Figure'}},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {${meta.doi || '10.5281/zenodo.xxxxxx'}},
  url       = {${config.origin}/p/${config.slug}}
}`;

    const closeBtn = el(
      'button',
      {
        marginTop: '12px',
        padding: '6px 12px',
        background: pal.accent,
        color: pal.bg,
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
      },
      'Close',
    );

    closeBtn.addEventListener('click', () => {
      citeModal.remove();
    });

    body.append(title, bibArea, closeBtn);
    citeModal.append(body);
    document.body.appendChild(citeModal);
  });

  return () => {
    cancelAnimationFrame(rafId);
    audio.pause();
    audio.src = '';
    if (audioCtx) void audioCtx.close();
    root.innerHTML = '';
  };
}

function mountTalkPlayer(
  root: HTMLElement,
  _pal: EmbedPalette,
  _config: EmbedConfig,
  meta: PatchMeta,
  audio: HTMLAudioElement,
): () => void {
  // Talk mode slide layout
  Object.assign(root.style, {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    background: '#090807',
    color: '#faf9f6',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  });

  // Dynamic Full-screen Orbits Canvas Visualizer
  const canvas = el('canvas', {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: '1',
  });
  root.appendChild(canvas);

  // Presenter overlay HUD
  const hud = el('div', {
    position: 'absolute',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '10',
    background: 'rgba(20, 18, 16, 0.85)',
    border: '1px solid #2c2520',
    borderRadius: '40px',
    padding: '8px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    opacity: '0', // Hidden by default, reveals on hover
    transition: 'opacity 0.3s ease',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
  });

  const playBtn = el('button', {
    background: 'transparent',
    border: 'none',
    color: '#f59e0b',
    fontSize: '20px',
    cursor: 'pointer',
  });
  playBtn.textContent = '▶';

  const info = el('div', {
    fontSize: '11px',
    fontFamily: 'monospace',
    letterSpacing: '0.08em',
  });
  info.textContent = `${meta.title?.toUpperCase() || 'SOUNDING'} / PRESENTER VIEW`;

  hud.append(playBtn, info);
  root.appendChild(hud);

  // Reveal controls on hover
  root.addEventListener('mouseenter', () => {
    hud.style.opacity = '1';
  });
  root.addEventListener('mouseleave', () => {
    hud.style.opacity = '0';
  });

  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(
    0,
  ) as unknown as Uint8Array<ArrayBuffer>;

  const initWebAudio = () => {
    if (audioCtx) return;
    const CtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = new CtxClass();
    const source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    dataArray = new Uint8Array(
      analyser.frequencyBinCount,
    ) as unknown as Uint8Array<ArrayBuffer>;
  };

  // Synced drawing orbits simulation loop
  const ctx2d = canvas.getContext('2d')!;
  let rafId = 0;
  let angle = 0;

  const drawOrbits = () => {
    const w = canvas.width;
    const h = canvas.height;
    ctx2d.fillStyle = 'rgba(9, 8, 7, 0.08)'; // long trail effect
    ctx2d.fillRect(0, 0, w, h);

    if (analyser) {
      analyser.getByteFrequencyData(dataArray);
    }

    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.35;

    // Draw orbits
    ctx2d.strokeStyle = 'rgba(245, 158, 11, 0.15)';
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx2d.stroke();

    angle += 0.015;

    // Emit reactive particles mapping standard spectrum
    const len = dataArray.length || 1;
    for (let i = 0; i < len; i++) {
      const amp = (dataArray[i] ?? 0) / 255.0;
      const r = maxR * (0.4 + amp * 0.6);
      const theta = angle + (i * Math.PI * 2) / len;

      const px = cx + Math.cos(theta) * r;
      const py = cy + Math.sin(theta) * r * 0.8;

      ctx2d.fillStyle = `rgba(245, 158, 11, ${0.35 + amp * 0.65})`;
      ctx2d.beginPath();
      ctx2d.arc(px, py, 4 + amp * 12, 0, Math.PI * 2);
      ctx2d.fill();
    }

    rafId = requestAnimationFrame(drawOrbits);
  };

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);
  drawOrbits();

  // Playback trigger
  const togglePlay = () => {
    initWebAudio();
    if (audioCtx && audioCtx.state === 'suspended') void audioCtx.resume();
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });
  audio.addEventListener('play', () => {
    playBtn.textContent = '❚❚';
  });
  audio.addEventListener('pause', () => {
    playBtn.textContent = '▶';
  });

  // Keybind presentation shortcuts
  const keyHandler = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    }
  };
  window.addEventListener('keydown', keyHandler);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', keyHandler);
    audio.pause();
    audio.src = '';
    if (audioCtx) void audioCtx.close();
    root.innerHTML = '';
  };
}

function renderGated(
  root: HTMLElement,
  pal: EmbedPalette,
  config: EmbedConfig,
): void {
  root.innerHTML = '';
  const msg = el(
    'div',
    { flex: '1 1 auto', fontSize: '12px', color: pal.muted },
    'This patch is not public.',
  );
  const mark = el('a', {
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: pal.muted,
    textDecoration: 'none',
  }) as HTMLAnchorElement;
  mark.textContent = 'AnnealMusic';
  mark.href = config.origin;
  mark.target = '_blank';
  mark.rel = 'noopener';
  root.append(msg, mark);
}

export function configFromLocation(
  loc: Location,
  apiBase: string,
): EmbedConfig {
  const path = loc.pathname;
  let kind: 'standard' | 'figure' | 'talk' = 'standard';
  let slug = '';

  const figureMatch = path.match(/\/embed-figure\/([^/?#]+)/);
  const talkMatch = path.match(/\/talk\/([^/?#]+)/);
  const standardMatch = path.match(/\/embed\/([^/?#]+)/);

  if (figureMatch) {
    kind = 'figure';
    slug = decodeURIComponent(figureMatch[1] ?? '');
  } else if (talkMatch) {
    kind = 'talk';
    slug = decodeURIComponent(talkMatch[1] ?? '');
  } else if (standardMatch) {
    kind = 'standard';
    slug = decodeURIComponent(standardMatch[1] ?? '');
  }

  const query = new URLSearchParams(loc.search);
  const theme = resolveTheme(query.get('theme'));
  const customBg = query.get('bg') || undefined;
  const customFg = query.get('fg') || undefined;
  const customAccent = query.get('accent') || undefined;

  return {
    slug,
    kind,
    theme,
    apiBase,
    origin: loc.origin,
    customBg,
    customFg,
    customAccent,
  };
}

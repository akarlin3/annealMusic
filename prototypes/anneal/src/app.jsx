// app.jsx — shell: state context, engine, routing, session logging, tweaks
const { useState: useAS, useEffect: useAE, useRef: useAR, useCallback: useACb, useMemo: useAMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "voice": "meditation",
  "intensity": 1.0,
  "hueShift": 0,
  "typeScale": 1.0,
  "densityScale": 1.0,
  "alwaysShowChrome": false,
  "forceReduceMotion": false
}/*EDITMODE-END*/;

const IMMERSIVE = { listen: true, breathe: true, onboarding: true };

function clampN(v, a, b) { v = Number(v); if (!isFinite(v)) return a; return Math.max(a, Math.min(b, v)); }
function heuristicPatch(prompt) {
  const s = (prompt || '').toLowerCase();
  const p = { rootFreq: 110, spread: 1.0, density: 6, coupling: 0.5, drift: 0.5, brightness: 0.5, space: 0.6, engine: 'sine' };
  if (/bell|glass|metal|chime|crystal|gong/.test(s)) { p.engine = 'fm'; p.spread = 1.5; p.brightness = 0.7; p.drift = 0.6; p.coupling = 0.25; }
  if (/rain|wind|forest|ocean|fire|ember|leaves|tape|grain|dust|sand/.test(s)) { p.engine = 'granular'; p.drift = 0.7; p.brightness = 0.45; }
  if (/string|cello|organ|brass|bow|choir|reed/.test(s)) { p.engine = 'physical'; p.coupling = 0.7; }
  if (/deep|low|dark|bass|sub|trench|cave|fjord|fog/.test(s)) { p.rootFreq = 52; p.brightness = 0.22; }
  if (/bright|high|star|light|shimmer|dawn/.test(s)) { p.rootFreq = 200; p.brightness = 0.72; }
  if (/anx|fast|restless|chaos|storm|sharp|tense/.test(s)) { p.drift = 0.85; p.coupling = 0.2; }
  if (/calm|slow|warm|soft|gentle|rest|sleep|still/.test(s)) { p.drift = 0.3; p.coupling = 0.8; p.space = 0.75; }
  if (/vast|space|cosmic|cathedral|echo|huge|massive|distant/.test(s)) { p.space = 0.9; p.density = 7; }
  const words = (prompt || '').replace(/[^a-z0-9 ]/gi, '').split(/\s+/).filter(Boolean).slice(0, 3);
  p.name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Generated field';
  return p;
}

function usePrefersReducedMotion() {
  const [r, setR] = useAS(false);
  useAE(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches); on();
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const mode = MODE_TOKENS[t.voice] ? t.voice : 'meditation';
  const setMode = useACb((m) => setTweak('voice', m), [setTweak]);
  const sysReduce = usePrefersReducedMotion();
  const reduceMotion = sysReduce || t.forceReduceMotion;

  // routing + onboarding gate
  const onboarded = (() => { try { return localStorage.getItem('am_onboarded') === '1'; } catch (e) { return false; } })();
  const [route, setRoute] = useAS(onboarded ? 'listen' : 'onboarding');
  const navigate = useACb((r) => { setRoute(r); if (IMMERSIVE[r] === undefined) window.scrollTo(0, 0); }, []);
  const finishOnboarding = useACb(() => { try { localStorage.setItem('am_onboarded', '1'); } catch (e) {} }, []);

  // params + engine
  const [params, setParams] = useAS({ ...ENGINE_DEFAULTS });
  const setParam = useACb((k, v) => setParams((p) => ({ ...p, [k]: v })), []);
  const loadParams = useACb((patch) => setParams((p) => ({ ...p, ...patch })), []);
  const engineParams = useAMemo(() => ({ ...params, motionMult: MODE_TOKENS[mode].motionMult }), [params, mode]);
  const engine = useAnnealEngine(engineParams);

  const [nowPlaying, setNowPlaying] = useAS(null);
  const nowPlayingRef = useAR(null);
  useAE(() => { nowPlayingRef.current = nowPlaying; }, [nowPlaying]);
  const previewTimerRef = useAR(null);

  const loadSession = useACb((s, preview = false) => {
    loadParams(s.params);
    if (!preview) {
      setNowPlaying({ title: s.title });
      engine.start();
    } else if (!engine.isPlaying) {
      engine.start();
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => engine.stop(), 7000);
    }
  }, [engine, loadParams]);

  // sessions / history
  const [sessions, setSessions] = useAS(SEED_SESSIONS);
  const forgetSession = useACb((id) => setSessions((ss) => ss.filter((s) => s.id !== id)), []);
  const saveReflection = useACb((id, text) => setSessions((ss) => ss.map((s) => s.id === id ? { ...s, reflection: text } : s)), []);
  const replaySession = useACb((p) => {
    const lib = LIBRARY.find((l) => l.title === p.title);
    if (lib) loadParams(lib.params);
    setNowPlaying({ title: p.title });
    navigate('listen'); engine.start();
  }, [engine, loadParams, navigate]);

  // session logging — records a play when sound stops (honest duration; previews excluded)
  const playRef = useAR(null);
  useAE(() => {
    if (engine.isPlaying && !playRef.current) {
      playRef.current = { t: Date.now(), title: nowPlayingRef.current?.title || 'Open practice', startedAt: new Date().toISOString() };
    } else if (!engine.isPlaying && playRef.current) {
      const mins = (Date.now() - playRef.current.t) / 60000;
      const rec = playRef.current; playRef.current = null;
      if (mins >= 0.2) {
        setSessions((ss) => [{ id: 'p' + Date.now(), title: rec.title, startedAt: rec.startedAt, minutes: mins, reflection: '' }, ...ss]);
      }
    }
  }, [engine.isPlaying]);

  const stats = useAMemo(() => {
    const now = new Date();
    const monthly = sessions.filter((s) => { const d = new Date(s.startedAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const total = sessions.length;
    const totalMin = sessions.reduce((a, s) => a + s.minutes, 0);
    return {
      total, monthCount: monthly.length,
      monthMinutes: monthly.reduce((a, s) => a + s.minutes, 0),
      avgMinutes: total ? totalMin / total : 0,
    };
  }, [sessions]);

  // patches (saved sculpts + AI-generated), persisted
  const [patches, setPatches] = useAS(() => { try { return JSON.parse(localStorage.getItem('am_patches') || '[]'); } catch (e) { return []; } });
  useAE(() => { try { localStorage.setItem('am_patches', JSON.stringify(patches)); } catch (e) {} }, [patches]);
  const savePatch = useACb((name) => {
    const { rootFreq, spread, density, coupling, drift, brightness, space } = params;
    setPatches((ps) => [{ id: 'my' + Date.now(), name, engineId: 'sine', description: 'Saved from your own sculpting.', params: { rootFreq, spread, density, coupling, drift, brightness, space } }, ...ps]);
  }, [params]);
  const deletePatch = useACb((p) => setPatches((ps) => ps.filter((x) => x.id !== p.id)), []);
  const generatePatch = useACb(async (prompt) => {
    let raw = null;
    try {
      if (window.claude && window.claude.complete) {
        const instr = 'You design patches for an ambient drone synthesizer. Reply with ONLY a compact JSON object (no prose, no markdown) with keys: name (a short evocative 1-3 word title), engine (one of "sine","fm","granular","physical"), rootFreq (number 40-260), spread (0.7-1.6), density (integer 3-8), coupling (0-1), drift (0-1), brightness (0-1), space (0-1). Lower coupling = more scattered; higher drift = more pitch wander; higher spread = more bell-like. Description: ' + prompt;
        const txt = await window.claude.complete({ messages: [{ role: 'user', content: instr }] });
        const m = txt && txt.match(/\{[\s\S]*\}/);
        if (m) raw = JSON.parse(m[0]);
      }
    } catch (e) { raw = null; }
    if (!raw || typeof raw.rootFreq !== 'number') raw = heuristicPatch(prompt);
    const params2 = {
      rootFreq: clampN(raw.rootFreq, 40, 260), spread: clampN(raw.spread, 0.7, 1.6),
      density: Math.round(clampN(raw.density, 3, 8)), coupling: clampN(raw.coupling, 0, 1),
      drift: clampN(raw.drift, 0, 1), brightness: clampN(raw.brightness, 0, 1), space: clampN(raw.space, 0, 1),
    };
    const engineId = ENGINES[raw.engine] ? raw.engine : 'sine';
    const rec = { id: 'ai' + Date.now(), name: raw.name || 'Generated field', engineId, description: prompt, params: params2, ai: true };
    setPatches((ps) => [rec, ...ps]);
    loadParams(params2); setNowPlaying({ title: rec.name });
    return rec;
  }, [loadParams]);

  // export modal
  const [exportOpen, setExportOpen] = useAS(false);
  const openExport = useACb(() => setExportOpen(true), []);
  // embed modal
  const [embedTarget, setEmbedTarget] = useAS(null);
  const openEmbed = useACb((item) => setEmbedTarget(item || { title: nowPlayingRef.current?.title || 'Sculpted field', params }), [params]);
  // toast
  const [toastMsg, setToastMsg] = useAS(null);
  const toastTimer = useAR(null);
  const toast = useACb((m) => { setToastMsg(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastMsg(null), 2600); }, []);

  // lesson progress (persisted)
  const [lessonProgress, setLessonProgress] = useAS(() => {
    try { return JSON.parse(localStorage.getItem('am_learn') || '{}'); } catch (e) { return {}; }
  });
  useAE(() => { try { localStorage.setItem('am_learn', JSON.stringify(lessonProgress)); } catch (e) {} }, [lessonProgress]);
  const setLessonStep = useACb((id, step) => setLessonProgress((p) => ({ ...p, [id]: { ...(p[id] || {}), step } })), []);
  const completeLesson = useACb((id, reflections) => setLessonProgress((p) => ({ ...p, [id]: { ...(p[id] || {}), completed: true, reflections } })), []);

  // chrome idle (immersive screens)
  const [chromeActive, setChromeActive] = useAS(true);
  const idleRef = useAR(null);
  useAE(() => {
    const wake = () => { setChromeActive(true); if (idleRef.current) clearTimeout(idleRef.current); idleRef.current = setTimeout(() => setChromeActive(false), 4200); };
    wake();
    window.addEventListener('mousemove', wake); window.addEventListener('keydown', wake); window.addEventListener('touchstart', wake);
    return () => { window.removeEventListener('mousemove', wake); window.removeEventListener('keydown', wake); window.removeEventListener('touchstart', wake); if (idleRef.current) clearTimeout(idleRef.current); };
  }, []);

  // mode vars
  useAE(() => { applyModeVars(document.documentElement, mode, t); }, [mode, t.hueShift, t.typeScale, t.densityScale, t.alwaysShowChrome]);
  // body scroll mode
  useAE(() => { document.body.classList.toggle('immersive-route', !!IMMERSIVE[route]); }, [route]);

  const immersive = !!IMMERSIVE[route];
  const chromeLifted = chromeActive;

  const value = {
    mode, setMode, route, navigate, finishOnboarding,
    params, setParam, loadParams, loadSession, nowPlaying,
    engine, reduceMotion, tweaks: t, setTweak,
    sessions, forgetSession, saveReflection, replaySession, stats,
    lessonProgress, setLessonStep, completeLesson,
    patches, savePatch, deletePatch, generatePatch, openExport, openEmbed, toast,
  };

  const renderScreen = () => {
    switch (route) {
      case 'onboarding': return <OnboardingScreen />;
      case 'breathe': return <BreatheScreen />;
      case 'sounds': return <SoundsScreen />;
      case 'attune': return <AttuneScreen />;
      case 'gallery': return <GalleryScreen />;
      case 'research': return <ResearchScreen />;
      case 'settings': return <SettingsScreen />;
      case 'library': return <LibraryScreen />;
      case 'history': return <HistoryScreen />;
      case 'learn': return <LearnScreen />;
      case 'listen':
      default: return <ListenScreen />;
    }
  };

  return (
    <AppContext.Provider value={value}>
      <div className={'app' + (immersive ? ' immersive' : '') + (chromeLifted ? ' chrome-lifted' : '')} data-mode={mode}>
        {route !== 'onboarding' && <TopNav route={route} navigate={navigate} mode={mode} setMode={setMode} immersive={immersive} />}
        <main className="screen-host">{renderScreen()}</main>
        <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
        <EmbedModal open={!!embedTarget} item={embedTarget} onClose={() => setEmbedTarget(null)} />
        {toastMsg && <div className="toast font-mono">{toastMsg}</div>}
        <TweaksPanel>
          <TweakSection label="Voice" />
          <TweakRadio label="Mode" value={t.voice} options={['meditation', 'musician', 'researcher']} onChange={(v) => setTweak('voice', v)} />
          <TweakSection label="Field" />
          <TweakSlider label="Visualizer intensity" value={t.intensity} min={0.4} max={1.8} step={0.05} onChange={(v) => setTweak('intensity', v)} />
          <TweakSlider label="Accent hue shift" value={t.hueShift} min={-14} max={14} step={1} unit="°" onChange={(v) => setTweak('hueShift', v)} />
          <TweakSection label="Type & space" />
          <TweakSlider label="Type scale" value={t.typeScale} min={0.85} max={1.25} step={0.01} unit="×" onChange={(v) => setTweak('typeScale', v)} />
          <TweakSlider label="Density" value={t.densityScale} min={0.85} max={1.2} step={0.01} unit="×" onChange={(v) => setTweak('densityScale', v)} />
          <TweakSection label="Calm" />
          <TweakToggle label="Always show controls" value={t.alwaysShowChrome} onChange={(v) => setTweak('alwaysShowChrome', v)} />
          <TweakToggle label="Reduce motion" value={t.forceReduceMotion} onChange={(v) => setTweak('forceReduceMotion', v)} />
          <TweakButton label="Replay first-run" onClick={() => { try { localStorage.removeItem('am_onboarded'); } catch (e) {} navigate('onboarding'); }} />
        </TweaksPanel>
      </div>
    </AppContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

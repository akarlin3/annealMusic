import React, { useState, useEffect, useRef } from 'react';
import { ScriptEditor } from './ScriptEditor';
import { REPL } from './REPL';
import { PyodideWorker, WorkerInitStatus } from './PyodideWorker';
import { JSBridgeSync } from './bridge';
import { BridgeClient } from '../bridge/BridgeClient';
import { FileText, Code2, Save, FileImage } from 'lucide-react';
import { VFSPanel } from './vfsPanel';

const DEFAULT_SCRIPT = `import anneal
import time
import numpy as np

print("Meta version:", anneal.version())
state = anneal.state.get()
print("Starting parameter sculpt sweep on engine:", state["engineId"])

# Parametric sweep
for i in range(10):
    val = 0.3 + (i * 0.05)
    anneal.state.set({"brightness": val, "drift": 0.2})
    print(f"Step {i}: brightness set to {val:.2f}")
    time.sleep(0.2)

print("Sculpt sweep complete ✅")
`;

const EXAMPLES = [
  {
    name: 'Parameter Sweep',
    desc: 'Modulate brightness and drift slowly over a linear sweep.',
    code: `import anneal
import time

print("Running Brightness Modulation Sweep...")
for i in range(10):
    brightness = 0.2 + (i * 0.07)
    anneal.state.set({"brightness": brightness, "drift": 0.1})
    print(f"Log step {i}: Brightness set to {brightness:.3f}")
    time.sleep(0.15)
print("Sweep completed!")
`,
  },
  {
    name: 'Coupled Coherence Audit',
    desc: 'Verify Phase Coherence r(t) by auditing datalog ticks.',
    code: `import anneal
import time
import numpy as np

print("Activating Couple Coherence Audit...")
anneal.datalog.start("standard")
time.sleep(0.5)

snapshot = anneal.datalog.snapshot()
print(f"Captured {len(snapshot)} datalog ticks from ring buffer.")

if len(snapshot) > 0:
    # Read the drift coherence order parameter from ticks
    coherences = [t["drift"]["orderParameter"] for t in snapshot if "drift" in t]
    if coherences:
        mean_coh = np.mean(coherences)
        print(f"Coupling Coherence r(t) -> Mean: {mean_coh:.3f}, Max: {np.max(coherences):.3f}")
    else:
        print("Coherence data absent.")
else:
    print("Ring buffer empty. Ensure audio session is started.")

anneal.datalog.stop()
`,
  },
  {
    name: 'Drone Frequency Drift',
    desc: 'Generate slow complex frequency drifts on custom partials.',
    code: `import anneal
import time
import math

print("Injecting organic micro-drifts...")
for step in range(15):
    # Compute sine-modulated frequency drift
    root = 110.0 + 5.0 * math.sin(step * 0.5)
    anneal.state.set({"rootFreq": int(root)})
    print(f"Modulate step {step}: root carrier frequency set to {root:.2f} Hz")
    time.sleep(0.1)
print("Organic drift cycle complete.")
`,
  },
  {
    name: 'Consonance Rating Study',
    desc: 'Auditory perception experiment to rate perfect fifth vs tritone dyad pleasantness.',
    code: `import anneal
from anneal.experiment import Experiment, Stimulus, LikertResponse, Block, DemographicSurvey

# 1. Define perfect fifth vs tritone stimuli
dyads = [
    Stimulus(id="perfect_fifth", patch={"engine": "sine", "rootFreq": 150, "brightness": 0.5}, duration=2.5),
    Stimulus(id="tritone", patch={"engine": "sine", "rootFreq": 150, "brightness": 0.8}, duration=2.5),
]

# 2. Compile into a randomized block
consonance_block = Block(
    name="Auditory Consonance Rating",
    trials=[
        {"stimulus": dyads[0], "response": LikertResponse(prompt="Rate the pleasantness of this perfect fifth dyad:", scale=7)},
        {"stimulus": dyads[1], "response": LikertResponse(prompt="Rate the pleasantness of this tritone dyad:", scale=7)},
    ],
    randomize="full"
)

# 3. Assemble and launch experiment
exp = Experiment(
    title="Dyad Consonance Perception Study",
    description="A scientific perceptual study investigating consonant vs dissonant intervals.",
    consent_text="Click accept to participate in this brief, non-invasive auditory perception study...",
    debrief_text="Thank you for participating! Your responses help us analyze pitch ratio pleasantness."
)
exp.add_demographics(DemographicSurvey(["age", "musical_experience"]))
exp.add_block(consonance_block)

print("Registering Consonance Rating Study...")
exp.run()
`,
  },
  {
    name: 'Brightness Tuning Study',
    desc: 'Tuning experiment where subjects match continuous slider values against synthesizer states.',
    code: `import anneal
from anneal.experiment import Experiment, Stimulus, AdjustValue, Block, DemographicSurvey

# 1. Define stimuli
stimuli = [
    Stimulus(id="dark_drone", patch={"engine": "waveguide", "brightness": 0.2, "drift": 0.1}, duration=5.0),
    Stimulus(id="bright_drone", patch={"engine": "waveguide", "brightness": 0.8, "drift": 0.1}, duration=5.0),
]

# 2. Define block
match_block = Block(
    name="Synthesizer Brightness Matching",
    trials=[
        {"stimulus": stimuli[0], "response": AdjustValue(prompt="Tweak brightness to match the dark drone profile:", range=[0.0, 1.0], step=0.01, target_param="brightness")},
        {"stimulus": stimuli[1], "response": AdjustValue(prompt="Tweak brightness to match the bright drone profile:", range=[0.0, 1.0], step=0.01, target_param="brightness")},
    ],
    randomize="full"
)

# 3. Assemble
exp = Experiment(
    title="Spectral Brightness Matching Task",
    description="A tuning task to measure continuous parameter adjustments against synthetic models.",
    consent_text="Click accept to participate in the parameter calibration match study...",
    debrief_text="Tuning study completed successfully! Your data records have been generated."
)
exp.add_demographics(DemographicSurvey(["age", "hearing_loss"]))
exp.add_block(match_block)

print("Registering Brightness Tuning Study...")
exp.run()
`,
  },
];

export const ScriptingPanel: React.FC = () => {
  const [code, setCode] = useState(DEFAULT_SCRIPT);
  const [scriptName, setScriptName] = useState('param_sweep.py');
  const [initStatus, setInitStatus] = useState<WorkerInitStatus>({
    stage: 'loading',
    progress: 0,
  });
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stdout, setStdout] = useState<string>('');
  interface UserScript {
    id: string;
    name: string;
    source: string;
    language: string;
    visibility: string;
  }

  const [savedScripts, setSavedScripts] = useState<UserScript[]>([]);

  const [preloadScientific, setPreloadScientific] = useState<boolean>(() => {
    return localStorage.getItem('am_scientific_env_preload') === 'true';
  });

  const [plots, setPlots] = useState<string[]>([]);
  const [activePlotTab, setActivePlotTab] = useState<number>(-1);
  const [runTrigger, setRunTrigger] = useState<number>(0);

  const handlePlotRender = (bytes: number[]) => {
    const uint8 = new Uint8Array(bytes);
    const blob = new Blob([uint8], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    setPlots((prev) => [...prev, url]);
    setActivePlotTab((prev) => prev + 1);
  };

  const handleClearPlots = () => {
    plots.forEach((url) => URL.revokeObjectURL(url));
    setPlots([]);
    setActivePlotTab(-1);
  };

  const workerRef = useRef<PyodideWorker | null>(null);
  const syncRef = useRef<JSBridgeSync | null>(null);
  const clientRef = useRef<BridgeClient | null>(null);
  const pendingRunRef = useRef<boolean>(false);

  useEffect(() => {
    clientRef.current = new BridgeClient();

    // Fetch saved user scripts from backend
    fetchSavedScripts();

    return () => {
      if (syncRef.current) syncRef.current.stop();
      if (workerRef.current) workerRef.current.terminate();
      if (clientRef.current) clientRef.current.close();
    };
  }, []);

  // Cleanup plots on unmount
  useEffect(() => {
    return () => {
      plots.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [plots]);

  const fetchSavedScripts = async () => {
    try {
      const response = await fetch('/api/v1/scripts/me', {
        headers: { 'x-anon-id': localStorage.getItem('am_anon_id') || '' },
      });
      if (response.ok) {
        const data = await response.json();
        setSavedScripts(data.items || []);
      }
    } catch {
      // Safe fallback: localStorage
      const local = localStorage.getItem('am_user_scripts');
      if (local) setSavedScripts(JSON.parse(local));
    }
  };

  const handleInitializeWorker = (runOnReady = false) => {
    if (isInitializing || isWorkerReady) return;

    if (runOnReady) {
      pendingRunRef.current = true;
    }

    setIsInitializing(true);
    setInitStatus({ stage: 'loading', progress: 0.1 });

    const worker = new PyodideWorker();
    workerRef.current = worker;

    worker.init((status) => {
      setInitStatus(status);
      if (status.stage === 'ready') {
        setIsWorkerReady(true);
        setIsInitializing(false);

        // Start bridge synchronization (streams spectrum at 50Hz)
        if (clientRef.current) {
          const sync = new JSBridgeSync(worker, clientRef.current);
          syncRef.current = sync;
          sync.start();
        }

        // Register interactive matplotlib plot callback
        worker.onPlotRender(handlePlotRender);

        // Register experiment registration bridge listener
        worker.onExperimentRegistered((expDef) => {
          localStorage.setItem('am_preview_experiment', JSON.stringify(expDef));
          if (
            window.confirm(
              `Experiment "${expDef.title}" compiled and registered successfully! Would you like to launch the Preview Runner in a new tab to test it?`,
            )
          ) {
            window.open('/experiment/preview', '_blank');
          }
        });

        // Trigger pending run if requested
        if (pendingRunRef.current) {
          pendingRunRef.current = false;
          setTimeout(() => {
            handleRunScript();
          }, 50);
        }
      } else if (status.stage === 'error') {
        setIsInitializing(false);
        pendingRunRef.current = false;
      }
    }, preloadScientific);
  };

  const handleRunScript = async () => {
    // 1. Lazy initialize worker if not ready
    if (!isWorkerReady) {
      handleInitializeWorker(true);
      return;
    }

    // Clear old plots on fresh run
    handleClearPlots();

    setIsRunning(true);
    setStdout('');

    await workerRef.current!.run(
      code,
      (text) => setStdout((prev) => prev + text),
      (err) => setStdout((prev) => prev + err),
    );

    setIsRunning(false);
    setRunTrigger((prev) => prev + 1);
  };

  const handleStopScript = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      setIsRunning(false);
      setStdout((prev) => prev + '\n[Execution Interrupted by User] ✖\n');

      // Re-register bridge synchronizer
      if (clientRef.current && workerRef.current) {
        if (syncRef.current) syncRef.current.stop();
        const sync = new JSBridgeSync(workerRef.current, clientRef.current);
        syncRef.current = sync;
        sync.start();
      }
    }
  };

  const handleSaveScript = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/scripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-anon-id': localStorage.getItem('am_anon_id') || '',
        },
        body: JSON.stringify({
          name: scriptName,
          source: code,
          language: 'python',
          visibility: 'private',
        }),
      });

      if (response.ok) {
        fetchSavedScripts();
      } else {
        throw new Error();
      }
    } catch {
      // Save locally
      const local = localStorage.getItem('am_user_scripts');
      const list = local ? JSON.parse(local) : [];
      const updated = [
        {
          id: Math.random().toString(),
          name: scriptName,
          source: code,
          language: 'python',
          visibility: 'private',
        },
        ...list,
      ];
      localStorage.setItem('am_user_scripts', JSON.stringify(updated));
      setSavedScripts(updated);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadScript = (s: UserScript) => {
    setCode(s.source);
    setScriptName(s.name);
  };

  const handleExecuteRepl = async (command: string) => {
    if (!isWorkerReady) {
      // Lazy load but don't auto-trigger a full script run
      handleInitializeWorker(false);
      return {
        success: false,
        error: 'Python environment is cold. Starting boot sequence...',
      };
    }

    return await workerRef.current!.repl(
      command,
      (text) => setStdout((prev) => prev + text),
      (err) => setStdout((prev) => prev + err),
    );
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden max-h-[85vh]">
      {/* Workspace Panel (Editor + Terminal Console) */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        {/* Editor Container with Overlay */}
        <div className="flex-1 relative flex flex-col overflow-hidden">
          <ScriptEditor
            code={code}
            onChange={setCode}
            onRun={handleRunScript}
            onStop={handleStopScript}
            onSave={handleSaveScript}
            onReset={() => setCode(DEFAULT_SCRIPT)}
            isRunning={isRunning}
            isSaving={isSaving}
            scriptName={scriptName}
            onScriptNameChange={setScriptName}
          />

          {isInitializing && (
            <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-md flex flex-col items-center justify-center rounded-xl z-20 p-8 text-center">
              <div className="relative flex items-center justify-center mb-6">
                <div className="h-16 w-16 rounded-full border-2 border-stone-850 border-t-amber-500 animate-spin" />
                <Code2
                  size={20}
                  className="absolute text-amber-500 animate-pulse"
                />
              </div>
              <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-stone-300">
                Initializing Python Environment...
              </h2>
              <div className="w-48 bg-stone-900 h-1 rounded-full overflow-hidden mt-3 border border-stone-850">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(initStatus.progress || 0.1) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-stone-500 font-mono mt-2 uppercase tracking-widest">
                {initStatus.progress &&
                initStatus.progress > 0.5 &&
                preloadScientific
                  ? 'loading scipy + pandas + matplotlib + sklearn from CDN...'
                  : 'loading wasm runtime + numpy from CDN...'}
              </p>
            </div>
          )}
        </div>

        {/* Environment Status & Preferences Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 border border-stone-900 bg-stone-900/10 rounded-xl select-none">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isWorkerReady
                  ? 'bg-emerald-500 shadow-md shadow-emerald-500/50'
                  : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
              {isWorkerReady
                ? 'Environment: Ready (SciPy + NumPy loaded)'
                : 'Environment: Cold (Will initialize on first run)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="preload-scientific-toggle"
              type="checkbox"
              checked={preloadScientific}
              onChange={(e) => {
                const val = e.target.checked;
                setPreloadScientific(val);
                localStorage.setItem('am_scientific_env_preload', String(val));
              }}
              className="w-4.5 h-4.5 rounded border-stone-850 bg-stone-950 text-amber-500 focus:ring-amber-500/20 focus:ring-2 focus:ring-offset-0 cursor-pointer"
            />
            <label
              htmlFor="preload-scientific-toggle"
              className="text-[10px] text-stone-400 font-mono tracking-wider cursor-pointer hover:text-stone-300 transition-colors uppercase"
            >
              Preload Scientific Environment
            </label>
          </div>
        </div>

        {/* Stdout Console Stream Output */}
        <div className="h-40 flex flex-col border border-stone-900 bg-stone-950/20 rounded-xl overflow-hidden shadow-xl">
          <div className="px-4 py-2 border-b border-stone-900 bg-stone-900/20 flex justify-between items-center select-none">
            <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-semibold">
              Console Output (stdout/stderr)
            </span>
            <button
              onClick={() => setStdout('')}
              className="text-[9px] uppercase tracking-widest font-mono text-stone-600 hover:text-stone-400"
            >
              Clear
            </button>
          </div>
          <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] text-stone-300 leading-relaxed bg-stone-950/60 scrollbar-thin select-text">
            {stdout ? (
              <pre className="whitespace-pre-wrap break-all">{stdout}</pre>
            ) : (
              <span className="text-stone-700 italic select-none">
                Script outputs will be piped here...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sidebars Controls (REPL + Plots + VFS + Examples Library) */}
      <div className="w-full md:w-80 flex flex-col gap-6 overflow-y-auto max-h-[85vh] scrollbar-thin pb-4">
        {/* Plots Display Card */}
        {plots.length > 0 && (
          <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-4 flex flex-col gap-3 shadow-lg select-none">
            <div className="flex justify-between items-center border-b border-stone-900 pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <FileImage size={14} className="text-amber-500" />
                Matplotlib Plots ({plots.length})
              </span>
              <button
                onClick={handleClearPlots}
                className="text-[9px] uppercase tracking-widest font-mono text-stone-600 hover:text-stone-400 transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Tabs header */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
              {plots.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePlotTab(idx)}
                  className={`px-2 py-1 text-[9px] font-mono rounded transition-all border ${
                    activePlotTab === idx
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 font-semibold'
                      : 'bg-stone-950/30 border-stone-900/50 text-stone-500 hover:text-stone-400 hover:border-stone-800'
                  }`}
                >
                  Fig {idx + 1}
                </button>
              ))}
            </div>

            {/* Active plot canvas image */}
            <div className="flex items-center justify-center border border-stone-900/50 bg-stone-950/40 rounded-lg overflow-hidden p-2">
              <img
                src={plots[activePlotTab]}
                alt={`Matplotlib plot figure ${activePlotTab + 1}`}
                className="max-w-full max-h-[220px] object-contain rounded"
              />
            </div>
          </div>
        )}

        {/* VFS Panel component */}
        <VFSPanel
          worker={workerRef.current}
          isWorkerReady={isWorkerReady}
          runTrigger={runTrigger}
        />

        <REPL
          onExecute={handleExecuteRepl}
          onClearOutput={() => setStdout('')}
        />

        {/* Examples Card */}
        <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-4 flex flex-col gap-3 shadow-lg select-none">
          <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
            <FileText size={14} className="text-amber-500" />
            Example Scripts
          </span>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                onClick={() => {
                  setCode(ex.code);
                  setScriptName(
                    `${ex.name.toLowerCase().replace(/ /g, '_')}.py`,
                  );
                }}
                className="text-left p-2.5 rounded bg-stone-950/60 border border-stone-900/50 hover:border-amber-500/20 hover:bg-stone-900/20 transition-all flex flex-col gap-1"
              >
                <span className="text-[10px] font-mono font-semibold text-stone-300">
                  {ex.name}
                </span>
                <span className="text-[9px] font-mono text-stone-500 leading-relaxed">
                  {ex.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Saved Library Card */}
        {savedScripts.length > 0 && (
          <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-4 flex flex-col gap-3 shadow-lg select-none">
            <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <Save size={14} className="text-amber-500" />
              Saved Library
            </span>
            <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto scrollbar-thin">
              {savedScripts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleLoadScript(s)}
                  className="text-left p-2 rounded bg-stone-950/30 border border-stone-900/50 hover:border-amber-500/20 transition-all flex items-center justify-between"
                >
                  <span className="text-[10px] font-mono text-stone-400 truncate">
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

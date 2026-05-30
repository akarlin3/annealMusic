import React, { useState, useEffect, useRef } from 'react';
import { ScriptEditor } from './ScriptEditor';
import { REPL } from './REPL';
import { PyodideWorker, WorkerInitStatus } from './PyodideWorker';
import { JSBridgeSync } from './bridge';
import { BridgeClient } from '../bridge/BridgeClient';
import { FileText, Code2, CloudLightning, Save } from 'lucide-react';

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

  const workerRef = useRef<PyodideWorker | null>(null);
  const syncRef = useRef<JSBridgeSync | null>(null);
  const clientRef = useRef<BridgeClient | null>(null);

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

  const handleInitializeWorker = () => {
    if (isInitializing || isWorkerReady) return;

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
      } else if (status.stage === 'error') {
        setIsInitializing(false);
      }
    });
  };

  const handleRunScript = async () => {
    // 1. Lazy initialize worker if not ready
    if (!isWorkerReady) {
      handleInitializeWorker();
      // Block run until initialization completes
      return;
    }

    setIsRunning(true);
    setStdout('');

    await workerRef.current!.run(
      code,
      (text) => setStdout((prev) => prev + text),
      (err) => setStdout((prev) => prev + err),
    );

    setIsRunning(false);
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
      // Lazy load
      handleInitializeWorker();
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
        {/* Cold initialization layer */}
        {!isWorkerReady && !isInitializing ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-stone-900 bg-stone-900/10 rounded-xl p-8 text-center backdrop-blur-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/5 text-amber-500/40 ring-1 ring-amber-500/10 mb-4 animate-bounce">
              <Code2 size={24} />
            </div>
            <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-stone-200">
              Cold Python Environment
            </h2>
            <p className="text-xs text-stone-500 font-mono mt-1 max-w-sm">
              Pyodide loads standard scientific runtimes in WebAssembly locally.
              Boots in ~3 seconds on first execution.
            </p>
            <button
              onClick={handleInitializeWorker}
              className="mt-4 px-4 py-2 rounded-lg bg-amber-500 text-stone-950 font-mono text-xs uppercase tracking-wider font-semibold hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/10"
            >
              <CloudLightning size={14} />
              Initialize Python
            </button>
          </div>
        ) : isInitializing ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-stone-900 bg-stone-900/10 rounded-xl p-8 text-center backdrop-blur-md">
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
              loading wasm runtime + numpy from CDN...
            </p>
          </div>
        ) : (
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
        )}

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

      {/* Sidebars Controls (REPL + Examples Library) */}
      <div className="w-full md:w-80 flex flex-col gap-6 overflow-hidden max-h-[85vh]">
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

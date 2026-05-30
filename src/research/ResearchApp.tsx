/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { BridgeClient } from './bridge/BridgeClient';
import { OSCPanel } from './osc/OSCPanel';
import {
  Activity,
  Terminal,
  Shield,
  Cpu,
  Database,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Award,
} from 'lucide-react';

interface RpcLog {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'notification' | 'error';
  direction: 'in' | 'out';
  method: string;
  payload: any;
  durationMs?: number;
}

export function ResearchApp() {
  const [activeTab, setActiveTab] = useState<
    'telemetry' | 'osc' | 'cli' | 'datalogger' | 'scripting' | 'experiments'
  >('telemetry');
  const [logs, setLogs] = useState<RpcLog[]>([]);
  const [healthStatus, setHealthStatus] = useState<'ok' | 'offline'>('offline');
  const [healthTime, setHealthTime] = useState<string>('');
  const [versions, setVersions] = useState<any>(null);

  // Sculpt values
  const [rootFreq, setRootFreq] = useState<number>(110);
  const [brightness, setBrightness] = useState<number>(0.5);
  const [space, setSpace] = useState<number>(0.4);
  const [engineId, setEngineId] = useState<string>('sine');
  const [sessionStatus, setSessionStatus] = useState<string>('idle');

  const clientRef = useRef<BridgeClient | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestStartTimes = useRef<Map<number, number>>(new Map());

  // Setup client and BroadcastChannel connection
  useEffect(() => {
    const client = new BridgeClient();
    clientRef.current = client;

    // Fetch versions
    client
      .getVersion()
      .then((v) => setVersions(v))
      .catch(() => {});

    // Monitor health
    const healthInterval = setInterval(() => {
      client
        .health()
        .then((h) => {
          setHealthStatus(h.status);
          setHealthTime(new Date(h.timestamp).toLocaleTimeString());
        })
        .catch(() => {
          setHealthStatus('offline');
        });
    }, 2000);

    // Subscribe to param state changes
    let subId = '';
    client
      .subscribe(['params', 'engineId'], (update) => {
        // Add RPC log notification
        addLog('notification', 'in', 'anneal.state.onChange', update);

        if (update.key === 'params') {
          if (update.value.rootFreq) setRootFreq(update.value.rootFreq);
          if (update.value.brightness) setBrightness(update.value.brightness);
          if (update.value.space) setSpace(update.value.space);
        } else if (update.key === 'engineId') {
          setEngineId(update.value);
        }
      })
      .then((id) => {
        subId = id;
      })
      .catch(() => {});

    // Monitor session status
    const statusInterval = setInterval(() => {
      client
        .getSessionStatus()
        .then((s) => {
          setSessionStatus(s.status);
        })
        .catch(() => {});
    }, 1000);

    // RPC Logger Hooking: Intercept client calls to log them
    const originalCall = (client as any).call;
    (client as any).call = function (method: string, params?: any) {
      const id = this.nextId;
      requestStartTimes.current.set(id, performance.now());

      addLog('request', 'out', method, params);

      return originalCall.call(this, method, params).then(
        (result: any) => {
          const start = requestStartTimes.current.get(id);
          const dur = start ? performance.now() - start : undefined;
          requestStartTimes.current.delete(id);
          addLog('response', 'in', method, result, dur);
          return result;
        },
        (error: any) => {
          const start = requestStartTimes.current.get(id);
          const dur = start ? performance.now() - start : undefined;
          requestStartTimes.current.delete(id);
          addLog('error', 'in', method, { message: error.message }, dur);
          throw error;
        },
      );
    };

    return () => {
      clearInterval(healthInterval);
      clearInterval(statusInterval);
      if (subId) {
        client.unsubscribe(subId).catch(() => {});
      }
      client.close();
    };
  }, []);

  // FFT Canvas drawing loop
  useEffect(() => {
    let active = true;
    let animFrame = 0;

    const draw = () => {
      if (!active) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const client = clientRef.current;

      if (canvas && ctx && client && sessionStatus !== 'idle') {
        client
          .getSpectrum()
          .then((res) => {
            const data = res.spectrum;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.15)'; // glowing amber
            ctx.strokeStyle = '#f59e0b'; // amber-500
            ctx.lineWidth = 1.5;

            const barWidth = canvas.width / data.length;
            ctx.beginPath();
            for (let i = 0; i < data.length; i++) {
              const x = i * barWidth;
              const val = data[i] ?? 0;
              const y = canvas.height - (val / 255) * canvas.height;
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          })
          .catch(() => {});
      } else if (canvas && ctx) {
        // Clear canvas if offline or idle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1c1917'; // stone-900
        ctx.font = '10px monospace';
        ctx.fillText('AUDIO TIMELINE IDLE — NO SIGNAL', 10, 25);
      }

      animFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      active = false;
      cancelAnimationFrame(animFrame);
    };
  }, [sessionStatus]);

  const addLog = (
    type: RpcLog['type'],
    direction: RpcLog['direction'],
    method: string,
    payload: any,
    durationMs?: number,
  ) => {
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        type,
        direction,
        method,
        payload,
        durationMs,
      },
      ...prev.slice(0, 49), // cap at 50 logs
    ]);
  };

  const handleStartSession = () => {
    clientRef.current?.startSession().catch(() => {});
  };

  const handleStopSession = () => {
    clientRef.current?.stopSession().catch(() => {});
  };

  const handleSetEngine = (id: string) => {
    clientRef.current?.setEngine(id).catch(() => {});
  };

  const handleParamChange = (key: string, val: number) => {
    clientRef.current?.setState({ [key]: val }).catch(() => {});
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(logs, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', 'annealmusic_rpc_telemetry.json');
    dlAnchorElem.click();
  };

  return (
    <div className="w-full h-full flex flex-col bg-stone-950 text-stone-100 min-h-screen overflow-hidden">
      {/* Premium Glassmorphic Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-stone-900 bg-stone-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <Cpu size={20} strokeWidth={1.5} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-mono uppercase tracking-wider font-semibold text-stone-200">
              Research Interface console
            </h1>
            <p className="text-[10px] text-stone-500 font-mono">
              BRIDGE v{versions?.bridge || '1.0'} | SCHEMA{' '}
              {versions?.schema || 'v20'}
            </p>
          </div>
        </div>

        {/* Liveness Health Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-stone-900 bg-stone-900/30">
            <span
              className={`h-2 w-2 rounded-full ${healthStatus === 'ok' ? 'bg-emerald-500 shadow-md shadow-emerald-500/50 animate-ping' : 'bg-rose-500'}`}
            />
            <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">
              {healthStatus === 'ok'
                ? `health sync: ok (${healthTime})`
                : 'health sync: offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Tabs Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-64 border-r border-stone-900 bg-stone-900/10 flex flex-col p-4 gap-1 select-none">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-mono tracking-wider transition-all ${
              activeTab === 'telemetry'
                ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
                : 'text-stone-400 hover:bg-stone-900/50 hover:text-stone-200'
            }`}
          >
            <Activity size={16} />
            Telemetry Logs
          </button>
          <button
            onClick={() => setActiveTab('osc')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-mono tracking-wider transition-all ${
              activeTab === 'osc'
                ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
                : 'text-stone-400 hover:bg-stone-900/50 hover:text-stone-200'
            }`}
          >
            <Terminal size={16} />
            OSC Bridge
          </button>
          <button
            onClick={() => setActiveTab('cli')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-mono tracking-wider transition-all ${
              activeTab === 'cli'
                ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
                : 'text-stone-400 hover:bg-stone-900/50 hover:text-stone-200'
            }`}
          >
            <Award size={16} />
            CLI Helper
          </button>
          <button
            onClick={() => setActiveTab('datalogger')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-mono tracking-wider transition-all ${
              activeTab === 'datalogger'
                ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
                : 'text-stone-400 hover:bg-stone-900/50 hover:text-stone-200'
            }`}
          >
            <Database size={16} />
            Datalogger
          </button>
          <button
            onClick={() => setActiveTab('scripting')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-mono tracking-wider transition-all ${
              activeTab === 'scripting'
                ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
                : 'text-stone-400 hover:bg-stone-900/50 hover:text-stone-200'
            }`}
          >
            <Cpu size={16} />
            Scripting Console
          </button>
          <button
            onClick={() => setActiveTab('experiments')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-mono tracking-wider transition-all ${
              activeTab === 'experiments'
                ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
                : 'text-stone-400 hover:bg-stone-900/50 hover:text-stone-200'
            }`}
          >
            <Shield size={16} />
            Experiments
          </button>
        </nav>

        {/* Content Pane */}
        <main className="flex-1 overflow-hidden flex flex-col p-6 gap-6 bg-stone-950">
          {activeTab === 'telemetry' && (
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6">
              {/* Telemetry Log panel */}
              <div className="flex-1 flex flex-col border border-stone-900 bg-stone-900/10 rounded-xl overflow-hidden shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-900 bg-stone-900/20">
                  <span className="text-xs font-mono uppercase tracking-wider text-stone-400">
                    Live RPC Stream ({logs.length} logs captured)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={clearLogs}
                      className="p-1.5 rounded bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
                      title="Clear console log history"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={exportLogs}
                      className="p-1.5 rounded bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
                      title="Export logs to JSON"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-2 scrollbar-thin">
                  {logs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-stone-600 select-none">
                      WAITING FOR RPC TRAFFIC OVER BROADCASTCHANNEL...
                    </div>
                  ) : (
                    logs.map((log) => {
                      let color = 'text-stone-400';
                      let label = '';
                      if (log.type === 'request') {
                        color = 'text-amber-400 bg-amber-950/20';
                        label = '→ REQ';
                      } else if (log.type === 'response') {
                        color = 'text-emerald-400 bg-emerald-950/20';
                        label = '← RES';
                      } else if (log.type === 'notification') {
                        color = 'text-sky-400 bg-sky-950/20';
                        label = '📡 NTF';
                      } else if (log.type === 'error') {
                        color = 'text-rose-400 bg-rose-950/20';
                        label = '✖ ERR';
                      }

                      return (
                        <div
                          key={log.id}
                          className={`p-2.5 rounded border border-stone-900/50 flex flex-col gap-1 transition-all ${color}`}
                        >
                          <div className="flex items-center justify-between border-b border-stone-900/30 pb-1">
                            <span className="font-semibold">
                              {label}: {log.method}
                            </span>
                            <div className="flex items-center gap-2 text-[9px] text-stone-500">
                              {log.durationMs !== undefined && (
                                <span className="bg-stone-900 px-1 py-0.5 rounded text-[10px] text-stone-400">
                                  {log.durationMs.toFixed(1)}ms
                                </span>
                              )}
                              <span>{log.timestamp}</span>
                            </div>
                          </div>
                          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[10px]">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* State quick sculpt panel */}
              <div className="w-full md:w-80 flex flex-col gap-6">
                {/* Visualizer FFT signal panel */}
                <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                  <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-2">
                    <Activity size={14} className="text-amber-500" />
                    Emergent spectrum bridge
                  </span>
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={100}
                    className="w-full h-[100px] bg-stone-950 rounded-lg border border-stone-900"
                  />
                </div>

                <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-4 flex flex-col gap-4 shadow-lg">
                  <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-2">
                    <Cpu size={14} className="text-amber-500" />
                    Quick Sculpt Actions
                  </span>

                  {/* Engine lifecycle */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-stone-500">
                      Session state ({sessionStatus})
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleStartSession}
                        disabled={sessionStatus !== 'idle'}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono uppercase bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <Play size={12} fill="currentColor" />
                        Start
                      </button>
                      <button
                        onClick={handleStopSession}
                        disabled={sessionStatus === 'idle'}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono uppercase bg-stone-900 border border-stone-850 hover:bg-stone-850 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <Square size={12} fill="currentColor" />
                        Stop
                      </button>
                    </div>
                  </div>

                  {/* Engine Id selector */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-stone-500">
                      Active synthesizer
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['sine', 'waveguide', 'bowed', 'pulse'].map((id) => (
                        <button
                          key={id}
                          onClick={() => handleSetEngine(id)}
                          className={`py-1.5 rounded font-mono text-[10px] uppercase transition-all ${
                            engineId === id
                              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold'
                              : 'bg-stone-900 border border-stone-900 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scopes */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-stone-400">Root Frequency</span>
                        <span className="text-amber-500">{rootFreq} Hz</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="400"
                        step="1"
                        value={rootFreq}
                        onChange={(e) =>
                          handleParamChange('rootFreq', Number(e.target.value))
                        }
                        className="w-full h-1 bg-stone-900 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-stone-400">Brightness</span>
                        <span className="text-amber-500">
                          {(brightness * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={brightness}
                        onChange={(e) =>
                          handleParamChange(
                            'brightness',
                            Number(e.target.value),
                          )
                        }
                        className="w-full h-1 bg-stone-900 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-stone-400">Reverb Space</span>
                        <span className="text-amber-500">
                          {(space * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={space}
                        onChange={(e) =>
                          handleParamChange('space', Number(e.target.value))
                        }
                        className="w-full h-1 bg-stone-900 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'osc' && clientRef.current && (
            <OSCPanel client={clientRef.current} />
          )}

          {activeTab !== 'telemetry' && activeTab !== 'osc' && (
            <div className="flex-1 flex flex-col items-center justify-center border border-stone-900 bg-stone-900/10 rounded-xl p-8 shadow-xl text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/5 text-amber-500/40 ring-1 ring-amber-500/10 mb-4">
                <Terminal size={24} />
              </div>
              <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-stone-300">
                {activeTab.toUpperCase()} Panel Available in later slices
              </h2>
              <p className="text-xs text-stone-500 font-mono mt-1 max-w-sm">
                Infrastructure foundation is ready. This panel is scheduled for
                implementation in a later v5 milestone sweep.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

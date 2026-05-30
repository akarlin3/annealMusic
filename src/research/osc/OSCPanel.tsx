import { useState, useEffect } from 'react';
import { OSCBridge, type OscLogEntry } from './OSCBridge';
import { BridgeClient } from '../bridge/BridgeClient';
import {
  Terminal,
  Copy,
  Check,
  Trash2,
  Pause,
  Play,
  RefreshCw,
  AlertCircle,
  Wifi,
  Sliders,
} from 'lucide-react';
import type { FilterRule } from './OSCFilter';

interface OSCPanelProps {
  client: BridgeClient;
}

export function OSCPanel({ client }: OSCPanelProps) {
  const [bridge] = useState(() => new OSCBridge(client));
  const [status, setStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');
  const [logs, setLogs] = useState<OscLogEntry[]>([]);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Connection settings
  const [wsPort, setWsPort] = useState(8766);
  const [udpIn, setUdpIn] = useState(8765);
  const [udpOut, setUdpOut] = useState(9000);
  const [udpHost, setUdpHost] = useState('127.0.0.1');

  useEffect(() => {
    // Synchronize rules from filter
    setRules(bridge.filter.getRules());

    // Listen to bridge status
    const unsubStatus = bridge.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Listen to traffic logs
    const unsubLog = bridge.onLog((newEntry) => {
      if (!isPaused) {
        setLogs((prev) => [newEntry, ...prev.slice(0, 49)]);
      }
    });

    // Auto-connect on mount
    bridge
      .connect({ wsPort, udpInPort: udpIn, udpOutPort: udpOut, udpHost })
      .catch(() => {});

    return () => {
      unsubStatus();
      unsubLog();
      bridge.disconnect().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, isPaused]);

  const handleConnectToggle = () => {
    if (status === 'connected') {
      bridge.disconnect().catch(() => {});
    } else {
      bridge
        .connect({
          wsPort,
          udpInPort: udpIn,
          udpOutPort: udpOut,
          udpHost,
        })
        .catch(() => {});
    }
  };

  const handleToggleRule = (address: string, enabled: boolean) => {
    bridge.filter.updateRule(address, { enabled });
    setRules(bridge.filter.getRules());
  };

  const handleThrottleChange = (address: string, throttleMs: number) => {
    bridge.filter.updateRule(address, { throttleMs: Math.max(0, throttleMs) });
    setRules(bridge.filter.getRules());
  };

  const handleCopyToClipboard = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 1500);
  };

  const handleClearLogs = () => {
    bridge.clearLogs();
    setLogs([]);
  };

  const handleExportLogs = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(logs, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', 'annealmusic_osc_traffic.json');
    dlAnchorElem.click();
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden max-h-[85vh]">
      {/* Left Column: Dashboard & Rules */}
      <div className="w-full md:w-[48%] flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-thin">
        {/* Status Dashboard Section */}
        <section className="border border-stone-900 bg-stone-900/10 rounded-2xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-2">
              <Wifi size={14} className="text-amber-500" />
              OSC Bridge sync dashboard
            </h2>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  status === 'connected'
                    ? 'bg-emerald-500 shadow-md shadow-emerald-500/50 animate-ping'
                    : status === 'connecting'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-stone-600'
                }`}
              />
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">
                {status}
              </span>
            </div>
          </div>

          {/* Configuration Inputs */}
          <div className="grid grid-cols-2 gap-4 mt-2 bg-stone-950/40 p-4 rounded-xl border border-stone-900/60 font-mono text-[11px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-500">WS Bridge Port</label>
              <input
                type="number"
                value={wsPort}
                onChange={(e) => setWsPort(parseInt(e.target.value) || 8766)}
                disabled={status !== 'disconnected'}
                className="bg-stone-900/60 border border-stone-850 px-2.5 py-1.5 rounded-md text-stone-300 focus:outline-none focus:border-amber-500/30 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-500">UDP Incoming (Listen)</label>
              <input
                type="number"
                value={udpIn}
                onChange={(e) => setUdpIn(parseInt(e.target.value) || 8765)}
                disabled={status !== 'disconnected'}
                className="bg-stone-900/60 border border-stone-850 px-2.5 py-1.5 rounded-md text-stone-300 focus:outline-none focus:border-amber-500/30 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-500">UDP Outgoing (Target)</label>
              <input
                type="number"
                value={udpOut}
                onChange={(e) => setUdpOut(parseInt(e.target.value) || 9000)}
                disabled={status !== 'disconnected'}
                className="bg-stone-900/60 border border-stone-850 px-2.5 py-1.5 rounded-md text-stone-300 focus:outline-none focus:border-amber-500/30 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-500">UDP Target Host</label>
              <input
                type="text"
                value={udpHost}
                onChange={(e) => setUdpHost(e.target.value)}
                disabled={status !== 'disconnected'}
                className="bg-stone-900/60 border border-stone-850 px-2.5 py-1.5 rounded-md text-stone-300 focus:outline-none focus:border-amber-500/30 disabled:opacity-50"
              />
            </div>
          </div>

          <button
            onClick={handleConnectToggle}
            className={`w-full py-2.5 rounded-xl font-mono text-xs uppercase transition-all font-semibold flex items-center justify-center gap-2 border ${
              status === 'connected'
                ? 'bg-stone-900 border-rose-500/30 hover:bg-rose-950/20 text-rose-400'
                : 'bg-amber-500 text-stone-950 hover:bg-amber-400 border-amber-500/10'
            }`}
          >
            {status === 'connected' ? 'Disconnect Bridge' : 'Connect Bridge'}
          </button>
        </section>

        {/* Filter Rules Section */}
        <section className="flex-1 border border-stone-900 bg-stone-900/10 rounded-2xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-sm max-h-[48vh] overflow-hidden">
          <h2 className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-2">
            <Sliders size={14} className="text-amber-500" />
            Active Address Filter Rules
          </h2>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1.5 scrollbar-thin">
            {rules.map((rule) => (
              <div
                key={rule.address}
                className="flex items-center justify-between p-3 bg-stone-950/40 rounded-xl border border-stone-900/50 transition-all hover:border-stone-850"
              >
                <div className="flex flex-col gap-1 max-w-[65%]">
                  <span
                    className="font-mono text-[10.5px] truncate text-stone-300"
                    title={rule.address}
                  >
                    {rule.address}
                  </span>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-stone-500">
                    <span>Limit:</span>
                    <input
                      type="number"
                      value={rule.throttleMs}
                      onChange={(e) =>
                        handleThrottleChange(
                          rule.address,
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="w-12 bg-stone-900 border border-stone-850 text-stone-400 rounded px-1 text-center py-0.5 focus:outline-none focus:border-amber-500/20"
                    />
                    <span>ms</span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) =>
                      handleToggleRule(rule.address, e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-stone-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2.5px] after:left-[2.5px] after:bg-stone-500 after:border-stone-600 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500/20 peer-checked:after:bg-amber-500 peer-checked:after:border-amber-400"></div>
                </label>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right Column: Live Terminal Monitor */}
      <div className="w-full md:w-[52%] flex flex-col border border-stone-900 bg-stone-900/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-900 bg-stone-900/20 select-none">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/10 text-amber-500">
              <Terminal size={12} />
            </div>
            <span className="text-xs font-mono uppercase tracking-wider text-stone-400">
              Live OSC Console Monitor
            </span>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 rounded bg-stone-900 border border-stone-850 text-stone-400 hover:text-stone-200 transition-all flex items-center justify-center"
              title={
                isPaused ? 'Resume console updates' : 'Pause console updates'
              }
            >
              {isPaused ? (
                <Play size={12} fill="currentColor" />
              ) : (
                <Pause size={12} fill="currentColor" />
              )}
            </button>
            <button
              onClick={handleClearLogs}
              className="p-1.5 rounded bg-stone-900 border border-stone-850 text-stone-400 hover:text-stone-200 transition-all flex items-center justify-center"
              title="Clear terminal history"
            >
              <Trash2 size={12} />
            </button>
            <button
              onClick={handleExportLogs}
              className="p-1.5 rounded bg-stone-900 border border-stone-850 text-stone-400 hover:text-stone-200 transition-all flex items-center justify-center"
              title="Export capture log to JSON"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Live Stream Panel */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-[10.5px] leading-relaxed flex flex-col gap-2 bg-stone-950/40 scrollbar-thin min-h-[30vh]">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-700 select-none gap-2 py-16">
              <AlertCircle size={18} className="stroke-stone-700" />
              <span>WAITING FOR OSC SOCKET PACKETS...</span>
            </div>
          ) : (
            logs.map((log) => {
              const isOut = log.direction === 'out';
              const directionColor = isOut
                ? 'text-sky-400 bg-sky-950/15 border-sky-950/40'
                : 'text-amber-400 bg-amber-950/15 border-amber-950/40';
              const directionLabel = isOut ? '→ SEND' : '← RECV';

              return (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-lg border flex flex-col gap-1 transition-all ${directionColor}`}
                >
                  <div className="flex items-center justify-between border-b border-stone-900/20 pb-1">
                    <span className="font-semibold text-[10px] tracking-wide uppercase">
                      {directionLabel}
                    </span>
                    <div className="flex items-center gap-2 text-[9px] text-stone-500">
                      <span>{log.timestamp}</span>
                      <button
                        onClick={() => handleCopyToClipboard(log.address)}
                        className="hover:text-stone-300 transition-colors"
                        title="Copy OSC path"
                      >
                        {copiedAddress === log.address ? (
                          <Check size={10} className="text-emerald-500" />
                        ) : (
                          <Copy size={10} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-stone-200 text-[11px] truncate selection:bg-amber-500/20">
                      {log.address}
                    </span>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[9.5px] text-stone-400 selection:bg-amber-500/20 mt-1">
                      {JSON.stringify(log.args)}
                    </pre>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

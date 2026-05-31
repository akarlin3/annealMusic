import { useState } from 'react';
import {
  Activity,
  Bluetooth,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  XCircle,
  Heart,
  TrendingUp,
} from 'lucide-react';
import { useBiofeedbackStore } from './store';

interface ConnectionFlowProps {
  onClose?: () => void;
  requiredChannels?: string[];
}

export function ConnectionFlow({
  onClose,
  requiredChannels = [],
}: ConnectionFlowProps) {
  const { adapters, connectedDevices, connectDevice, disconnectDevice } =
    useBiofeedbackStore();

  const [selectedAdapterId, setSelectedAdapterId] =
    useState<string>('polar-h10');
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const selectedAdapter = adapters.find((a) => a.id === selectedAdapterId);
  const activeConnection = connectedDevices[selectedAdapterId];

  const handleConnect = async () => {
    if (!selectedAdapter) return;
    setConnectingId(selectedAdapterId);
    try {
      // Connect using Web Bluetooth for Polar H10
      await connectDevice(selectedAdapterId, 'webbluetooth');
    } catch (err) {
      console.error('Failed to connect device', err);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async () => {
    await disconnectDevice(selectedAdapterId);
  };

  return (
    <div className="w-full max-w-md bg-stone-950/80 backdrop-blur-xl border border-stone-850 rounded-3xl p-6 shadow-2xl font-mono text-xs text-stone-300 transition-all select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Bluetooth size={16} className="text-amber-500 animate-pulse" />
          <span className="font-bold text-stone-200 uppercase tracking-widest text-[10px]">
            Biofeedback Console
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 transition-all"
          >
            <XCircle size={16} />
          </button>
        )}
      </div>

      {/* Required channels badge */}
      {requiredChannels.length > 0 && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col gap-1">
          <span className="font-bold text-amber-500/80 uppercase text-[9px] tracking-wider">
            Required Study Channels:
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {requiredChannels.map((ch) => (
              <span
                key={ch}
                className="px-2 py-0.5 rounded bg-stone-900 border border-stone-850 text-stone-400 text-[9px] uppercase font-bold"
              >
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Select Device */}
      <div className="flex flex-col gap-2 mb-4">
        <label className="text-stone-500 font-bold uppercase text-[9px] tracking-wider">
          Choose Hardware Source:
        </label>
        <select
          value={selectedAdapterId}
          onChange={(e) => setSelectedAdapterId(e.target.value)}
          disabled={connectingId !== null}
          className="bg-stone-900 border border-stone-850 rounded-xl p-2.5 text-stone-200 outline-none hover:border-stone-750 transition-all cursor-pointer"
        >
          {adapters.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.capabilities.join(', ')})
            </option>
          ))}
        </select>
      </div>

      {/* Device Status Panel */}
      <div className="bg-stone-900/40 border border-stone-900 rounded-2xl p-4 flex flex-col gap-4 mb-4">
        {/* Disconnected state */}
        {(!activeConnection || activeConnection.status === 'disconnected') && (
          <div className="flex flex-col items-center gap-3 text-center py-2">
            <Bluetooth size={28} className="text-stone-700" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-stone-300 uppercase tracking-wider text-[10px]">
                Device Ready to Pair
              </span>
              <span className="text-[9px] text-stone-500 leading-relaxed">
                Make sure your {selectedAdapter?.name || 'sensor'} is turned on
                and close by.
              </span>
            </div>
            <button
              onClick={handleConnect}
              disabled={connectingId !== null}
              className="w-full py-2.5 bg-amber-500 text-stone-950 font-bold rounded-xl hover:bg-amber-450 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 mt-2 shadow-md uppercase tracking-wider text-[10px]"
            >
              {connectingId ? (
                <>
                  <RefreshCw className="animate-spin" size={12} /> Connecting
                  BLE...
                </>
              ) : (
                <>
                  Pair Over BLE <ChevronRightSymbol />
                </>
              )}
            </button>
          </div>
        )}

        {/* Connecting state */}
        {activeConnection?.status === 'connecting' && (
          <div className="flex flex-col items-center gap-4 text-center py-4">
            <RefreshCw className="animate-spin text-amber-500" size={28} />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-stone-200 uppercase tracking-widest text-[10px]">
                Negotiating GATT Stream
              </span>
              <span className="text-[9px] text-stone-500 leading-relaxed">
                Establishing Bluetooth Heart Rate service channels...
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {activeConnection?.status === 'error' && (
          <div className="flex flex-col items-center gap-3 text-center py-2">
            <AlertTriangle className="text-red-500" size={28} />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-red-400 uppercase tracking-wider text-[10px]">
                Connection Blocked
              </span>
              <span className="text-[9px] text-stone-500 leading-relaxed max-h-16 overflow-y-auto px-2">
                {activeConnection.errorMsg ||
                  'Failed to initialize BLE GATT channels.'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full mt-2">
              <button
                onClick={handleDisconnect}
                className="py-2 border border-stone-800 rounded-xl hover:bg-stone-900 font-semibold text-stone-400 transition-all uppercase tracking-wider text-[9px]"
              >
                Clear Error
              </button>
              <button
                onClick={handleConnect}
                className="py-2 bg-amber-500 text-stone-950 font-bold rounded-xl hover:bg-amber-450 transition-all uppercase tracking-wider text-[9px]"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Connected active dashboard */}
        {activeConnection?.status === 'connected' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-stone-900 pb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className="text-emerald-500" />
                <span className="font-bold text-stone-200 uppercase text-[9px] tracking-wider">
                  Live BLE Feed Active
                </span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-[9px] text-red-500 hover:text-red-400 font-bold uppercase transition-all"
              >
                Disconnect
              </button>
            </div>

            {/* Metrics cards grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Heart rate value */}
              <div className="bg-stone-950/60 border border-stone-900 rounded-xl p-3 flex flex-col gap-1.5 shadow-inner">
                <div className="flex items-center gap-1 text-stone-500">
                  <Heart size={10} className="text-red-500 animate-pulse" />
                  <span className="font-bold uppercase text-[8px] tracking-widest">
                    Heart Rate
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-[20px] font-bold text-stone-100 font-mono tracking-tighter">
                    {activeConnection.latestFrame?.channels.heart_rate?.value ??
                      '--'}
                  </span>
                  <span className="text-[8px] text-stone-600 font-bold uppercase">
                    BPM
                  </span>
                </div>
              </div>

              {/* HRV R-R Interval value */}
              <div className="bg-stone-950/60 border border-stone-900 rounded-xl p-3 flex flex-col gap-1.5 shadow-inner">
                <div className="flex items-center gap-1 text-stone-500">
                  <Activity size={10} className="text-amber-500" />
                  <span className="font-bold uppercase text-[8px] tracking-widest">
                    HRV Interval
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-[20px] font-bold text-stone-100 font-mono tracking-tighter">
                    {activeConnection.latestFrame?.channels.hrv?.value ?? '--'}
                  </span>
                  <span className="text-[8px] text-stone-600 font-bold uppercase">
                    MS
                  </span>
                </div>
              </div>
            </div>

            {/* Live micro-sparkline feedback indicator */}
            <div className="bg-stone-950/40 border border-stone-900 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-inner">
              <TrendingUp size={12} className="text-stone-600" />
              <div className="flex-1 flex justify-end gap-0.5 items-end h-6 max-w-[200px]">
                {/* Visual pulse micro-equalizer animation representing heart-rate updates */}
                <div
                  className="w-1 bg-amber-500 rounded-t transition-all duration-300"
                  style={{
                    height: `${
                      activeConnection.latestFrame?.channels.heart_rate
                        ? Math.max(
                            20,
                            Math.min(
                              100,
                              (activeConnection.latestFrame.channels.heart_rate
                                .value /
                                150) *
                                100,
                            ),
                          )
                        : 10
                    }%`,
                  }}
                />
                <div className="w-1 h-3 bg-stone-850 rounded-t" />
                <div
                  className="w-1 bg-amber-500/70 rounded-t transition-all duration-500"
                  style={{
                    height: `${
                      activeConnection.latestFrame?.channels.hrv
                        ? Math.max(
                            10,
                            Math.min(
                              100,
                              (activeConnection.latestFrame.channels.hrv.value /
                                1200) *
                                100,
                            ),
                          )
                        : 20
                    }%`,
                  }}
                />
                <div className="w-1 h-4 bg-stone-850 rounded-t" />
                <div className="w-1 h-2 bg-stone-850 rounded-t" />
              </div>
              <span className="text-[8px] text-stone-600 font-bold uppercase">
                G_cal sync ok
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimers & Info */}
      <div className="text-[8px] text-stone-600 leading-relaxed border-t border-stone-900 pt-3">
        * Web Bluetooth requires Chromium-based desktop browsers. Ensure device
        is within 3 meters and not coupled to other active hosts.
      </div>
    </div>
  );
}

function ChevronRightSymbol() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

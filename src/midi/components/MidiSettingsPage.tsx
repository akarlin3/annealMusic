import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Settings,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Music,
  Radio,
  Clock,
  Download,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { midiApi } from '../api';
import { midiStorage, type GlobalMidiConfig } from '../storage';
import { midiLearn } from '../learnMode';
import { midiInput } from '../inputController';
import { midiOutput } from '../outputController';
import { getAutoMappingForController } from '../knownControllers';
import type {
  MidiDevice,
  MappingSet,
  CurveType,
  PermissionState,
} from '../types';
import Toast, { type ToastMessage } from '@/components/Toast';
import { useParamStore, CONTROL_DEFS, VOLUME_DEF } from '@/state/params';
import { engineParamDefs } from '@/audio/engines/index';

export default function MidiSettingsPage() {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [permission, setPermission] = useState<PermissionState>('prompt');
  const [globalConfig, setGlobalConfig] = useState<GlobalMidiConfig>(
    midiStorage.loadGlobalConfig(),
  );
  const [selectedInputId, setSelectedInputId] = useState<string>('none');
  const [selectedInputName, setSelectedInputName] =
    useState<string>('Generic Controller');
  const [activeMappings, setActiveMappings] = useState<MappingSet | null>(null);
  const [learningParam, setLearningParam] = useState<string | null>(null);
  const [learningIsEngine, setLearningIsEngine] = useState<boolean>(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((text: string) => {
    setToast({ id: Date.now(), text });
  }, []);

  // 1. Core initialization and Permission monitoring
  useEffect(() => {
    setPermission(midiApi.getPermissionState());

    if (midiApi.isSupported()) {
      // Auto-scan on mount if already granted
      if (navigator.permissions) {
        navigator.permissions
          .query({ name: 'midi' as PermissionName })
          .then((status) => {
            if (status.state === 'granted') {
              midiApi.requestAccess().then((access) => {
                if (access) {
                  setPermission('granted');
                  setDevices(midiApi.getDevices());
                }
              });
            }
          });
      }
    }
    return () => {
      // Loop through active MIDI inputs and set their listeners to null
      midiApi.clearListeners();
    };
  }, []);

  // 2. Hot-plug connection listener
  useEffect(() => {
    const unsub = midiApi.subscribeStateChange((updatedDevices) => {
      setDevices(updatedDevices);
    });
    return () => unsub();
  }, []);

  // 4. MIDI Learn FSM sync
  useEffect(() => {
    const unsubState = midiLearn.subscribeState((learnState) => {
      setLearningParam(learnState.paramKey);
      setLearningIsEngine(learnState.isEngineParam);
    });

    const unsubSuccess = midiLearn.subscribeLearnSuccess(
      (paramKey, _isEngine, cc, controllerId) => {
        showToast(`Mapped ${paramKey} to CC ${cc} on ${controllerId}`);
        if (activeMappings) {
          // Refresh mapping view
          const currentSet = midiInput.getOrLoadMappingSet(selectedInputName);
          setActiveMappings({ ...currentSet });
        }
      },
    );

    return () => {
      unsubState();
      unsubSuccess();
    };
  }, [activeMappings, selectedInputName, showToast]);

  // 5. Autoselect active input device
  useEffect(() => {
    const inputs = devices.filter(
      (d) => d.type === 'input' && d.state === 'connected',
    );
    if (inputs.length > 0 && selectedInputId === 'none') {
      const firstInput = inputs[0];
      if (firstInput) {
        setSelectedInputId(firstInput.id);
        setSelectedInputName(firstInput.name);
      }
    }
  }, [devices, selectedInputId]);

  // 6. Pull mapping set details for currently active device
  useEffect(() => {
    if (selectedInputName) {
      const mappings = midiInput.getOrLoadMappingSet(selectedInputName);
      setActiveMappings(mappings);
    }
  }, [selectedInputName]);

  const handleRequestPermission = async () => {
    const access = await midiApi.requestAccess();
    if (access) {
      setPermission('granted');
      setDevices(midiApi.getDevices());
      midiInput.start();
      showToast('MIDI access granted');
    } else {
      setPermission('denied');
      showToast('Permission denied or unsupported');
    }
  };

  const handleSaveGlobalConfig = (updated: Partial<GlobalMidiConfig>) => {
    const next = { ...globalConfig, ...updated };
    setGlobalConfig(next);
    midiStorage.saveGlobalConfig(next);
  };

  const handleUpdateMappingField = (
    cc: number,
    field: string,
    value: string | number,
  ) => {
    if (!activeMappings) return;

    const updated = { ...activeMappings };
    const targetMapping = updated.mappings[cc];
    if (targetMapping) {
      updated.mappings[cc] = {
        ...targetMapping,
        [field]: value,
      };
      midiInput.updateMappingSet(updated);
      setActiveMappings({ ...updated });
    }
  };

  const handleRemoveMapping = (cc: number) => {
    if (!activeMappings) return;

    const updated = { ...activeMappings };
    delete updated.mappings[cc];
    midiInput.updateMappingSet(updated);
    setActiveMappings({ ...updated });
    showToast(`Removed mapping for CC ${cc}`);
  };

  const handleExport = () => {
    const backup = midiStorage.exportAllConfig();
    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annealmusic-midi-mappings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Mappings configuration exported');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const ok = midiStorage.importAllConfig(text);
      if (ok) {
        showToast('MIDI mappings imported successfully');
        // Refresh mapping views
        setGlobalConfig(midiStorage.loadGlobalConfig());
        if (selectedInputName) {
          setActiveMappings(midiInput.getOrLoadMappingSet(selectedInputName));
        }
      } else {
        showToast('Failed to import mappings: Invalid format');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // clear input
  };

  const activeInputs = devices.filter(
    (d) => d.type === 'input' && d.state === 'connected',
  );
  const activeOutputs = devices.filter(
    (d) => d.type === 'output' && d.state === 'connected',
  );

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="mx-auto max-w-4xl px-6 py-12 font-mono">
        {/* Navigation Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 rounded-full border border-stone-850 bg-stone-950/20 hover:border-stone-700 hover:text-white transition-colors"
              aria-label="Back to synthesizer jam"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1
                className="text-xl uppercase tracking-[0.2em]"
                style={{ color: '#fef3c7' }}
              >
                MIDI Dashboard
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">
                Configure physical controllers, note tracking, and clock anchors
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded border border-stone-850 px-3 py-1.5 text-[9px] uppercase tracking-wider text-stone-400 hover:border-stone-700 hover:text-white transition-all bg-stone-950/10"
              title="Export all mappings"
            >
              <Download size={11} />
              Export
            </button>
            <button
              onClick={handleImportClick}
              className="flex items-center gap-1.5 rounded border border-stone-850 px-3 py-1.5 text-[9px] uppercase tracking-wider text-stone-400 hover:border-stone-700 hover:text-white transition-all bg-stone-950/10"
              title="Import mappings from backup JSON"
            >
              <Upload size={11} />
              Import
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />
          </div>
        </header>

        {/* 1. Safari Browser Fallback Troubleshooting Card */}
        {!midiApi.isSupported() && (
          <div className="mb-8 rounded-xl p-6 border border-amber-950/40 bg-amber-950/5 flex flex-col md:flex-row items-start gap-4">
            <AlertTriangle
              className="text-amber-500 flex-shrink-0 mt-0.5"
              size={20}
            />
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-500">
                Web MIDI API Unsupported in this Browser
              </h2>
              <p className="text-xs text-stone-400 mt-2 leading-relaxed max-w-2xl font-body">
                Safari and iOS Capacitor shells do not support the Web MIDI
                standard natively. To connect physical knobs, sliders, and
                keyboards, please launch **AnnealMusic** on desktop in **Google
                Chrome**, **Microsoft Edge**, **Opera**, or **Mozilla Firefox**.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* 2. Status & Permissions Section */}
          {midiApi.isSupported() && (
            <section
              className="rounded-xl p-6 border border-stone-850 relative overflow-hidden"
              style={{ background: '#141210', borderColor: '#292524' }}
            >
              {/* Subtle background glow */}
              <div
                className="absolute -top-12 -right-12 h-24 w-24 rounded-full pointer-events-none filter blur-3xl"
                style={{
                  background:
                    permission === 'granted'
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'rgba(245, 158, 11, 0.08)',
                }}
              />

              <div className="flex items-center gap-2 mb-6">
                <Settings size={14} className="text-amber-500" />
                <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
                  MIDI Engine Status & permission
                </h2>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-300">Permission:</span>
                    <span
                      className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded"
                      style={{
                        background:
                          permission === 'granted'
                            ? 'rgba(16,185,129,0.1)'
                            : 'rgba(245,158,11,0.1)',
                        color: permission === 'granted' ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {permission === 'granted'
                        ? 'Granted'
                        : permission === 'denied'
                          ? 'Denied'
                          : 'Prompt / Stopped'}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 font-body">
                    SysEx commands are locked (false) to maintain a minimal
                    browser authorization profile.
                  </p>
                </div>

                {permission !== 'granted' && (
                  <button
                    onClick={handleRequestPermission}
                    className="flex items-center gap-1.5 rounded px-4 py-2 text-[9px] uppercase tracking-widest font-semibold transition-all hover:opacity-90 bg-amber-500 text-stone-950"
                  >
                    <RefreshCw
                      size={11}
                      className="animate-[spin_4s_infinite_linear]"
                    />
                    Enable MIDI
                  </button>
                )}
              </div>
            </section>
          )}

          {permission === 'granted' && (
            <>
              {/* 3. Hardware Devices List */}
              <section
                className="rounded-xl p-6 border border-stone-850"
                style={{ background: '#141210', borderColor: '#292524' }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Radio size={14} className="text-amber-500" />
                  <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
                    Detected Hardware Controllers
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Inputs */}
                  <div>
                    <h3 className="text-[10px] uppercase text-stone-500 tracking-wider mb-2">
                      Input Devices ({activeInputs.length})
                    </h3>
                    {activeInputs.length === 0 ? (
                      <div className="text-[10px] text-stone-600 uppercase border border-stone-900 rounded p-4 bg-stone-950/20">
                        No MIDI inputs connected
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeInputs.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => {
                              setSelectedInputId(d.id);
                              setSelectedInputName(d.name);
                            }}
                            className="p-3 rounded border text-left cursor-pointer transition-all flex justify-between items-center bg-stone-950/40"
                            style={{
                              borderColor:
                                selectedInputId === d.id
                                  ? '#f59e0b'
                                  : '#1c1917',
                            }}
                          >
                            <div>
                              <div className="text-xs text-stone-300 font-semibold">
                                {d.name}
                              </div>
                              <div className="text-[9px] text-stone-500 uppercase mt-0.5">
                                {d.manufacturer}
                              </div>
                            </div>
                            {selectedInputId === d.id && (
                              <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider font-semibold">
                                Active Input
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outputs */}
                  <div>
                    <h3 className="text-[10px] uppercase text-stone-500 tracking-wider mb-2">
                      Output Devices ({activeOutputs.length})
                    </h3>
                    {activeOutputs.length === 0 ? (
                      <div className="text-[10px] text-stone-600 uppercase border border-stone-900 rounded p-4 bg-stone-950/20">
                        No MIDI outputs connected
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeOutputs.map((d) => {
                          const isActive = globalConfig.outputDeviceId === d.id;
                          return (
                            <div
                              key={d.id}
                              onClick={() =>
                                handleSaveGlobalConfig({ outputDeviceId: d.id })
                              }
                              className="p-3 rounded border text-left cursor-pointer transition-all flex justify-between items-center bg-stone-950/40"
                              style={{
                                borderColor: isActive ? '#f59e0b' : '#1c1917',
                              }}
                            >
                              <div>
                                <div className="text-xs text-stone-300 font-semibold">
                                  {d.name}
                                </div>
                                <div className="text-[9px] text-stone-500 uppercase mt-0.5">
                                  {d.manufacturer}
                                </div>
                              </div>
                              {isActive && (
                                <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider font-semibold">
                                  Active Output
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* 4.5 Mappings Table Section */}
              {activeMappings && (
                <section
                  className="rounded-xl p-6 border border-stone-850 text-left"
                  style={{ background: '#141210', borderColor: '#292524' }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <Sliders size={14} className="text-amber-500" />
                      <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
                        Parameter CC Assignments ({selectedInputName})
                      </h2>
                    </div>
                    <button
                      onClick={() => {
                        const defaultSet =
                          getAutoMappingForController(selectedInputName);
                        midiInput.updateMappingSet(defaultSet);
                        setActiveMappings({ ...defaultSet });
                        showToast(
                          `Restored default mappings for ${selectedInputName}`,
                        );
                      }}
                      className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-500 hover:text-amber-400 font-semibold"
                    >
                      <RotateCcw size={11} />
                      Load Default Maps
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-stone-850 text-[9px] uppercase tracking-wider text-stone-500">
                          <th className="py-2.5 pr-4">Parameter</th>
                          <th className="py-2.5 px-2">Assigned CC</th>
                          <th className="py-2.5 px-2">Min Value</th>
                          <th className="py-2.5 px-2">Max Value</th>
                          <th className="py-2.5 px-2">Response Curve</th>
                          <th className="py-2.5 pl-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Map over the 8 shared params + any engine params */}
                        {[
                          ...CONTROL_DEFS.map((c) => ({
                            key: c.key,
                            label: c.label,
                            min: c.min,
                            max: c.max,
                            isEngine: false,
                          })),
                          VOLUME_DEF && {
                            key: VOLUME_DEF.key,
                            label: VOLUME_DEF.label,
                            min: VOLUME_DEF.min,
                            max: VOLUME_DEF.max,
                            isEngine: false,
                          },
                          ...engineParamDefs(
                            useParamStore.getState().engineId,
                          ).map((e) => ({
                            key: e.key,
                            label: `${e.label} (${useParamStore.getState().engineId.toUpperCase()})`,
                            min: e.min,
                            max: e.max,
                            isEngine: true,
                          })),
                        ]
                          .filter(Boolean)
                          .map((param) => {
                            if (!param) return null;
                            const isLearning =
                              learningParam === param.key &&
                              learningIsEngine === param.isEngine;

                            // Find any active CC mapped to this param
                            const mappedCcEntry = Object.entries(
                              activeMappings.mappings,
                            ).find(
                              ([, m]) =>
                                m.paramKey === param.key &&
                                m.isEngineParam === param.isEngine,
                            );
                            const currentCC = mappedCcEntry
                              ? parseInt(mappedCcEntry[0], 10)
                              : null;
                            const mapping =
                              currentCC !== null
                                ? activeMappings.mappings[currentCC]
                                : null;

                            return (
                              <tr
                                key={`${param.key}-${param.isEngine}`}
                                className="border-b border-stone-900/60 hover:bg-stone-950/10 transition-colors"
                              >
                                {/* Param Label */}
                                <td className="py-3 pr-4 font-semibold text-stone-300">
                                  {param.label}
                                </td>

                                {/* Mapped CC Input / Learn trigger */}
                                <td className="py-3 px-2">
                                  {isLearning ? (
                                    <span className="inline-block px-2.5 py-1 text-[9px] uppercase tracking-widest font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                      Wiggle CC knob...
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min={0}
                                        max={127}
                                        value={
                                          currentCC !== null ? currentCC : ''
                                        }
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === '') {
                                            if (currentCC !== null)
                                              handleRemoveMapping(currentCC);
                                          } else {
                                            const ccVal = parseInt(val, 10);
                                            if (ccVal >= 0 && ccVal <= 127) {
                                              // Remove existing map for this param if any
                                              if (currentCC !== null)
                                                delete activeMappings.mappings[
                                                  currentCC
                                                ];

                                              activeMappings.mappings[ccVal] = {
                                                paramKey: param.key,
                                                isEngineParam: param.isEngine,
                                                min: mapping
                                                  ? mapping.min
                                                  : param.min,
                                                max: mapping
                                                  ? mapping.max
                                                  : param.max,
                                                curve: mapping
                                                  ? mapping.curve
                                                  : param.key === 'rootFreq'
                                                    ? 'exponential'
                                                    : 'linear',
                                              };
                                              midiInput.updateMappingSet(
                                                activeMappings,
                                              );
                                              setActiveMappings({
                                                ...activeMappings,
                                              });
                                            }
                                          }
                                        }}
                                        placeholder="Unassigned"
                                        className="w-16 rounded border bg-[#0d0c0b] px-2 py-1 text-center font-mono text-xs text-[#e7e5e4] focus:border-[#fbbf24] focus:outline-none"
                                        style={{ borderColor: '#2e2b28' }}
                                      />
                                      <button
                                        onClick={() =>
                                          midiLearn.startLearn(
                                            param.key,
                                            param.isEngine,
                                          )
                                        }
                                        className="rounded border border-stone-850 px-2 py-1 text-[9px] uppercase tracking-wider text-stone-500 hover:border-amber-500 hover:text-[#fbbf24] transition-all bg-stone-950/15"
                                        title="Click to learn hardware control"
                                      >
                                        Learn
                                      </button>
                                    </div>
                                  )}
                                </td>

                                {/* Min Limit */}
                                <td className="py-3 px-2">
                                  <input
                                    type="number"
                                    step={param.key === 'rootFreq' ? 1 : 0.01}
                                    disabled={currentCC === null}
                                    value={mapping ? mapping.min : param.min}
                                    onChange={(e) => {
                                      if (currentCC !== null) {
                                        handleUpdateMappingField(
                                          currentCC,
                                          'min',
                                          parseFloat(e.target.value),
                                        );
                                      }
                                    }}
                                    className="w-20 rounded border bg-[#0d0c0b] px-2 py-1 text-center text-xs disabled:opacity-30 disabled:cursor-not-allowed text-stone-300"
                                    style={{ borderColor: '#2e2b28' }}
                                  />
                                </td>

                                {/* Max Limit */}
                                <td className="py-3 px-2">
                                  <input
                                    type="number"
                                    step={param.key === 'rootFreq' ? 1 : 0.01}
                                    disabled={currentCC === null}
                                    value={mapping ? mapping.max : param.max}
                                    onChange={(e) => {
                                      if (currentCC !== null) {
                                        handleUpdateMappingField(
                                          currentCC,
                                          'max',
                                          parseFloat(e.target.value),
                                        );
                                      }
                                    }}
                                    className="w-20 rounded border bg-[#0d0c0b] px-2 py-1 text-center text-xs disabled:opacity-30 disabled:cursor-not-allowed text-stone-300"
                                    style={{ borderColor: '#2e2b28' }}
                                  />
                                </td>

                                {/* Curve Dropdown */}
                                <td className="py-3 px-2">
                                  <select
                                    disabled={currentCC === null}
                                    value={mapping ? mapping.curve : 'linear'}
                                    onChange={(e) => {
                                      if (currentCC !== null) {
                                        handleUpdateMappingField(
                                          currentCC,
                                          'curve',
                                          e.target.value as CurveType,
                                        );
                                      }
                                    }}
                                    className="rounded border bg-[#0d0c0b] px-2 py-1 text-xs disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 focus:outline-none"
                                    style={{ borderColor: '#2e2b28' }}
                                  >
                                    <option value="linear">Linear</option>
                                    <option value="exponential">
                                      Exponential
                                    </option>
                                    <option value="logarithmic">
                                      Logarithmic
                                    </option>
                                  </select>
                                </td>

                                {/* Action Clears */}
                                <td className="py-3 pl-4 text-right">
                                  {currentCC !== null ? (
                                    <button
                                      onClick={() =>
                                        handleRemoveMapping(currentCC)
                                      }
                                      className="text-[9px] uppercase tracking-wider font-semibold text-stone-600 hover:text-red-400 transition-colors"
                                    >
                                      Clear Map
                                    </button>
                                  ) : (
                                    <span className="text-[9px] uppercase text-stone-700 select-none">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 4.7 Keyboard Key Note Tracking Section */}
              <section
                className="rounded-xl p-6 border border-stone-850 text-left"
                style={{ background: '#141210', borderColor: '#292524' }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Music size={14} className="text-amber-500" />
                  <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
                    Keyboard Pitch Note Tracking
                  </h2>
                </div>

                <div className="space-y-6">
                  {/* Note tracking Enable Toggle */}
                  <div className="flex items-center justify-between rounded-lg border border-stone-900 bg-stone-950/20 p-4">
                    <div className="space-y-1">
                      <span className="text-xs text-stone-300 font-semibold">
                        Note Sets Root Frequency
                      </span>
                      <p className="text-[9px] text-stone-500 font-body leading-normal">
                        Strike keyboard notes to set the synthesis base root
                        pitch. Supports standard monophonic last-note-priority
                        keys.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={globalConfig.notesEnabled}
                      onChange={(e) => {
                        handleSaveGlobalConfig({
                          notesEnabled: e.target.checked,
                        });
                        showToast(
                          e.target.checked
                            ? 'Keyboard pitch tracking enabled'
                            : 'Keyboard pitch tracking disabled',
                        );
                      }}
                      className="accent-[#f59e0b] h-4 w-4 cursor-pointer"
                    />
                  </div>

                  {globalConfig.notesEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                      {/* Release Behavior */}
                      <div>
                        <span className="mb-2 block text-[9px] uppercase tracking-wider text-stone-500">
                          Note-Off Key Release Behavior
                        </span>
                        <div className="space-y-2.5">
                          <label className="flex items-start gap-2.5 text-xs text-stone-300 cursor-pointer">
                            <input
                              type="radio"
                              name="release-behavior"
                              checked={
                                globalConfig.notesReleaseBehavior === 'sustain'
                              }
                              onChange={() =>
                                handleSaveGlobalConfig({
                                  notesReleaseBehavior: 'sustain',
                                })
                              }
                              className="accent-[#f59e0b] mt-0.5"
                            />
                            <div>
                              <span>Sustain Last Pitch (Ambient Default)</span>
                              <p className="text-[9px] text-stone-500 font-body mt-0.5">
                                Synthesis root remains locked to the last struck
                                note after release.
                              </p>
                            </div>
                          </label>
                          <label className="flex items-start gap-2.5 text-xs text-stone-300 cursor-pointer">
                            <input
                              type="radio"
                              name="release-behavior"
                              checked={
                                globalConfig.notesReleaseBehavior === 'return'
                              }
                              onChange={() =>
                                handleSaveGlobalConfig({
                                  notesReleaseBehavior: 'return',
                                })
                              }
                              className="accent-[#f59e0b] mt-0.5"
                            />
                            <div>
                              <span>Return to manual UI slider pitch</span>
                              <p className="text-[9px] text-stone-500 font-body mt-0.5">
                                Restores the pre-keyboard root frequency slider
                                value upon key release.
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Velocity Modulation Destination */}
                      <div>
                        <label className="mb-2 block text-[9px] uppercase tracking-wider text-stone-500">
                          Keyboard Strike Velocity Modulation
                        </label>
                        <select
                          value={globalConfig.notesVelocityTarget}
                          onChange={(e) =>
                            handleSaveGlobalConfig({
                              notesVelocityTarget: e.target.value,
                            })
                          }
                          className="w-full rounded border bg-[#0d0c0b] px-3 py-2 text-xs font-mono text-[#e7e5e4] focus:border-[#fbbf24] focus:outline-none"
                          style={{ borderColor: '#44403c' }}
                        >
                          <option value="none">
                            None (Static ambient strike)
                          </option>
                          <option value="excitationLevel">
                            excitationLevel (Mallet strike force on Physical)
                          </option>
                          <option value="brightness">
                            brightness (Filter cutoff frequency)
                          </option>
                          <option value="drift">
                            drift (Lattice wander detune)
                          </option>
                          <option value="space">
                            space (Reverb wet balance)
                          </option>
                          <option value="volume">
                            volume (Synthesizer gain)
                          </option>
                        </select>
                        <p className="text-[9px] text-stone-500 font-body mt-1.5 leading-normal">
                          Maps strike velocity (0..127 striking force) to
                          dynamically adjust synthesis properties in real time.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 5. Output Clock & Transport Config Section */}
              <section
                className="rounded-xl p-6 border border-stone-850 text-left"
                style={{ background: '#141210', borderColor: '#292524' }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Clock size={14} className="text-amber-500" />
                  <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
                    Output Sync Clock & CC Streams
                  </h2>
                </div>

                <div className="space-y-6">
                  {/* Channels Selector & CC Stream Toggle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="mb-2 block text-[9px] uppercase tracking-wider text-stone-500">
                        MIDI Output Channel
                      </label>
                      <select
                        value={globalConfig.outputChannel}
                        onChange={(e) =>
                          handleSaveGlobalConfig({
                            outputChannel: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full rounded border bg-[#0d0c0b] px-3 py-2 text-xs font-mono text-[#e7e5e4] focus:border-[#fbbf24] focus:outline-none"
                        style={{ borderColor: '#44403c' }}
                      >
                        {Array.from({ length: 16 }, (_, i) => i + 1).map(
                          (ch) => (
                            <option key={ch} value={ch}>
                              Channel {ch} {ch === 16 ? '(Default)' : ''}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-stone-900 bg-stone-950/20 p-4">
                      <div className="space-y-1">
                        <span className="text-xs text-stone-300 font-semibold">
                          Emit CC Streams
                        </span>
                        <p className="text-[9px] text-stone-500 font-body">
                          Send 60Hz throttled parameter CCs to active output as
                          you sculpt.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={globalConfig.ccOutputEnabled}
                        onChange={(e) => {
                          handleSaveGlobalConfig({
                            ccOutputEnabled: e.target.checked,
                          });
                          showToast(
                            e.target.checked
                              ? 'CC parameter streaming active'
                              : 'CC parameter streaming disabled',
                          );
                        }}
                        className="accent-[#f59e0b] h-4 w-4 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-stone-900" />

                  {/* PPQN Master Clock Config */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between rounded-lg border border-stone-900 bg-stone-950/20 p-4">
                      <div className="space-y-1">
                        <span className="text-xs text-stone-300 font-semibold">
                          Master MIDI Clock
                        </span>
                        <p className="text-[9px] text-stone-500 font-body">
                          Send 24 PPQN real-time clock pulses and Start/Stop
                          events to sync downstream gear.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={globalConfig.clockEnabled}
                        onChange={(e) => {
                          handleSaveGlobalConfig({
                            clockEnabled: e.target.checked,
                          });
                          midiOutput.syncClockState();
                          showToast(
                            e.target.checked
                              ? 'MIDI Sync Clock active'
                              : 'MIDI Sync Clock disabled',
                          );
                        }}
                        className="accent-[#f59e0b] h-4 w-4 cursor-pointer"
                      />
                    </div>

                    {globalConfig.clockEnabled && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-mono text-stone-500 uppercase">
                          <span>Clock Tempo</span>
                          <span className="text-[#fbbf24] font-semibold">
                            {globalConfig.clockBpm} BPM
                          </span>
                        </div>
                        <input
                          type="range"
                          min={30}
                          max={240}
                          step={1}
                          value={globalConfig.clockBpm}
                          onChange={(e) => {
                            const bpm = parseInt(e.target.value, 10);
                            handleSaveGlobalConfig({ clockBpm: bpm });
                            midiOutput.syncClockState();
                          }}
                          className="w-full accent-[#fbbf24] h-1.5 bg-[#0c0a09] rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[8px] text-stone-600 font-mono">
                          <span>30 BPM</span>
                          <span>240 BPM</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParamStore } from '@/state/params';
import type { Orchestrator } from '@/audio/orchestrator';
import type { SlotId } from '@/loop/types';
import { renderStemsOffline, type RenderProgressEvent } from './StemRenderer';
import { getActiveStems } from './StemTaps';
import { ZipBuilder } from './ZipBuilder';
import { generateManifest, generateReadme } from './manifest';
import { startRealtimeCapture } from './RealtimeCapturer';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import InfoTip from '@/components/InfoTip';

interface ExportDialogProps {
  orchestrator: Orchestrator;
  patchTitle: string;
  patchHash: string;
  onClose: () => void;
  showToast: (msg: string) => void;
}

type ExportState = 'idle' | 'rendering' | 'packaging' | 'complete';

const getSegmentDurationSec = (seg: any, tempoBpm: number | null): number => {
  let durationMs = seg.durationMs ?? 5000;
  if (seg.config?.tempoLocked && tempoBpm !== null && tempoBpm > 0) {
    durationMs = durationMs * 4 * (60 / tempoBpm);
  }
  return durationMs / 1000;
};

export default function ExportDialog({
  orchestrator,
  patchTitle,
  patchHash,
  onClose,
  showToast,
}: ExportDialogProps) {
  const store = useParamStore();
  const isMobile = Capacitor.isNativePlatform();

  const activePiece = useMemo(() => {
    return (window as any).activePiecePlayer?.piece || null;
  }, []);

  const [exportMode, setExportMode] = useState<'full' | 'movement'>('full');

  // 1. Dialog Configuration States
  const [renderMode, setRenderMode] = useState<'offline' | 'realtime'>(
    'offline',
  );
  const [durationSec, setDurationSec] = useState(() => {
    if (store.mode === 'drone') {
      return 30 * 60; // 30 minutes default
    }
    if (store.sessionMode === 'arc') {
      return store.arcDurationSec;
    }
    return 5 * 60; // 5 minutes default
  });
  const [sampleRate, setSampleRate] = useState<44100 | 48000 | 96000>(() => {
    const sr = orchestrator.getSampleRate();
    if (sr === 44100 || sr === 48000 || sr === 96000) {
      return sr;
    }
    return 48000;
  });
  const [bitDepth, setBitDepth] = useState<24 | 32>(24);
  const [includeFx, setIncludeFx] = useState(true);
  const [includePartials, setIncludePartials] = useState(false);

  // 2. Export / Progress States
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [currentProgress, setCurrentProgress] =
    useState<RenderProgressEvent | null>(null);
  const cancelSignalRef = useRef({ aborted: false });
  const realtimeCaptureRef = useRef<{
    stop: () => Promise<Record<string, ArrayBuffer>>;
    cancel: () => void;
  } | null>(null);

  // 3. Extract Loop Buffers and States from Orchestrator
  const loopBuffers = useMemo(() => {
    return {
      A: orchestrator.getLoopSlot('A')?.getBuffer() || null,
      B: orchestrator.getLoopSlot('B')?.getBuffer() || null,
      C: orchestrator.getLoopSlot('C')?.getBuffer() || null,
    };
  }, [orchestrator]);

  const loopStates = useMemo(() => {
    return {
      A: orchestrator.getLoopState('A'),
      B: orchestrator.getLoopState('B'),
      C: orchestrator.getLoopState('C'),
    };
  }, [orchestrator]);

  const engineSupportsPartials = useMemo(() => {
    return store.engineId === 'sine' || store.engineId === 'fm';
  }, [store.engineId]);

  // Disable partials if not supported by active engine
  useEffect(() => {
    if (!engineSupportsPartials) {
      setIncludePartials(false);
    }
  }, [engineSupportsPartials]);

  // Compute Active Stems list based on current configs
  const activeStems = useMemo(() => {
    const mockOrchestratorForList = {
      getPartialCount: () => store.params.density,
      getInputVoice: () => orchestrator.getInputVoice(),
      getLoopSlot: (id: SlotId) => {
        return loopBuffers[id] ? { hasBuffer: () => true } : null;
      },
    } as any;

    return getActiveStems(mockOrchestratorForList, {
      includeFx: renderMode === 'offline' && includeFx,
      includePartials,
    });
  }, [
    store.params.density,
    orchestrator,
    loopBuffers,
    includeFx,
    includePartials,
    renderMode,
  ]);

  // Pre-render Size Estimator
  const estimatedSizeMb = useMemo(() => {
    let totalBytes = 0;
    const bytesPerSample = bitDepth === 24 ? 3 : 4;

    let targetDuration = durationSec;
    if (store.sessionMode === 'piece' && activePiece) {
      let totalPieceSec = 0;
      for (const seg of activePiece.segments) {
        totalPieceSec += getSegmentDurationSec(seg, activePiece.tempoBpm);
      }
      targetDuration = totalPieceSec;
    }

    for (const stem of activeStems) {
      const ch = stem.channels;
      totalBytes += targetDuration * sampleRate * bytesPerSample * ch;
    }

    return (totalBytes / (1024 * 1024)).toFixed(1);
  }, [
    activeStems,
    durationSec,
    sampleRate,
    bitDepth,
    store.sessionMode,
    activePiece,
  ]);

  const deliverZip = async (zipBlob: Blob) => {
    if (isMobile) {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(zipBlob);
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
            const base64 = base64data.split(',')[1] || '';
            const fileName = `annealmusic-${patchHash}-${Date.now()}.zip`;

            const writeResult = await Filesystem.writeFile({
              path: fileName,
              data: base64,
              directory: Directory.Cache,
            });

            await Share.share({
              title: `AnnealMusic - ${patchTitle} Stems`,
              text: `DAW multi-stem stems for patch: ${patchTitle}`,
              url: writeResult.uri,
              dialogTitle: 'Export Session Stems',
            });

            showToast('Stems exported successfully');
            resolve();
          } catch (e) {
            console.error('Capacitor share error', e);
            showToast('Export failed during device sharing');
            reject(e);
          }
        };
        reader.onerror = () => reject(reader.error);
      });
    } else {
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `annealmusic-${patchHash}-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('ZIP archive downloaded');
    }
  };

  const finalizeZipMovement = async (
    movementsData: Array<{
      name: string;
      description?: string;
      offsetSec: number;
      durationSec: number;
      results: Record<string, ArrayBuffer>;
    }>,
  ) => {
    setExportState('packaging');

    const zip = new ZipBuilder();

    // Add WAV stems for each movement in sub-folders
    for (let idx = 0; idx < movementsData.length; idx++) {
      const item = movementsData[idx]!;
      const folderName = `Movement ${idx + 1} - ${item.name}`;
      for (const [stemId, arrayBuffer] of Object.entries(item.results)) {
        zip.addFile(`${folderName}/${stemId}.wav`, arrayBuffer);
      }
    }

    // Build per-movement manifest
    const manifest = {
      appName: 'AnnealMusic',
      version: '3.5.0',
      timestamp: new Date().toISOString(),
      seed: Math.floor(Math.random() * 2000000),
      renderConfig: {
        mode: store.sessionMode,
        exportTarget: 'movement',
        sampleRate,
        bitDepth,
      },
      movements: movementsData.map((item, idx) => ({
        name: item.name,
        description: item.description || null,
        offsetSec: item.offsetSec,
        durationSec: item.durationSec,
        stems: activeStems.map((s) => ({
          id: s.id,
          label: s.label,
          channels: s.channels === 1 ? 'mono' : 'stereo',
          isFx: s.isFx,
          type: s.type,
          slotId: s.slotId || null,
          partialIndex: s.partialIndex !== undefined ? s.partialIndex : null,
          fileName: `Movement ${idx + 1} - ${item.name}/${s.id}.wav`,
        })),
      })),
    };

    zip.addFile('session.json', JSON.stringify(manifest, null, 2));

    // Add README.txt
    const readmeText = generateReadme(patchTitle, patchHash);
    zip.addFile('README.txt', readmeText);

    const zipBlob = zip.build();
    await deliverZip(zipBlob);

    setExportState('complete');
    setTimeout(onClose, 800);
  };

  const finalizeZip = async (renderResults: Record<string, ArrayBuffer>) => {
    setExportState('packaging');

    const zip = new ZipBuilder();

    // Add WAV stems
    for (const [stemId, arrayBuffer] of Object.entries(renderResults)) {
      zip.addFile(`${stemId}.wav`, arrayBuffer);
    }

    const renderConfig = {
      params: store.params,
      engineId: store.engineId,
      engineParams: store.engineParams[store.engineId] || {},
      loopConfig: store.loops,
      loopBuffers,
      loopStates,
      mode: store.sessionMode,
      arcId: store.sessionMode === 'arc' ? store.arcId : undefined,
      durationSec,
      sampleRate,
      bitDepth,
      includeFx: renderMode === 'offline' ? includeFx : false,
      includePartials,
      seed: Math.floor(Math.random() * 2000000),
      patchTitle,
      patchHash,
    };

    // Add manifest.json
    const manifestJson = generateManifest(renderConfig, activeStems);
    zip.addFile('session.json', manifestJson);

    // Add README.txt
    const readmeText = generateReadme(patchTitle, patchHash);
    zip.addFile('README.txt', readmeText);

    const zipBlob = zip.build();
    await deliverZip(zipBlob);

    setExportState('complete');
    setTimeout(onClose, 800);
  };

  // Trigger Stem Export Renders
  const handleExport = async () => {
    setExportState('rendering');
    cancelSignalRef.current.aborted = false;

    if (renderMode === 'realtime') {
      try {
        const captureHandle = await startRealtimeCapture({
          orchestrator,
          includePartials,
          maxSeconds: durationSec,
          sampleRate,
          bitDepth,
          patchTitle,
          patchHash,
        });

        realtimeCaptureRef.current = captureHandle;

        let elapsed = 0;
        setCurrentProgress({
          stemId: 'realtime',
          stemLabel: `Recording Live Stems... 0s / ${durationSec}s`,
          progress: 0,
          completedStems: 0,
          totalStems: 1,
        });

        const tickInterval = setInterval(() => {
          if (cancelSignalRef.current.aborted) {
            clearInterval(tickInterval);
            return;
          }
          elapsed += 1;
          setCurrentProgress({
            stemId: 'realtime',
            stemLabel: `Recording Live Stems... ${elapsed}s / ${durationSec}s`,
            progress: elapsed / durationSec,
            completedStems: 0,
            totalStems: 1,
          });

          if (elapsed >= durationSec) {
            clearInterval(tickInterval);
            if (!cancelSignalRef.current.aborted) {
              void handleStopRealtime();
            }
          }
        }, 1000);
      } catch (err: any) {
        console.error('Realtime stems capture initiation failed', err);
        showToast('Realtime capture initiation failed');
        setExportState('idle');
      }
    } else {
      // Offline mode
      try {
        const renderConfig = {
          params: store.params,
          engineId: store.engineId,
          engineParams: store.engineParams[store.engineId] || {},
          loopConfig: store.loops,
          loopBuffers,
          loopStates,
          mode: store.sessionMode,
          arcId: store.sessionMode === 'arc' ? store.arcId : undefined,
          durationSec,
          sampleRate,
          bitDepth,
          includeFx,
          includePartials,
          seed: Math.floor(Math.random() * 2000000),
          patchTitle,
          patchHash,
        };

        if (
          store.sessionMode === 'piece' &&
          exportMode === 'movement' &&
          activePiece?.movements &&
          activePiece.movements.length > 0
        ) {
          const movements = activePiece.movements;
          const movementsData: any[] = [];

          let currentOffsetSec = 0;
          const totalMovStems = movements.length * activeStems.length;

          for (let movIdx = 0; movIdx < movements.length; movIdx++) {
            if (cancelSignalRef.current.aborted) {
              throw new Error('Render cancelled by user');
            }

            const mov = movements[movIdx]!;

            // Build temporary piece for this movement
            const tempPiece = {
              ...activePiece,
              segments: activePiece.segments
                .slice(mov.startSegmentIndex, mov.endSegmentIndex + 1)
                .map((seg: any, idx: number) => ({
                  ...seg,
                  position: idx,
                })),
            };

            // Calculate movement duration
            let movDurationSec = 0;
            for (const seg of tempPiece.segments) {
              movDurationSec += getSegmentDurationSec(
                seg,
                activePiece.tempoBpm,
              );
            }

            const movResults = await renderStemsOffline(
              {
                ...renderConfig,
                piece: tempPiece,
                durationSec: movDurationSec,
              },
              (progress) => {
                setCurrentProgress({
                  stemId: progress.stemId,
                  stemLabel: `[Movement ${movIdx + 1}/${movements.length}: ${mov.name}] ${progress.stemLabel}`,
                  progress: progress.progress,
                  completedStems:
                    movIdx * activeStems.length + progress.completedStems,
                  totalStems: totalMovStems,
                });
              },
              cancelSignalRef.current,
            );

            movementsData.push({
              name: mov.name,
              description: mov.description,
              offsetSec: currentOffsetSec,
              durationSec: movDurationSec,
              results: movResults,
            });

            currentOffsetSec += movDurationSec;
          }

          await finalizeZipMovement(movementsData);
        } else {
          // Standard full piece offline render
          const renderResults = await renderStemsOffline(
            {
              ...renderConfig,
              piece: activePiece || undefined, // Use the active piece if available
            },
            (progress) => {
              setCurrentProgress(progress);
            },
            cancelSignalRef.current,
          );

          await finalizeZip(renderResults);
        }
      } catch (err: any) {
        if (err.message !== 'Render cancelled by user') {
          console.error('Offline stems render failed', err);
          showToast('Render failed — memory limit exceeded');
        }
        setExportState('idle');
      }
    }
  };

  const handleCancel = () => {
    cancelSignalRef.current.aborted = true;
    if (realtimeCaptureRef.current) {
      realtimeCaptureRef.current.cancel();
      realtimeCaptureRef.current = null;
    }
    showToast('Export aborted');
    setExportState('idle');
  };

  const handleStopRealtime = async () => {
    if (realtimeCaptureRef.current) {
      const captureHandle = realtimeCaptureRef.current;
      realtimeCaptureRef.current = null;
      try {
        const renderResults = await captureHandle.stop();
        await finalizeZip(renderResults);
      } catch (err: any) {
        console.error('Realtime capture stop failed', err);
        showToast('Capture failed — memory limit exceeded');
        setExportState('idle');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={exportState === 'idle' ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 transition-all duration-300 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1c1917 0%, #1c1917d0 100%)',
          border: '1px solid #44403c',
          boxShadow:
            '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Halo effect behind dialog */}
        <div
          className="absolute -top-24 -left-24 h-48 w-48 rounded-full pointer-events-none filter blur-[120px]"
          style={{ background: 'rgba(245, 158, 11, 0.08)' }}
        />

        {exportState === 'idle' ? (
          <>
            <h2
              className="mb-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: '#fef3c7' }}
            >
              Export DAW Stems
              <InfoTip id="export.stems" label="Export DAW Stems" />
            </h2>
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#78716c]">
              v1.5.0 · Lossless multi-track stems
            </p>

            <div className="space-y-4 mb-6">
              {/* Render Mode Selector */}
              <div>
                <label className="mb-1.5 block font-body text-xs text-[#a8a29e]">
                  Render Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRenderMode('offline')}
                    className="rounded-lg py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all"
                    style={{
                      background:
                        renderMode === 'offline' ? '#f59e0b' : '#0c0a09',
                      color: renderMode === 'offline' ? '#0c0a09' : '#a8a29e',
                      border: '1px solid #44403c',
                    }}
                  >
                    Offline Render
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenderMode('realtime')}
                    className="rounded-lg py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all"
                    style={{
                      background:
                        renderMode === 'realtime' ? '#f59e0b' : '#0c0a09',
                      color: renderMode === 'realtime' ? '#0c0a09' : '#a8a29e',
                      border: '1px solid #44403c',
                    }}
                  >
                    Realtime Capture
                  </button>
                </div>
                <p className="text-[9px] font-body text-[#78716c] mt-1.5">
                  {renderMode === 'offline'
                    ? '⚡ Faster-than-realtime deterministic render. Recommended for most sessions.'
                    : '🎤 Captures live jams, microphone inputs, and loop pedaling as they play.'}
                </p>
              </div>

              {/* Export Mode Toggle */}
              {renderMode === 'offline' &&
                store.sessionMode === 'piece' &&
                activePiece?.movements &&
                activePiece.movements.length > 0 && (
                  <div>
                    <label className="mb-1.5 block font-body text-xs text-[#a8a29e]">
                      Export Target
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setExportMode('full')}
                        className="rounded-lg py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all"
                        style={{
                          background:
                            exportMode === 'full' ? '#f59e0b' : '#0c0a09',
                          color: exportMode === 'full' ? '#0c0a09' : '#a8a29e',
                          border: '1px solid #44403c',
                        }}
                      >
                        Full Piece
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportMode('movement')}
                        className="rounded-lg py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all"
                        style={{
                          background:
                            exportMode === 'movement' ? '#f59e0b' : '#0c0a09',
                          color:
                            exportMode === 'movement' ? '#0c0a09' : '#a8a29e',
                          border: '1px solid #44403c',
                        }}
                      >
                        Per Movement
                      </button>
                    </div>
                    <p className="text-[9px] font-body text-[#78716c] mt-1.5">
                      {exportMode === 'full'
                        ? '📦 Exports the entire timeline as a single continuous session.'
                        : '📂 Splits the timeline and exports separate stem folders for each movement.'}
                    </p>
                  </div>
                )}

              {/* Duration Slider / Input */}
              {store.sessionMode === 'open' && store.mode === 'sketch' && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-body text-xs text-[#a8a29e]">
                      Duration
                    </label>
                    <span className="font-mono text-xs text-[#f59e0b]">
                      {Math.floor(durationSec / 60)}m {durationSec % 60}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={isMobile ? 600 : 1800}
                    step={30}
                    value={durationSec}
                    onChange={(e) =>
                      setDurationSec(parseInt(e.target.value, 10))
                    }
                    className="w-full accent-[#f59e0b] h-1 bg-[#0c0a09] rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-[#78716c] mt-1">
                    <span>30s</span>
                    {isMobile ? (
                      <span>10m (mobile cap)</span>
                    ) : (
                      <span>30m</span>
                    )}
                  </div>
                </div>
              )}

              {/* Meditative Duration Selection for Drone Mode */}
              {store.sessionMode === 'open' && store.mode === 'drone' && (
                <div>
                  <label className="mb-1.5 block font-body text-xs text-[#a8a29e]">
                    Meditative Duration
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        { label: '10m', sec: 10 * 60 },
                        { label: '20m', sec: 20 * 60 },
                        { label: '30m', sec: 30 * 60 },
                        { label: '60m', sec: 60 * 60 },
                      ] as const
                    ).map((opt) => {
                      const active = durationSec === opt.sec;
                      return (
                        <button
                          key={opt.sec}
                          type="button"
                          onClick={() => setDurationSec(opt.sec)}
                          className="rounded-lg py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all border"
                          style={{
                            background: active ? '#f59e0b' : '#0c0a09',
                            color: active ? '#0c0a09' : '#a8a29e',
                            border: active
                              ? '1px solid #f59e0b'
                              : '1px solid #44403c',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] font-body text-[#78716c] mt-1.5">
                    🧘 Configured duration of deterministic drone drift to
                    render.
                  </p>
                </div>
              )}

              {/* Sample Rate Selector */}
              <div>
                <label className="mb-1.5 block font-body text-xs text-[#a8a29e]">
                  Sample Rate
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([44100, 48000, 96000] as const).map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setSampleRate(rate)}
                      className="rounded-lg py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all"
                      style={{
                        background: sampleRate === rate ? '#f59e0b' : '#0c0a09',
                        color: sampleRate === rate ? '#0c0a09' : '#a8a29e',
                        border: '1px solid #44403c',
                      }}
                    >
                      {rate / 1000} kHz
                    </button>
                  ))}
                </div>
                {sampleRate === 96000 && (
                  <p className="text-[9px] font-body text-amber-500/80 mt-1">
                    ⚠️ 96kHz produces massive file sizes. High performance
                    recommended.
                  </p>
                )}
              </div>

              {/* Bit Depth Selector */}
              <div>
                <label className="mb-1.5 block font-body text-xs text-[#a8a29e]">
                  Bit Depth
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([24, 32] as const).map((depth) => (
                    <button
                      key={depth}
                      type="button"
                      onClick={() => setBitDepth(depth)}
                      className="rounded-lg py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all"
                      style={{
                        background: bitDepth === depth ? '#f59e0b' : '#0c0a09',
                        color: bitDepth === depth ? '#0c0a09' : '#a8a29e',
                        border: '1px solid #44403c',
                      }}
                    >
                      {depth}-bit {depth === 32 ? 'Float' : 'PCM'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-[#292524]">
                <div className="flex justify-between items-center">
                  <span
                    className={`font-body text-xs ${renderMode === 'offline' ? 'text-[#a8a29e]' : 'text-[#78716c] cursor-not-allowed'}`}
                  >
                    Post-FX variants (Reverb/Filter)
                  </span>
                  <input
                    type="checkbox"
                    disabled={renderMode === 'realtime'}
                    checked={renderMode === 'offline' && includeFx}
                    onChange={(e) => setIncludeFx(e.target.checked)}
                    className="accent-[#f59e0b] disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span
                    className={`font-body text-xs ${engineSupportsPartials ? 'text-[#a8a29e]' : 'text-[#78716c] cursor-not-allowed'}`}
                  >
                    Per-Partial stems (additive spectral mix)
                  </span>
                  <input
                    type="checkbox"
                    disabled={!engineSupportsPartials}
                    checked={includePartials}
                    onChange={(e) => setIncludePartials(e.target.checked)}
                    className="accent-[#f59e0b] disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Estimated Output Overview */}
            <div className="rounded-lg p-3 bg-[#0c0a09] border border-[#292524] mb-6">
              <div className="flex justify-between text-[10px] font-mono text-[#78716c] uppercase mb-1">
                <span>Active Stems</span>
                <span>Est. Total Size</span>
              </div>
              <div className="flex justify-between text-xs font-body text-[#f5f5f4]">
                <span className="font-mono text-[#f59e0b]">
                  {activeStems.length} tracks
                </span>
                <span>~{estimatedSizeMb} MB</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-5 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ border: '1px solid #44403c', color: '#a8a29e' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExport()}
                className="rounded-full px-5 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ background: '#f59e0b', color: '#0c0a09' }}
              >
                {renderMode === 'offline' ? 'Render Stems' : 'Record Stems'}
              </button>
            </div>
          </>
        ) : (
          /* 4. Render / Progress Mode Screen */
          <div className="py-4 text-center">
            {exportState === 'rendering' ? (
              <>
                <h2 className="mb-2 font-mono text-sm uppercase tracking-[0.2em] text-[#fef3c7]">
                  {renderMode === 'offline'
                    ? 'Rendering Audio Stems'
                    : 'Capturing Live Stems'}
                </h2>

                {/* Circular Halo loading animation */}
                <div className="relative h-24 w-24 mx-auto my-6 flex items-center justify-center">
                  <div className="absolute inset-0 border-2 border-stone-850 rounded-full" />
                  <div
                    className="absolute inset-0 border-2 border-[#f59e0b] rounded-full border-t-transparent animate-spin"
                    style={{ animationDuration: '1.2s' }}
                  />
                  <span className="font-mono text-xs text-[#f59e0b]">
                    {currentProgress
                      ? renderMode === 'offline'
                        ? `${Math.round((currentProgress.completedStems / currentProgress.totalStems) * 100)}%`
                        : `${Math.round(currentProgress.progress * 100)}%`
                      : '0%'}
                  </span>
                </div>

                <div className="space-y-1 font-body text-xs text-[#a8a29e] mb-6 max-h-36 overflow-y-auto pr-1">
                  {currentProgress && (
                    <>
                      {renderMode === 'offline' && (
                        <p className="font-mono text-[10px] uppercase text-[#78716c] mb-2">
                          Stem {currentProgress.completedStems + 1} of{' '}
                          {currentProgress.totalStems}
                        </p>
                      )}
                      <p className="text-[#f5f5f4] animate-pulse">
                        &gt; {currentProgress.stemLabel}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-full px-6 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ border: '1px solid #ef4444', color: '#ef4444' }}
                  >
                    {renderMode === 'offline' ? 'Cancel' : 'Discard'}
                  </button>
                  {renderMode === 'realtime' && (
                    <button
                      type="button"
                      onClick={() => void handleStopRealtime()}
                      className="rounded-full px-6 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
                      style={{ background: '#f59e0b', color: '#0c0a09' }}
                    >
                      Stop &amp; Save
                    </button>
                  )}
                </div>
              </>
            ) : exportState === 'packaging' ? (
              <div className="py-6">
                <h2 className="mb-3 font-mono text-sm uppercase tracking-[0.2em] text-[#fef3c7] animate-pulse">
                  Packaging Zip Archive
                </h2>
                <div className="h-1.5 w-32 bg-[#0c0a09] border border-[#292524] rounded-full mx-auto overflow-hidden">
                  <div
                    className="h-full bg-[#f59e0b] w-full animate-[shimmer_1.5s_infinite_linear]"
                    style={{
                      background:
                        'linear-gradient(90deg, #f59e0b 0%, #fef3c7 50%, #f59e0b 100%)',
                      backgroundSize: '200% 100%',
                    }}
                  />
                </div>
                <p className="font-body text-xs text-[#a8a29e] mt-4">
                  Assembling stems, README, and manifest JSON...
                </p>
              </div>
            ) : (
              <div className="py-6">
                <h2 className="mb-3 font-mono text-sm uppercase tracking-[0.2em] text-green-500">
                  Export Complete
                </h2>
                <p className="font-body text-xs text-[#a8a29e]">
                  Stems successfully compiled and delivered!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

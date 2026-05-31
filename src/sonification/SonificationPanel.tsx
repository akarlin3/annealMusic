/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useSonificationStore } from './store';
import { MappingEditor } from './MappingEditor';
import { CalibrationDialog } from './CalibrationDialog';
import { useAnnealMusic } from '@/hooks/useAnnealMusic';
import { encodeSonification } from '@/share/encode';
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Link,
  Save,
  Code,
  Activity,
  Check,
  Plus,
  FileText,
  BookOpen,
} from 'lucide-react';
import type { SourceDef, SourceType } from './types';
import { TemplateBrowser } from './templates/TemplateBrowser';
import { InstantiateDialog } from './templates/InstantiateDialog';
import './SonificationPanel.css';

export const SonificationPanel: React.FC = () => {
  const { ensureOrchestrator } = useAnnealMusic();

  const {
    activeId,
    title,
    description,
    mappingSpec,
    durationMs,
    playbackSpeed,
    loop,
    isPlaying: sonPlaying,
    elapsedSec,
    setOrchestrator,
    loadSonification,
    play: playSon,
    pause: pauseSon,
    seek: seekSon,
    setSpeed,
    setLoop,
    setDurationMs,
    addSource,
    removeSource,
  } = useSonificationStore();

  const [activeCalibrateIdx, setActiveCalibrateIdx] = useState<number | null>(
    null,
  );

  const [browserOpen, setBrowserOpen] = useState(false);
  const [instantiateTemplate, setInstantiateTemplate] = useState<any | null>(
    null,
  );

  // Local states for adding sources
  const [sourceType, setSourceType] = useState<SourceType>('file');
  const [synthFormula, setSynthFormula] = useState(
    'sin(t * 2 * PI) * 0.5 + 0.5',
  );
  const [liveUrl, setLiveUrl] = useState('ws://localhost:8080/sensor');
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [fileContent, setFileContent] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState('');

  // Notification states
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sourcesLength = mappingSpec.sources.length;

  // Hook into active audio engine orchestrator on load
  useEffect(() => {
    const orch = ensureOrchestrator();
    setOrchestrator(orch);

    // Initialize with a default mockup mapping if spec is empty
    if (sourcesLength === 0) {
      loadSonification({
        title: 'Calm Breathing Sonification',
        description: 'Synthetic respiratory rate mapping to engine parameters.',
        durationMs: 15000,
        playbackSpeed: 1.0,
        loop: true,
        mappingSpec: {
          sources: [
            {
              id: 'resp-rate',
              type: 'synthetic',
              formula: 'sin(t * (2 * Math.PI) / 8) * 0.5 + 0.5', // 8s breathing cycle
              columns: ['respiration'],
            },
          ],
          rules: [
            {
              sourceId: 'resp-rate',
              column: 'respiration',
              targetType: 'param',
              targetKey: 'brightness',
              transform: {
                type: 'linear',
                rawMin: 0,
                rawMax: 1,
                outMin: 0.2,
                outMax: 0.8,
              },
              calibrated: true,
            },
          ],
        },
      });
    }
  }, [ensureOrchestrator, setOrchestrator, loadSonification, sourcesLength]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      triggerToast(customEvent.detail.message);
    };
    window.addEventListener('anneal-toast', handleToast);
    return () => window.removeEventListener('anneal-toast', handleToast);
  }, []);

  // Handle template deep-linking via URL hash
  useEffect(() => {
    const checkTemplateHash = () => {
      const hash = window.location.hash;
      const match = hash.match(/#?template=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const slug = match[1];
        fetch(`/api/v1/mapping-templates/${slug}`)
          .then((res) => {
            if (res.ok) {
              return res.json();
            }
            throw new Error('Template not found');
          })
          .then((template) => {
            setInstantiateTemplate(template);
          })
          .catch((err) => {
            console.error('Failed to load template from hash:', err);
            triggerToast(`Could not load template "${slug}"`, 'error');
          });
      }
    };

    checkTemplateHash();
    window.addEventListener('hashchange', checkTemplateHash);
    return () => window.removeEventListener('hashchange', checkTemplateHash);
  }, []);

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // CSV/JSON File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const isJson = file.name.endsWith('.json');

      try {
        let parsedRows: Record<string, unknown>[] = [];
        let cols: string[] = [];

        if (isJson) {
          const parsed = JSON.parse(text);
          parsedRows = Array.isArray(parsed) ? parsed : [parsed];
          const firstRow = parsedRows[0];
          if (firstRow) {
            cols = Object.keys(firstRow);
          }
        } else {
          // Quick parse CSV
          const lines = text.split(/\r?\n/);
          if (lines.length > 0) {
            const firstLine = lines[0];
            if (firstLine) {
              cols = firstLine
                .split(',')
                .map((c) => c.trim().replace(/^"|"$/g, ''));
              for (let i = 1; i < lines.length; i++) {
                const line = lines[i]?.trim();
                if (!line) continue;
                const vals = line.split(',').map((v) => v.trim());
                const row: Record<string, unknown> = {};
                cols.forEach((c, idx) => {
                  const val = vals[idx] || '';
                  const num = Number(val);
                  row[c] = isNaN(num) || val === '' ? val : num;
                });
                parsedRows.push(row);
              }
            }
          }
        }

        if (parsedRows.length === 0) {
          triggerToast('Uploaded file is empty or invalid', 'error');
          return;
        }

        setFileName(file.name);
        setFileColumns(cols);
        setFileContent(parsedRows);
        triggerToast(`Loaded "${file.name}" with ${parsedRows.length} rows!`);
      } catch {
        triggerToast('Failed to parse file', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Add Source Action
  const handleAddSource = () => {
    const newId = `src-${Date.now()}`;
    let src: SourceDef;

    if (sourceType === 'file') {
      if (fileContent.length === 0) {
        triggerToast('Please upload a file first', 'error');
        return;
      }
      src = {
        id: newId,
        type: 'file',
        filename: fileName,
        columns: fileColumns,
        data: fileContent,
      };

      // Clear local upload cache
      setFileName('');
      setFileColumns([]);
      setFileContent([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else if (sourceType === 'synthetic') {
      src = {
        id: newId,
        type: 'synthetic',
        formula: synthFormula,
        columns: ['value'],
      };
    } else {
      src = {
        id: newId,
        type: 'live',
        url: liveUrl,
        columns: [], // populated on WS connection
      };
    }

    addSource(src);
    triggerToast('Added data stream source!');
  };

  // Save Sonification to Backend
  const handleSaveToBackend = async () => {
    const payload = {
      schema_ver: 21,
      title: title || 'My Sonification',
      description: description || 'Arbitrary time-series sonification',
      base_state: {},
      mapping_spec: mappingSpec,
      duration_ms: durationMs,
      source_files: [],
      visibility: 'unlisted',
    };

    try {
      const response = await fetch('/api/v1/sonifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        await response.json();
        triggerToast('Sonification saved successfully to database!');
      } else {
        triggerToast('Save failed, running locally instead', 'error');
      }
    } catch {
      triggerToast('Saved locally in current sandbox state!');
    }
  };

  // Share Sonification via URL
  const handleShareUrl = () => {
    try {
      const sonState = {
        id: activeId || undefined,
        title,
        description,
        mappingSpec,
        durationMs,
        playbackSpeed,
        loop,
      };
      const hashPayload = encodeSonification(sonState);
      const shareUrl = `${window.location.origin}${window.location.pathname}#s=21:${hashPayload}`;

      navigator.clipboard.writeText(shareUrl);
      triggerToast('Share URL copied to clipboard! (Schema v21)');
    } catch {
      triggerToast('Failed to create share link', 'error');
    }
  };

  // Playback Control Triggers
  const handlePlayPause = () => {
    if (sonPlaying) {
      pauseSon();
    } else {
      playSon();
    }
  };

  const handleReset = () => {
    seekSon(0);
  };

  const getSourceTypeLabel = (type: SourceType) => {
    switch (type) {
      case 'file':
        return 'CSV/JSON File';
      case 'synthetic':
        return 'Synthetic (Math)';
      case 'live':
        return 'Telemetry Stream';
    }
  };

  return (
    <div className="sonification-dashboard">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className={`toast-banner ${toastType}`}>
          <Check size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Hero Header */}
      <section className="dashboard-hero">
        <div className="hero-content">
          <div className="badge-tag">
            <Sparkles size={12} />
            <span>Sonification Sandbox v7.1</span>
          </div>
          <h1>Interpretive Sonification Engine</h1>
          <p>
            An scientific sonification sandbox built for the ICAD community. Map
            time-series datasets, environmental telemetry, or custom synthetic
            waves directly to parameters with calibrated mappings.
          </p>
        </div>

        <div className="hero-actions">
          <button
            className="btn-action outline"
            onClick={() => setBrowserOpen(true)}
          >
            <BookOpen size={16} /> Browse Templates
          </button>
          <button
            className="btn-action shadow-glow"
            onClick={handleSaveToBackend}
          >
            <Save size={16} /> Save Sonification
          </button>
          <button className="btn-action outline" onClick={handleShareUrl}>
            <Link size={16} /> Copy Share Link
          </button>
        </div>
      </section>

      {/* Main Playback Progress Bar */}
      <section className="playback-panel">
        <div className="playback-controls">
          <button className="btn-play-master" onClick={handlePlayPause}>
            {sonPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </button>

          <button className="btn-reset" onClick={handleReset}>
            <RotateCcw size={16} />
          </button>

          <div className="timeline-container">
            <div className="timeline-info">
              <span className="current-time font-mono">
                {elapsedSec.toFixed(2)}s
              </span>
              <span className="total-time font-mono">
                / {(durationMs / 1000).toFixed(2)}s
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={durationMs / 1000}
              step="0.05"
              value={elapsedSec}
              onChange={(e) => seekSon(parseFloat(e.target.value))}
              className="timeline-slider"
            />
          </div>
        </div>

        <div className="playback-settings-grid">
          <div className="setting-item">
            <label>Playback Speed</label>
            <div className="speed-control">
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={playbackSpeed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
              />
              <span className="font-mono text-sm">
                {playbackSpeed.toFixed(1)}x
              </span>
            </div>
          </div>

          <div className="setting-item">
            <label>Sonification Loop Duration</label>
            <div className="duration-input-wrapper">
              <input
                type="number"
                min="1"
                value={durationMs / 1000}
                onChange={(e) =>
                  setDurationMs((parseInt(e.target.value, 10) || 10) * 1000)
                }
              />
              <span>Seconds</span>
            </div>
          </div>

          <div className="setting-item loop-toggle">
            <label>Looping Mode</label>
            <button
              className={`toggle-btn ${loop ? 'active' : ''}`}
              onClick={() => setLoop(!loop)}
            >
              {loop ? 'Looping Active' : 'Single Play'}
            </button>
          </div>
        </div>
      </section>

      {/* Main Grid Workspace */}
      <div className="dashboard-grid">
        {/* Left Side: Sources and Telemetry */}
        <div className="grid-left">
          {/* Source Creator */}
          <div className="editor-card">
            <div className="card-title">
              <Upload size={18} className="icon-gold" />
              <h3>Connect Data Streams</h3>
            </div>

            <div className="source-tabs">
              <button
                className={sourceType === 'file' ? 'active' : ''}
                onClick={() => setSourceType('file')}
              >
                Upload File
              </button>
              <button
                className={sourceType === 'synthetic' ? 'active' : ''}
                onClick={() => setSourceType('synthetic')}
              >
                Synthetic (Math)
              </button>
              <button
                className={sourceType === 'live' ? 'active' : ''}
                onClick={() => setSourceType('live')}
              >
                Telemetry Stream
              </button>
            </div>

            <div className="tab-content">
              {sourceType === 'file' && (
                <div className="file-uploader">
                  <div className="dropzone">
                    <Upload size={32} />
                    <p>Select CSV or JSON time-series files</p>
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleFileUpload}
                      ref={fileInputRef}
                    />
                  </div>
                  {fileName && (
                    <div className="file-details">
                      <FileText size={16} />
                      <span className="file-name truncate">{fileName}</span>
                      <span className="file-cols">
                        ({fileColumns.length} columns found)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {sourceType === 'synthetic' && (
                <div className="synthetic-editor">
                  <label className="input-label">
                    JavaScript Math Expression
                  </label>
                  <div className="formula-wrapper">
                    <Code size={16} />
                    <input
                      type="text"
                      value={synthFormula}
                      onChange={(e) => setSynthFormula(e.target.value)}
                      placeholder="sin(t * 2 * PI) * 0.5 + 0.5"
                    />
                  </div>
                  <span className="help-text">
                    Supported: `sin`, `cos`, `tan`, `abs`, `pow`, `sqrt`, `PI`,
                    `E`.
                  </span>
                </div>
              )}

              {sourceType === 'live' && (
                <div className="live-config">
                  <label className="input-label">Telemetry Stream URL</label>
                  <div className="url-wrapper">
                    <Activity size={16} />
                    <input
                      type="text"
                      value={liveUrl}
                      onChange={(e) => setLiveUrl(e.target.value)}
                      placeholder="ws://localhost:8080/sensor"
                    />
                  </div>
                  <span className="help-text">
                    Supports WebSocket (ws://, wss://) or Server Sent Events
                    (http://).
                  </span>
                </div>
              )}

              <button className="btn-add-source" onClick={handleAddSource}>
                <Plus size={14} /> Add Stream Source
              </button>
            </div>
          </div>

          {/* Active Streams List */}
          <div className="editor-card scrollable">
            <div className="card-title">
              <Activity size={18} className="icon-gold" />
              <h3>Connected Data Streams ({mappingSpec.sources.length})</h3>
            </div>

            {mappingSpec.sources.length === 0 ? (
              <p className="empty-text">
                No active data streams. Create one above.
              </p>
            ) : (
              <div className="sources-list">
                {mappingSpec.sources.map((src) => (
                  <div key={src.id} className="source-item">
                    <div className="source-info">
                      <span className="source-title font-semibold truncate">
                        {src.filename || `Synthetic Formula`}
                      </span>
                      <span className="source-meta">
                        {getSourceTypeLabel(src.type)} &bull;{' '}
                        {src.columns.length} columns
                      </span>
                      {src.type === 'synthetic' && (
                        <span className="source-formula font-mono truncate">
                          {src.formula}
                        </span>
                      )}
                    </div>
                    <button
                      className="btn-remove-source"
                      onClick={() => removeSource(src.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Bindings and Transforms */}
        <div className="grid-right">
          <MappingEditor
            onOpenCalibration={(idx) => setActiveCalibrateIdx(idx)}
          />
        </div>
      </div>

      {/* Render Calibration Dialog Modal */}
      {activeCalibrateIdx !== null && (
        <CalibrationDialog
          ruleIndex={activeCalibrateIdx}
          onClose={() => setActiveCalibrateIdx(null)}
        />
      )}

      {/* Render Catalog Browser */}
      {browserOpen && (
        <TemplateBrowser
          onClose={() => setBrowserOpen(false)}
          onInstantiate={(template) => {
            setBrowserOpen(false);
            setInstantiateTemplate(template);
          }}
        />
      )}

      {/* Render Instantiate Dialog */}
      {instantiateTemplate !== null && (
        <InstantiateDialog
          template={instantiateTemplate}
          onClose={() => setInstantiateTemplate(null)}
        />
      )}
    </div>
  );
};

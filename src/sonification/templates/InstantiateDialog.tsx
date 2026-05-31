/* eslint-disable */
import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Play,
  AlertCircle,
  FileText,
  Sparkles,
  Check,
} from 'lucide-react';
import { useSonificationStore } from '../store';

interface MappingTemplate {
  id: string;
  slug: string;
  title: string;
  description: string;
  domain_family:
    | 'time-series'
    | 'scalar-field'
    | 'network'
    | 'structured-event';
  source_schema: { columns: string[] };
  mapping_spec: any;
  calibration_recommendation?: string;
  citation?: string;
}

interface InstantiateDialogProps {
  template: MappingTemplate;
  onClose: () => void;
}

export const InstantiateDialog: React.FC<InstantiateDialogProps> = ({
  template,
  onClose,
}) => {
  const { loadSonification } = useSonificationStore();

  const [dataSource, setDataSource] = useState<'example' | 'upload'>('example');
  const [dataRows, setDataRows] = useState<Record<string, any>[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  // Mapping of required column names to actual uploaded file column names
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    {},
  );
  const [durationMs, setDurationMs] = useState(15000);
  const [title, setTitle] = useState(`${template.title} Sonification`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize column mappings to identical column names if possible
  const initMapping = (cols: string[]) => {
    const mapping: Record<string, string> = {};
    template.source_schema.columns.forEach((reqCol) => {
      // Find case-insensitive match
      const matched =
        cols.find((c) => c.toLowerCase() === reqCol.toLowerCase()) ||
        cols[0] ||
        '';
      mapping[reqCol] = matched;
    });
    setColumnMapping(mapping);
  };

  // Quick pre-packaged example datasets matching schemas
  const loadExampleData = () => {
    let rows: Record<string, any>[] = [];
    if (
      template.slug.includes('anomaly') ||
      template.slug.includes('punctuation')
    ) {
      rows = Array.from({ length: 50 }, (_, i) => ({
        anomaly_score: i === 15 || i === 35 ? 0.95 : i * 0.01 + 0.05,
      }));
    } else if (
      template.slug.includes('graph') ||
      template.slug.includes('network') ||
      template.slug.includes('component')
    ) {
      rows = [
        { degree: 4, weight: 0.1, centrality: 0.12, component_size: 12 },
        { degree: 15, weight: 0.9, centrality: 0.92, component_size: 12 },
        { degree: 8, weight: 0.5, centrality: 0.45, component_size: 12 },
        { degree: 3, weight: 0.2, centrality: 0.08, component_size: 12 },
        { degree: 2, weight: 0.4, centrality: 0.05, component_size: 4 },
        { degree: 1, weight: 0.8, centrality: 0.01, component_size: 4 },
      ];
    } else if (
      template.slug.includes('vector') ||
      template.slug.includes('flow')
    ) {
      rows = Array.from({ length: 40 }, (_, i) => ({
        dx: Math.sin(i * 0.5) * 5,
        dy: Math.cos(i * 0.5) * 5,
      }));
    } else if (template.slug.includes('log')) {
      rows = Array.from({ length: 30 }, (_, i) => ({
        severity_level: i % 10 === 0 ? 3 : i % 5 === 0 ? 2 : 1,
      }));
    } else {
      // Generic single scalar drift default
      rows = Array.from({ length: 50 }, (_, i) => ({
        value: 20 + Math.sin(i * 0.3) * 10 + i * 0.1,
      }));
    }

    setDataRows(rows);
    const cols = Object.keys(rows[0] || {});
    setFileColumns(cols);
    setFileName('Canonical Research Sandbox Dataset');

    // Auto-map columns
    const mapping: Record<string, string> = {};
    template.source_schema.columns.forEach((reqCol) => {
      mapping[reqCol] = reqCol;
    });
    setColumnMapping(mapping);
  };

  // CSV/JSON File parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const isJson = file.name.endsWith('.json');

      try {
        let parsedRows: Record<string, any>[] = [];
        let cols: string[] = [];

        if (isJson) {
          const parsed = JSON.parse(text);
          parsedRows = Array.isArray(parsed) ? parsed : [parsed];
          const firstRow = parsedRows[0];
          if (firstRow) cols = Object.keys(firstRow);
        } else {
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
                const row: Record<string, any> = {};
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
          setError('Uploaded file is empty or invalid');
          return;
        }

        setFileName(file.name);
        setFileColumns(cols);
        setDataRows(parsedRows);
        initMapping(cols);
        setError(null);
      } catch {
        setError('Failed to parse file. Ensure it is valid CSV or JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleInstantiate = () => {
    if (dataSource === 'example' && dataRows.length === 0) {
      loadExampleData();
    }

    setLoading(true);

    // Normalize user's mapped data rows to template expected schema names
    const normalizedRows = dataRows.map((row) => {
      const norm: Record<string, any> = {};
      Object.entries(columnMapping).forEach(([reqCol, actualCol]) => {
        norm[reqCol] = row[actualCol] ?? 0;
      });
      return norm;
    });

    const payload = {
      template_slug: template.slug,
      title: title,
      description: `Instantiated from ${template.title}`,
      data_rows: normalizedRows,
      duration_ms: durationMs,
    };

    fetch('/api/v1/sonifications/from-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('API instantiation failed');
        return res.json();
      })
      .then((sonification) => {
        // Hydrate state immediately
        loadSonification({
          id: sonification.id,
          title: sonification.title,
          description: sonification.description,
          durationMs: sonification.duration_ms,
          playbackSpeed: 1.0,
          loop: true,
          mappingSpec: sonification.mapping_spec,
        });
        setLoading(false);
        onClose();
        // Trigger a simple global event to alert SonificationPanel to trigger toast
        window.dispatchEvent(
          new CustomEvent('anneal-toast', {
            detail: {
              message: 'Mapping instantiated and loaded into sandbox!',
            },
          }),
        );
      })
      .catch(() => {
        setLoading(false);
        setError(
          'Failed to instantiate template on server. Running locally instead.',
        );

        // Offline sandbox fallback: Load template spec directly and map loaded data
        loadSonification({
          title: title,
          description: `Offline instantiated template: ${template.title}`,
          durationMs: durationMs,
          playbackSpeed: 1.0,
          loop: true,
          mappingSpec: {
            sources: [
              {
                id: 'src-1',
                type: 'file',
                filename: fileName || 'offline_dataset.csv',
                columns: template.source_schema.columns,
                data: normalizedRows,
              },
            ],
            rules: template.mapping_spec.rules.map((rule: any) => ({
              ...rule,
              transform: {
                ...rule.transform,
                rawMin: Math.min(...normalizedRows.map((r) => r[rule.column])),
                rawMax: Math.max(...normalizedRows.map((r) => r[rule.column])),
              },
              calibrated: true,
            })),
          },
        });
        onClose();
        window.dispatchEvent(
          new CustomEvent('anneal-toast', {
            detail: { message: 'Loaded offline mapping into sandbox!' },
          }),
        );
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <header className="flex items-center justify-between px-6 py-4 border-b border-stone-850">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-mono uppercase tracking-wider font-semibold text-stone-200">
                Instantiate Template
              </h3>
              <p className="text-xs text-stone-500 font-mono">
                Bind custom telemetry columns to canonical controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-850 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
          >
            <X size={14} />
          </button>
        </header>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh] scrollbar-thin">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex gap-2.5 items-start text-xs text-rose-400 font-mono">
              <AlertCircle size={14} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form settings */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1 select-none">
              <label className="text-[10px] uppercase font-mono tracking-widest text-stone-500">
                Sonification Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs font-mono text-stone-300 focus:outline-none focus:border-amber-500/30"
              />
            </div>

            <div className="flex flex-col gap-1 select-none">
              <label className="text-[10px] uppercase font-mono tracking-widest text-stone-500">
                Duration (Seconds)
              </label>
              <input
                type="number"
                value={durationMs / 1000}
                onChange={(e) =>
                  setDurationMs((parseInt(e.target.value, 10) || 5) * 1000)
                }
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs font-mono text-stone-300 focus:outline-none focus:border-amber-500/30"
              />
            </div>
          </div>

          {/* Data selectors */}
          <div className="flex flex-col gap-2 select-none">
            <span className="text-[10px] uppercase font-mono tracking-widest text-stone-500">
              Select Dataset
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setDataSource('example');
                  loadExampleData();
                }}
                className={`py-2 rounded-lg font-mono text-xs border transition-all ${
                  dataSource === 'example'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                Canonical Example
              </button>
              <button
                onClick={() => {
                  setDataSource('upload');
                  setDataRows([]);
                  setFileName('');
                  setFileColumns([]);
                }}
                className={`py-2 rounded-lg font-mono text-xs border transition-all ${
                  dataSource === 'upload'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                Upload CSV/JSON
              </button>
            </div>
          </div>

          {/* Upload panel */}
          {dataSource === 'upload' && (
            <div className="border border-dashed border-stone-850 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3">
              <Upload size={24} className="text-stone-500" />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-stone-300 font-mono">
                  Upload Time-Series Data
                </span>
                <span className="text-[10px] text-stone-500 font-mono">
                  Accepts headers like{' '}
                  {template.source_schema.columns.join(', ')}
                </span>
              </div>
              <input
                type="file"
                accept=".csv,.json"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-stone-800 bg-stone-950 text-stone-400 hover:text-stone-200 font-mono text-[10px] uppercase tracking-wider transition-all"
              >
                Select File
              </button>
            </div>
          )}

          {/* Loaded details */}
          {fileName && (
            <div className="flex items-center justify-between border border-stone-850 bg-stone-950/20 rounded-xl p-3 shadow-sm select-none">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-amber-500" />
                <div className="flex flex-col">
                  <span className="text-xs text-stone-300 font-mono font-semibold truncate max-w-[200px]">
                    {fileName}
                  </span>
                  <span className="text-[9px] text-stone-500 font-mono">
                    {dataRows.length} total rows parsed
                  </span>
                </div>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-mono flex items-center gap-1">
                <Check size={10} /> Loaded
              </span>
            </div>
          )}

          {/* Column mappings */}
          {dataRows.length > 0 && (
            <div className="flex flex-col gap-3 select-none">
              <span className="text-[10px] uppercase font-mono tracking-widest text-stone-500">
                Auto-Calibration column binding
              </span>
              <div className="flex flex-col gap-2">
                {template.source_schema.columns.map((reqCol) => {
                  const actual = columnMapping[reqCol] || '';

                  // Calibration bounds preview calculation
                  const values = dataRows
                    .map((r) => Number(r[actual]))
                    .filter((v) => !isNaN(v));
                  const rangeStr =
                    values.length > 0
                      ? `[${Math.min(...values).toFixed(1)}, ${Math.max(...values).toFixed(1)}]`
                      : 'No numerical data';

                  return (
                    <div
                      key={reqCol}
                      className="border border-stone-850 bg-stone-950/20 rounded-xl p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-400 font-mono">
                          {reqCol}{' '}
                          <span className="text-[9px] text-stone-500">
                            (required)
                          </span>
                        </span>
                        <select
                          value={columnMapping[reqCol] || ''}
                          onChange={(e) =>
                            setColumnMapping({
                              ...columnMapping,
                              [reqCol]: e.target.value,
                            })
                          }
                          className="bg-stone-950 border border-stone-800 rounded px-2 py-1 text-[10px] font-mono text-stone-300 focus:outline-none"
                        >
                          {fileColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-mono text-stone-500">
                        <span>Auto-detected range:</span>
                        <span className="text-amber-500">{rangeStr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={handleInstantiate}
            disabled={loading || dataRows.length === 0}
            className="w-full py-2.5 rounded-lg text-xs font-mono uppercase bg-amber-500 text-stone-950 hover:bg-amber-400 font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all text-center flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 mt-2"
          >
            {loading ? (
              <div className="animate-spin h-3 w-3 border-2 border-stone-950 border-t-transparent rounded-full" />
            ) : (
              <Play size={12} fill="currentColor" />
            )}
            Instantiate & Render
          </button>
        </div>
      </div>
    </div>
  );
};

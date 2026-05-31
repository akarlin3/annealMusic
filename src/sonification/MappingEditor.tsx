import React, { useState } from 'react';
import { useSonificationStore } from './store';
import { CONTROL_DEFS } from '@/state/params';
import { Trash2, Plus, Activity, Sliders, Sparkles, Zap } from 'lucide-react';
import type { MappingRule, TransformType } from './types';
import './MappingEditor.css';

interface MappingEditorProps {
  onOpenCalibration: (ruleIndex: number) => void;
}

export const MappingEditor: React.FC<MappingEditorProps> = ({
  onOpenCalibration,
}) => {
  const { mappingSpec, addRule, removeRule } = useSonificationStore();
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedCol, setSelectedCol] = useState('');
  const [targetType, setTargetType] = useState<'param' | 'engineParam'>(
    'param',
  );
  const [selectedTarget, setSelectedTarget] = useState<string>('brightness');
  const [customEngineTarget, setCustomEngineTarget] = useState('');
  const [transformType, setTransformType] = useState<TransformType>('linear');
  const [rawMin, setRawMin] = useState('0');
  const [rawMax, setRawMax] = useState('100');
  const [outMin, setOutMin] = useState('0');
  const [outMax, setOutMax] = useState('1');
  const [steps, setSteps] = useState('5');

  const sources = mappingSpec.sources;

  const handleAddRule = () => {
    if (!selectedSource || !selectedCol) return;
    const finalTarget =
      targetType === 'param'
        ? selectedTarget
        : customEngineTarget || 'bell.decay';

    // Set default output bounds based on target parameter
    let defaultOutMin = 0;
    let defaultOutMax = 1;
    if (targetType === 'param') {
      const def = CONTROL_DEFS.find((d) => d.key === selectedTarget);
      if (def) {
        defaultOutMin = def.min;
        defaultOutMax = def.max;
      }
    }

    const newRule: MappingRule = {
      sourceId: selectedSource,
      column: selectedCol,
      targetType,
      targetKey: finalTarget,
      transform: {
        type: transformType,
        rawMin: parseFloat(rawMin) || 0,
        rawMax: parseFloat(rawMax) || 100,
        outMin:
          parseFloat(outMin) !== undefined ? parseFloat(outMin) : defaultOutMin,
        outMax:
          parseFloat(outMax) !== undefined ? parseFloat(outMax) : defaultOutMax,
        steps:
          transformType === 'discrete' ? parseInt(steps, 10) || 5 : undefined,
      },
    };

    addRule(newRule);

    // Reset inputs
    setSelectedCol('');
    setCustomEngineTarget('');
  };

  const getSourceColumns = () => {
    const src = sources.find((s) => s.id === selectedSource);
    return src ? src.columns : [];
  };

  return (
    <div className="mapping-editor-card">
      <div className="card-header">
        <Sliders className="icon-gold" size={20} />
        <h3>Data Mapping & Perceptual Calibration Rules</h3>
      </div>

      <p className="card-sub">
        Bind telemetry columns to faders. Calibrate output bounds perceptually.
      </p>

      {/* Add Mapping Form */}
      <div className="add-mapping-form">
        <div className="form-grid">
          <div className="form-group">
            <label>Data Source</label>
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setSelectedCol('');
              }}
            >
              <option value="">Select a source...</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.filename || `Synthetic (${s.formula?.slice(0, 15)}...)`}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Column / Variable</label>
            <select
              value={selectedCol}
              onChange={(e) => setSelectedCol(e.target.value)}
              disabled={!selectedSource}
            >
              <option value="">Select column...</option>
              {getSourceColumns().map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Target Class</label>
            <div className="segmented-control">
              <button
                type="button"
                className={targetType === 'param' ? 'active' : ''}
                onClick={() => setTargetType('param')}
              >
                Shared
              </button>
              <button
                type="button"
                className={targetType === 'engineParam' ? 'active' : ''}
                onClick={() => setTargetType('engineParam')}
              >
                Engine
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Synthesis Param</label>
            {targetType === 'param' ? (
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
              >
                {CONTROL_DEFS.map((def) => (
                  <option key={def.key} value={def.key}>
                    {def.label} ({def.key})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="e.g. bell.decay, fm.feedback"
                value={customEngineTarget}
                onChange={(e) => setCustomEngineTarget(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="form-divider" />

        <div className="form-grid second-row">
          <div className="form-group">
            <label>Scale Transform</label>
            <select
              value={transformType}
              onChange={(e) =>
                setTransformType(e.target.value as TransformType)
              }
            >
              <option value="linear">Linear Scale</option>
              <option value="log">Logarithmic</option>
              <option value="exp">Exponential</option>
              <option value="discrete">Discretized (Steps)</option>
            </select>
          </div>

          <div className="form-group range-group">
            <label>Raw Data Range (Min &rarr; Max)</label>
            <div className="range-inputs">
              <input
                type="number"
                placeholder="Min"
                value={rawMin}
                onChange={(e) => setRawMin(e.target.value)}
              />
              <span className="arrow">&rarr;</span>
              <input
                type="number"
                placeholder="Max"
                value={rawMax}
                onChange={(e) => setRawMax(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group range-group">
            <label>Audible Bounds (Min &rarr; Max)</label>
            <div className="range-inputs">
              <input
                type="number"
                step="0.01"
                placeholder="Out Min"
                value={outMin}
                onChange={(e) => setOutMin(e.target.value)}
              />
              <span className="arrow">&rarr;</span>
              <input
                type="number"
                step="0.01"
                placeholder="Out Max"
                value={outMax}
                onChange={(e) => setOutMax(e.target.value)}
              />
            </div>
          </div>

          {transformType === 'discrete' && (
            <div className="form-group">
              <label>Quantization Levels</label>
              <input
                type="number"
                min="2"
                max="20"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-add"
          disabled={!selectedSource || !selectedCol}
          onClick={handleAddRule}
        >
          <Plus size={16} /> Bind and Map Column
        </button>
      </div>

      {/* Rules List */}
      <div className="rules-list-container">
        <h4>Active Mappings ({mappingSpec.rules.length})</h4>
        {mappingSpec.rules.length === 0 ? (
          <div className="empty-rules">
            <Activity size={24} />
            <p>No parameter mappings created yet. Set up one above.</p>
          </div>
        ) : (
          <div className="rules-grid">
            {mappingSpec.rules.map((rule, idx) => {
              const src = sources.find((s) => s.id === rule.sourceId);
              return (
                <div key={idx} className="rule-card">
                  <div className="rule-badge">
                    <Zap size={12} />
                    <span>Rule #{idx + 1}</span>
                  </div>

                  <div className="rule-body">
                    <div className="rule-row">
                      <span className="label">Source:</span>
                      <span className="value truncate">
                        {src?.filename || 'Synthetic'}
                      </span>
                    </div>
                    <div className="rule-row">
                      <span className="label">Column:</span>
                      <span className="value font-mono highlight">
                        {rule.column}
                      </span>
                    </div>
                    <div className="rule-row">
                      <span className="label">Target Fader:</span>
                      <span className="value font-mono target">
                        {rule.targetKey}
                      </span>
                    </div>
                    <div className="rule-row">
                      <span className="label">Transform:</span>
                      <span className="value capitalize font-semibold">
                        {rule.transform.type} ({rule.transform.rawMin} &rarr;{' '}
                        {rule.transform.rawMax})
                      </span>
                    </div>
                  </div>

                  <div className="rule-actions">
                    <button
                      type="button"
                      className={`btn-calibrate ${rule.calibrated ? 'calibrated' : ''}`}
                      onClick={() => onOpenCalibration(idx)}
                    >
                      <Sparkles size={13} />
                      {rule.calibrated ? 'Calibrated' : 'Perceptual Calibrate'}
                    </button>

                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => removeRule(idx)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

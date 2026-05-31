import React, { useState, useEffect, useCallback } from 'react';
import { useSonificationStore } from './store';
import { CONTROL_DEFS, useParamStore } from '@/state/params';
import type { EngineId } from '@/audio/engines/types';
import {
  X,
  CheckCircle,
  HelpCircle,
  Play,
  Square,
  Sparkles,
} from 'lucide-react';
import './CalibrationDialog.css';

interface CalibrationDialogProps {
  ruleIndex: number;
  onClose: () => void;
}

export const CalibrationDialog: React.FC<CalibrationDialogProps> = ({
  ruleIndex,
  onClose,
}) => {
  const {
    mappingSpec,
    updateRule,
    orchestrator,
    isPlaying: storeIsPlaying,
  } = useSonificationStore();
  const rule = mappingSpec.rules[ruleIndex];

  // Hooks declared unconditionally at the top
  const [outMin, setOutMin] = useState(rule ? rule.transform.outMin : 0);
  const [outMax, setOutMax] = useState(rule ? rule.transform.outMax : 1);
  const [activeTest, setActiveTest] = useState<'none' | 'min' | 'max'>('none');

  const paramDef = rule
    ? CONTROL_DEFS.find((d) => d.key === rule.targetKey)
    : undefined;
  const paramLabel = paramDef ? paramDef.label : rule ? rule.targetKey : '';
  const paramMin = paramDef ? paramDef.min : 0;
  const paramMax = paramDef ? paramDef.max : 10;
  const paramStep = paramDef ? paramDef.step : 0.01;

  // Track if audio is actually playing in the sandbox
  const isAudioActive = orchestrator?.isRunning() || storeIsPlaying;

  const resetTestOverride = useCallback(() => {
    if (!orchestrator || !rule) return;

    // Restore normal parameter values from Zustand store
    const paramStore = useParamStore.getState();
    const currentVal =
      paramStore.params[rule.targetKey as keyof typeof paramStore.params];

    if (rule.targetType === 'param' && currentVal !== undefined) {
      orchestrator.setSharedParams({ [rule.targetKey]: currentVal }, true);
    } else if (rule.targetType === 'engineParam') {
      const parts = rule.targetKey.split('.');
      if (parts.length === 2) {
        const [engineId, paramKey] = parts;
        if (engineId && paramKey) {
          const currentEngVal =
            paramStore.engineParams[engineId as EngineId]?.[paramKey];
          if (currentEngVal !== undefined) {
            orchestrator.setEngineParams({ [paramKey]: currentEngVal });
          }
        }
      }
    }
  }, [orchestrator, rule]);

  useEffect(() => {
    // Clean up test overrides on unmount
    return () => {
      resetTestOverride();
    };
  }, [resetTestOverride]);

  if (!rule) {
    return null;
  }

  const playTestTone = (mode: 'min' | 'max') => {
    if (!orchestrator) return;

    const testValue = mode === 'min' ? outMin : outMax;
    setActiveTest(mode);

    if (rule.targetType === 'param') {
      orchestrator.setSharedParams({ [rule.targetKey]: testValue }, true);
    } else if (rule.targetType === 'engineParam') {
      const parts = rule.targetKey.split('.');
      if (parts.length === 2) {
        const [engineId, paramKey] = parts;
        const activeEngineId = useParamStore.getState().engineId;
        if (engineId === activeEngineId && paramKey) {
          orchestrator.setEngineParams({ [paramKey]: testValue });
        }
      }
    }
  };

  const stopTestTone = () => {
    setActiveTest('none');
    resetTestOverride();
  };

  const handleSave = () => {
    updateRule(ruleIndex, {
      calibrated: true,
      transform: {
        ...rule.transform,
        outMin,
        outMax,
      },
    });
    stopTestTone();
    onClose();
  };

  return (
    <div className="calibration-backdrop" onClick={onClose}>
      <div className="calibration-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-header">
          <Sparkles className="icon-gold" size={24} />
          <h2>Acoustic Calibration Mode</h2>
        </div>

        <div className="calibration-intro">
          <p>
            Adjust the audible bounds for the mapping from column{' '}
            <span className="code font-semibold">{rule.column}</span> to{' '}
            <span className="code font-semibold target">{paramLabel}</span>.
          </p>
          <p className="subtext">
            Test the extremes to ensure they remain inside comfortable, musical
            thresholds.
          </p>
        </div>

        {/* Warning if audio not running */}
        {!isAudioActive && (
          <div className="audio-warning">
            <HelpCircle size={18} />
            <span>
              <strong>Note:</strong> Start AnnealMusic playback to hear these
              calibration tones live.
            </span>
          </div>
        )}

        {/* Tone Test Panel */}
        <div className="test-panel">
          <div className="test-column">
            <h5>Minimum Audible Target</h5>
            <div className="test-value font-mono">
              {outMin.toFixed(paramDef?.step === 1 ? 0 : 2)}
            </div>
            {activeTest === 'min' ? (
              <button className="btn-test active" onClick={stopTestTone}>
                <Square size={13} fill="currentColor" /> Stop Test
              </button>
            ) : (
              <button
                className="btn-test"
                onClick={() => playTestTone('min')}
                disabled={!isAudioActive}
              >
                <Play size={13} fill="currentColor" /> Test Min Bound
              </button>
            )}
          </div>

          <div className="test-divider-vertical" />

          <div className="test-column">
            <h5>Maximum Audible Target</h5>
            <div className="test-value font-mono">
              {outMax.toFixed(paramDef?.step === 1 ? 0 : 2)}
            </div>
            {activeTest === 'max' ? (
              <button className="btn-test active" onClick={stopTestTone}>
                <Square size={13} fill="currentColor" /> Stop Test
              </button>
            ) : (
              <button
                className="btn-test"
                onClick={() => playTestTone('max')}
                disabled={!isAudioActive}
              >
                <Play size={13} fill="currentColor" /> Test Max Bound
              </button>
            )}
          </div>
        </div>

        {/* Bounds Tuning Sliders */}
        <div className="sliders-panel">
          <div className="slider-group">
            <div className="slider-label">
              <span>Audible Min Bound</span>
              <span className="val font-mono">{outMin}</span>
            </div>
            <input
              type="range"
              min={paramMin}
              max={paramMax}
              step={paramStep}
              value={outMin}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOutMin(val);
                if (activeTest === 'min') {
                  playTestTone('min');
                }
              }}
            />
          </div>

          <div className="slider-group">
            <div className="slider-label">
              <span>Audible Max Bound</span>
              <span className="val font-mono">{outMax}</span>
            </div>
            <input
              type="range"
              min={paramMin}
              max={paramMax}
              step={paramStep}
              value={outMax}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOutMax(val);
                if (activeTest === 'max') {
                  playTestTone('max');
                }
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-save" onClick={handleSave}>
            <CheckCircle size={15} /> Save Calibration
          </button>
        </div>
      </div>
    </div>
  );
};

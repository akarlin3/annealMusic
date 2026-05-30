import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type {
  ExperimentDefinition,
  TrialResult,
  SubjectDemographics,
  Trial,
  Block,
  Break,
} from './types';
import { ConsentScreen } from './screens/ConsentScreen';
import { DemographicScreen } from './screens/DemographicScreen';
import { TrialScreen } from './screens/TrialScreen';
import { BreakScreen } from './screens/BreakScreen';
import { DebriefScreen } from './screens/DebriefScreen';
import { exportExperimentData } from './export';
import { useAnnealMusic } from '@/hooks/useAnnealMusic';
import { DataLogger } from '@/datalog/DataLogger';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { hashSubjectId, getLatinSquareRow } from './utils';

interface ExperimentRunnerProps {
  isPreview?: boolean;
  previewDefinition?: ExperimentDefinition | null;
  onExitPreview?: () => void;
}

export const ExperimentRunner: React.FC<ExperimentRunnerProps> = ({
  isPreview = false,
  previewDefinition = null,
  onExitPreview,
}) => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const am = useAnnealMusic();

  // 1. Experiment definition state
  const [definition, setDefinition] = useState<ExperimentDefinition | null>(
    previewDefinition,
  );
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState<string | null>(null);

  // 2. Participant flow state
  const [currentStep, setCurrentStep] = useState<
    'consent' | 'demographics' | 'trials' | 'debrief'
  >('consent');
  const [activeStepIndex, setActiveStepIndex] = useState(0); // Index in definition.steps
  const [currentTrials, setCurrentTrials] = useState<Trial[]>([]); // Counterbalanced/randomized trials in current Block
  const [activeTrialIndex, setActiveTrialIndex] = useState(0); // Trial index inside current Block
  const [isFixation, setIsFixation] = useState(false);
  const [demographics, setDemographics] = useState<SubjectDemographics>({});
  const [results, setResults] = useState<TrialResult[]>([]);

  // 3. Subject Identity (query params check for Prolific/MTurk IDs, or UUID fallback)
  const [subjectId] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return (
      q.get('subId') ||
      q.get('subject_id') ||
      q.get('PROLIFIC_PID') ||
      q.get('ASSIGNMENT_ID') ||
      `sub-${Math.random().toString(36).substring(2, 11)}`
    );
  });

  // 4. Trial playback variables
  const [stimulusPlaying, setStimulusPlaying] = useState(false);
  const [responseValue, setResponseValue] = useState<unknown>(null);

  const activeTrialTicksRef = useRef<unknown[]>([]);
  const continuousSamplesRef = useRef<
    Array<{ time_ms: number; value: number }>
  >([]);
  const trialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeTickRef = useRef<(() => void) | null>(null);

  // Parse custom parameters for researcher redirects
  const postUrlFromParams =
    new URLSearchParams(window.location.search).get('postUrl') || undefined;

  // Fetch experiment definition if not in preview mode
  useEffect(() => {
    if (isPreview) {
      setDefinition(previewDefinition);
      setLoading(false);
      return;
    }

    if (!slug) {
      setError('No experiment identifier provided.');
      setLoading(false);
      return;
    }

    const host = window.location.origin;
    fetch(`${host}/api/v1/experiments/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error('Experiment not found or deactivated.');
        return res.json();
      })
      .then((data) => {
        setDefinition(data.definition);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch experiment.');
        setLoading(false);
      });
  }, [slug, isPreview, previewDefinition]);

  // Safeguard: Stop all synthesis on unmount to prevent audio leaks
  useEffect(() => {
    return () => {
      if (trialTimeoutRef.current) clearTimeout(trialTimeoutRef.current);
      if (unsubscribeTickRef.current) unsubscribeTickRef.current();
      am.stopSession();
      DataLogger.getInstance().stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shuffles array in-place (Fisher-Yates)
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };

  // Prepares the trial sequence for the current step (Block)
  const prepareBlockTrials = (block: Block) => {
    let trials = [...block.trials];

    if (block.randomize === 'full') {
      trials = shuffleArray(trials);
    } else if (block.counterbalance && trials.length > 0) {
      const subjectIndex = hashSubjectId(subjectId);
      const latinSquareRow = getLatinSquareRow(trials.length, subjectIndex);
      // Map trials based on Williams Latin Square permutation
      trials = latinSquareRow.map((idx) => trials[idx]!);
    }

    setCurrentTrials(trials);
    setActiveTrialIndex(0);
  };

  // Saves a completed trial's data payload into state
  const saveTrialResult = useCallback(
    (value: unknown, rtMs: number | null = null) => {
      if (trialTimeoutRef.current) clearTimeout(trialTimeoutRef.current);

      // Stop playback if still active
      am.stopSession();
      DataLogger.getInstance().stop();
      if (unsubscribeTickRef.current) {
        unsubscribeTickRef.current();
        unsubscribeTickRef.current = null;
      }
      setStimulusPlaying(false);

      const trial = currentTrials[activeTrialIndex];
      if (!trial) return;

      const globalTrialIndex = results.length;

      const resultItem: TrialResult = {
        subject_id: subjectId,
        trial_index: globalTrialIndex,
        stimulus_id: trial.stimulus.id,
        response_type: trial.response.type,
        response_value: value,
        rt_ms: rtMs,
        timestamp: new Date().toISOString(),
      };

      // Attach raw datalogger features to the result item (for export.ts JSONL compiler)
      (resultItem as { datalogger_ticks?: unknown[] }).datalogger_ticks = [
        ...activeTrialTicksRef.current,
      ];

      setResults((prev) => [...prev, resultItem]);
      setResponseValue(null);

      // Proceed to inter-trial interval (Fixation "+" for 500ms)
      setIsFixation(true);
      setTimeout(() => {
        setIsFixation(false);

        const nextTrialIdx = activeTrialIndex + 1;
        if (nextTrialIdx < currentTrials.length) {
          setActiveTrialIndex(nextTrialIdx);
          playStimulus(currentTrials[nextTrialIdx]!);
        } else {
          // Current block completed. Advance to next step in definition.steps list
          advanceStep();
        }
      }, 500);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [am, currentTrials, activeTrialIndex, results, subjectId],
  );

  // Triggers stimulus onset and logs audio thread parameters
  const playStimulus = useCallback(
    (trial: Trial) => {
      if (trialTimeoutRef.current) clearTimeout(trialTimeoutRef.current);
      if (unsubscribeTickRef.current) unsubscribeTickRef.current();

      setStimulusPlaying(true);
      setResponseValue(null);
      activeTrialTicksRef.current = [];
      continuousSamplesRef.current = [];

      // Apply synthesizer patch parameters directly to ParamStore
      if (trial.stimulus.patch) {
        Object.entries(trial.stimulus.patch).forEach(([k, v]) => {
          if (k === 'engine') {
            am.setEngine(v as 'sine' | 'waveguide' | 'bowed' | 'pulse');
          } else {
            am.setParam(
              k as
                | 'rootFreq'
                | 'brightness'
                | 'space'
                | 'spread'
                | 'density'
                | 'coupling'
                | 'drift'
                | 'volume',
              v as number,
            );
          }
        });
      }

      // Initialize Datalogger stream
      const logger = DataLogger.getInstance();
      logger.clear();
      logger.start('standard', 30); // sample at 30Hz

      unsubscribeTickRef.current = logger.subscribeTick((tick) => {
        activeTrialTicksRef.current.push(tick);
      });

      // Start Audio Engine playback
      am.startSession();

      // Schedule stop session strictly matching the stimulus duration limit
      const durationMs = trial.stimulus.duration * 1000;
      trialTimeoutRef.current = setTimeout(() => {
        am.stopSession();
        logger.stop();
        if (unsubscribeTickRef.current) {
          unsubscribeTickRef.current();
          unsubscribeTickRef.current = null;
        }
        setStimulusPlaying(false);

        // Auto-save results for Continuous response types at playback completion
        if (trial.response.type === 'Continuous') {
          saveTrialResult(continuousSamplesRef.current);
        }
      }, durationMs);
    },
    [am, saveTrialResult],
  );

  // Navigates between consent, surveys, blocks, and debriefing
  const advanceStep = () => {
    if (!definition) return;

    if (currentStep === 'consent') {
      if (definition.demographics) {
        setCurrentStep('demographics');
      } else {
        setCurrentStep('trials');
        setActiveStepIndex(0);
        const firstStep = definition.steps[0];
        if (firstStep && firstStep.type === 'block') {
          prepareBlockTrials(firstStep);
        }
      }
    } else if (currentStep === 'demographics') {
      setCurrentStep('trials');
      setActiveStepIndex(0);
      const firstStep = definition.steps[0];
      if (firstStep && firstStep.type === 'block') {
        prepareBlockTrials(firstStep);
      }
    } else if (currentStep === 'trials') {
      const nextStepIdx = activeStepIndex + 1;
      if (nextStepIdx < definition.steps.length) {
        setActiveStepIndex(nextStepIdx);
        const nextStep = definition.steps[nextStepIdx]!;
        if (nextStep.type === 'block') {
          prepareBlockTrials(nextStep);
        }
      } else {
        setCurrentStep('debrief');
      }
    }
  };

  // Init playback for first trial of a block
  useEffect(() => {
    if (
      currentStep === 'trials' &&
      currentTrials.length > 0 &&
      activeTrialIndex === 0
    ) {
      playStimulus(currentTrials[0]!);
    }
  }, [currentStep, currentTrials, activeTrialIndex, playStimulus]);

  // Safe exit command to abort active sessions
  const handleWithdraw = () => {
    if (
      window.confirm(
        'Withdraw immediately? All collected data from this session will be permanently erased.',
      )
    ) {
      if (trialTimeoutRef.current) clearTimeout(trialTimeoutRef.current);
      if (unsubscribeTickRef.current) unsubscribeTickRef.current();
      am.stopSession();
      DataLogger.getInstance().stop();

      if (isPreview && onExitPreview) {
        onExitPreview();
      } else {
        navigate('/');
      }
    }
  };

  // Trigger Local ZIP Download export
  const handleDownloadZip = () => {
    if (!definition) return;
    const blob = exportExperimentData(
      definition,
      results,
      demographics,
      subjectId,
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `am_exp_${slug || 'preview'}_${subjectId}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Trigger POST request to lab server
  const handlePostSubmit = async (url: string): Promise<boolean> => {
    if (!definition) return false;
    const manifest = {
      experiment_title: definition.title,
      subject_id: subjectId,
      timestamp: new Date().toISOString(),
      demographics,
      results: results.map((r) => ({
        trial_index: r.trial_index,
        stimulus_id: r.stimulus_id,
        response_type: r.response_type,
        response_value: r.response_value,
        rt_ms: r.rt_ms,
        timestamp: r.timestamp,
      })),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manifest),
    });
    return res.ok;
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-stone-950 text-stone-100 min-h-screen font-mono select-none">
        <RefreshCw size={28} className="animate-spin text-amber-500 mb-4" />
        <p className="text-xs uppercase tracking-widest text-stone-500">
          Loading Experiment configuration...
        </p>
      </div>
    );
  }

  if (error || !definition) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-stone-950 text-stone-100 min-h-screen font-mono select-none p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20 mb-4">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-300">
          Configuration Error
        </h2>
        <p className="text-xs text-stone-500 mt-2 max-w-sm">
          {error || 'Failed to initialize experiment framework.'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-6 py-2.5 rounded-lg text-xs font-mono uppercase bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 transition-all"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-stone-950 text-stone-100 min-h-screen items-center justify-center p-4 md:p-8 overflow-y-auto">
      {/* Visualizer disabled for trial context by default unless specified on the stimulus object */}
      {currentStep === 'consent' && (
        <ConsentScreen
          definition={definition}
          onAccept={advanceStep}
          onWithdraw={handleWithdraw}
        />
      )}

      {currentStep === 'demographics' && definition.demographics && (
        <DemographicScreen
          definition={definition.demographics}
          onSubmit={(data) => {
            setDemographics(data);
            advanceStep();
          }}
        />
      )}

      {currentStep === 'trials' && currentTrials.length > 0 && (
        <TrialScreen
          trial={currentTrials[activeTrialIndex]!}
          trialIndex={activeTrialIndex}
          totalTrials={currentTrials.length}
          blockName={
            definition.steps[activeStepIndex]?.type === 'block'
              ? (definition.steps[activeStepIndex] as Block).name
              : 'Main'
          }
          isFixation={isFixation}
          responseValue={responseValue}
          onResponseChange={setResponseValue}
          onComplete={() => saveTrialResult(responseValue)}
          onEngineParamChange={(p, v) => {
            am.setParam(
              p as
                | 'rootFreq'
                | 'brightness'
                | 'space'
                | 'spread'
                | 'density'
                | 'coupling'
                | 'drift'
                | 'volume',
              v,
            );
          }}
          onSampleContinuous={(t, v) => {
            continuousSamplesRef.current.push({ time_ms: t, value: v });
          }}
          onReactionTimeComplete={(rt) => {
            saveTrialResult(rt, rt);
          }}
          stimulusPlaying={stimulusPlaying}
        />
      )}

      {currentStep === 'trials' &&
        definition.steps[activeStepIndex]?.type === 'break' && (
          <BreakScreen
            message={(definition.steps[activeStepIndex] as Break).message}
            onContinue={advanceStep}
          />
        )}

      {currentStep === 'debrief' && (
        <DebriefScreen
          definition={definition}
          results={results}
          demographics={demographics}
          onDownload={handleDownloadZip}
          onSubmit={handlePostSubmit}
          onWithdraw={handleWithdraw}
          postUrlFromParams={postUrlFromParams}
        />
      )}
    </div>
  );
};
export default ExperimentRunner;

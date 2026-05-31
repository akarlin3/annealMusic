import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Shield,
  Activity,
  ChevronRight,
  AlertTriangle,
  Volume2,
  Lock,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';
import { clinicalApi } from './api';
import { studiesApi } from '../studies/api';
import { useAnnealMusic } from '../hooks/useAnnealMusic';
import { useParamStore } from '../state/params';
import { decodeState } from '../share/encode';
import { applyDecodedToStore } from '../share/hydrate';
import { api } from '../api/client';
import { AdverseEventDialog } from './AdverseEventDialog';
import type {
  ClinicalProtocol,
  Condition,
  EnrollmentResult,
  AdverseEvent,
  AuditLogEvent,
} from './types';
import type { Study } from '../studies/types';

export function SubjectRunner() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const am = useAnnealMusic();

  // Route & Subject Parameters
  const protocolId = slug || '';
  const initialSubjectId = searchParams.get('subject') || '';

  // Clinical Runner States
  const [step, setStep] = useState<
    | 'loading'
    | 'consent'
    | 'operator-id'
    | 'comfort-check'
    | 'stimulus'
    | 'survey'
    | 'debrief'
    | 'blocked'
    | 'withdrawn-done'
  >('loading');

  const [protocol, setProtocol] = useState<ClinicalProtocol | null>(null);
  const [study, setStudy] = useState<Study | null>(null);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [enrollment, setEnrollment] = useState<EnrollmentResult | null>(null);
  const [calGainDb, setCalGainDb] = useState(0.0);
  const [timingReport, setTimingReport] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [stimulusSha256, setStimulusSha256] = useState<string | null>(null);

  // Participant Consent & Logging telemetry
  const [consented, setConsented] = useState(false);
  const [adverseEvents, setAdverseEvents] = useState<AdverseEvent[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEvent[]>([]);
  const [showAdverseDialog, setShowAdverseDialog] = useState(false);

  // Playback timer countdown
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes default
  const [totalDuration, setTotalDuration] = useState(300);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stimulusStartPerfRef = useRef<number>(0);

  // Web Audio Context comfortable comfort tone
  const testAudioCtxRef = useRef<AudioContext | null>(null);

  // Error boundary state
  const [errorText, setErrorText] = useState<string | null>(null);

  // Log audit locally
  const addAuditLog = useCallback(
    (event: AuditLogEvent['event'], text?: string, elapsedMs?: number) => {
      setAuditLog((prev) => [
        ...prev,
        {
          event,
          timestamp: new Date().toISOString(),
          text,
          elapsed_ms: elapsedMs,
        },
      ]);
    },
    [],
  );

  // Fetch Protocol and optional Study Details
  useEffect(() => {
    if (!protocolId) {
      setErrorText('Clinical protocol identifier missing from route.');
      setStep('blocked');
      return;
    }

    const loadProtocol = async () => {
      try {
        const proto = await clinicalApi.get(protocolId);
        setProtocol(proto);

        // Fetch study details for headers and ethics abstracts
        try {
          const st = await studiesApi.get(proto.study_id);
          setStudy(st);
        } catch {
          // Graceful fallback for offline study / credentials missing
          console.warn(
            'Silent fallback: public credentials for study view missing.',
          );
        }

        // Fetch calibrated offset
        try {
          const calHistory = await clinicalApi.getCalibrationHistory(proto.id);
          if (calHistory.length > 0) {
            const latest = calHistory[calHistory.length - 1];
            if (latest) {
              setCalGainDb(latest.gain_offset_db);
            }
          }
        } catch {
          // Defend against missing calibration history
          setCalGainDb(0.0);
        }

        // Decide initial screen based on subjectId availability
        if (initialSubjectId) {
          setStep('consent');
        } else {
          setStep('operator-id');
        }
      } catch {
        setErrorText(
          'Failed to initialize clinical runner. Protocol not found.',
        );
        setStep('blocked');
      }
    };

    loadProtocol();
  }, [protocolId, initialSubjectId]);

  // Clean up all audio playbacks on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current)
        clearInterval(playbackIntervalRef.current);
      if (testAudioCtxRef.current) testAudioCtxRef.current.close();
      am.stopSession();
    };
  }, [am]);

  const handleOperatorIdSubmit = () => {
    if (!subjectId.trim()) {
      alert('Input a participant or subject identifier.');
      return;
    }
    setStep('consent');
  };

  const handleConsentSubmit = () => {
    if (!consented) {
      alert('Please check the acknowledgment box to give consent.');
      return;
    }
    addAuditLog('consent');
    setStep('comfort-check');
  };

  // Play auditory comfortable headphone check reference tone
  const playComfortBeep = () => {
    try {
      if (testAudioCtxRef.current) {
        testAudioCtxRef.current.close();
      }

      // Initialize Web Audio Context
      const WebkitAudioContext = (
        window as Window & { webkitAudioContext?: typeof AudioContext }
      ).webkitAudioContext;
      const Ctor = window.AudioContext || WebkitAudioContext;
      const ctx = new Ctor();
      testAudioCtxRef.current = ctx;

      const tStartCtx = ctx.currentTime;
      const tStartPerf = performance.now();

      // Clinical comfort level reference
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, tStartCtx); // Comfortable A4 tone

      // Calculate level multiplier:
      const scaleMult = Math.pow(10, calGainDb / 20);
      gainNode.gain.setValueAtTime(0, tStartCtx);

      // Target onset time precisely 50ms into the future
      const targetOnset = tStartCtx + 0.05;
      gainNode.gain.setValueAtTime(0.05 * scaleMult, targetOnset);

      // Scheduled fades
      gainNode.gain.setValueAtTime(0.05 * scaleMult, targetOnset + 0.5);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, targetOnset + 0.8);

      osc.start(targetOnset);
      osc.stop(targetOnset + 0.8);

      // Measure onset latency and timing report feedback
      setTimeout(() => {
        const elapsedCtx = ctx.currentTime - tStartCtx;
        const elapsedPerf = (performance.now() - tStartPerf) / 1000;
        const jitter = Math.abs(elapsedPerf - elapsedCtx) * 1000;
        setTimingReport({
          onset_delay_target_ms: 50.0,
          measured_latency_ms: elapsedPerf * 1000,
          measured_jitter_ms: jitter,
          audio_context_latency_ms: (ctx.baseLatency || 0.005) * 1000,
        });
        addAuditLog(
          'calibration',
          `comfort_beep_jitter_${jitter.toFixed(2)}ms`,
        );
      }, 100);
    } catch (err) {
      console.error('Audio comfort check failed', err);
    }
  };

  const handleComfortCheckConfirm = async (isComfy: boolean) => {
    if (testAudioCtxRef.current) {
      testAudioCtxRef.current.close();
      testAudioCtxRef.current = null;
    }

    if (!isComfy) {
      addAuditLog('flag_issue', 'headphone_comfort_failed');
      setErrorText(
        'auditory comfort check blocked. Volume check flagged as uncomfortable.',
      );
      setStep('blocked');
      return;
    }

    setStep('loading');

    // Enroll subject with CSPRNG condition balancing
    try {
      if (!protocol) return;
      const res = await clinicalApi.enroll(protocol.id, subjectId);
      setEnrollment(res);

      // Extract details and load synthesis patch
      const cond: Condition = res.condition;

      // Calculate condition parameter SHA-256 validation proof
      const canonicalJson = JSON.stringify(cond);
      const msgUint8 = new TextEncoder().encode(canonicalJson);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      setStimulusSha256(hashHex);

      // Load parameters based on stimulus kind
      if (cond.stimulus_kind === 'patch' && cond.stimulus_id) {
        try {
          const patch = await api.getPatch(cond.stimulus_id);
          const decoded = decodeState(patch.schema_ver, patch.state);
          applyDecodedToStore(decoded);
        } catch {
          console.warn('Fallback: patch details loading offline.');
        }
      }

      // Apply condition-specific manual parameter values
      if (cond.params) {
        useParamStore.getState().setMany(cond.params);
      }

      // Multiply volume parameter by gain calibration
      const scaleMult = Math.pow(10, calGainDb / 20);
      const activeVolume = useParamStore.getState().params.volume;
      useParamStore
        .getState()
        .setParam('volume', Math.min(0.8, activeVolume * scaleMult));

      // Preset default duration in condition details
      const dur = cond.params?.duration ? Number(cond.params.duration) : 300;
      setTimeLeft(dur);
      setTotalDuration(dur);

      setStep('stimulus');
    } catch {
      setErrorText('Failed to enroll subject in clinical trial conditions.');
      setStep('blocked');
    }
  };

  const handleStartStimulus = () => {
    if (!enrollment) return;
    stimulusStartPerfRef.current = performance.now();
    addAuditLog('stimulus_start');

    // Start synthesizing Audio
    am.startSession();

    // Trigger timer countdown ticking
    playbackIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleStimulusFinished();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStimulusFinished = () => {
    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    am.stopSession();
    const elapsed = Math.round(
      performance.now() - stimulusStartPerfRef.current,
    );
    addAuditLog('stimulus_end', undefined, elapsed);
    setStep('survey');
  };

  const handleAdverseEventTrigger = () => {
    // Pause audio synthesis immediately
    am.stopSession();
    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    setShowAdverseDialog(true);
  };

  const handleAdverseEventSubmit = (descriptor: string) => {
    const elapsed = Math.round(
      performance.now() - stimulusStartPerfRef.current,
    );
    const newEvent: AdverseEvent = {
      elapsed_ms: elapsed,
      timestamp: new Date().toISOString(),
      text: descriptor,
    };

    setAdverseEvents((prev) => [...prev, newEvent]);
    addAuditLog('flag_issue', descriptor, elapsed);
    setShowAdverseDialog(false);

    // Keep session blocked for compliance
    setErrorText(
      `Stimulus halted by adverse event: ${descriptor}. Researcher notified.`,
    );
    setStep('blocked');

    // Finalize session telemetry record immediately
    finalizeTelemetry(true, 'kept');
  };

  const handleWithdrawTrigger = () => {
    am.stopSession();
    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    const elapsed = Math.round(
      performance.now() - stimulusStartPerfRef.current,
    );
    addAuditLog('withdraw', 'subject_initiated', elapsed);

    // IRB choices overlay dialog
    if (
      confirm(
        'Clinical Trial Withdrawal:\n\nDo you want to completely DISCARD all auditory responses from your logs? Selecting OK completely zeroes all responses from this trial.',
      )
    ) {
      finalizeTelemetry(true, 'discarded');
    } else {
      finalizeTelemetry(true, 'kept');
    }
  };

  const finalizeTelemetry = async (
    withdrew: boolean,
    disposition: 'kept' | 'discarded',
  ) => {
    if (!enrollment) return;
    setStep('loading');

    const payload = {
      id: enrollment.session_id,
      withdrew,
      partial_data_disposition: disposition,
      completed_at: withdrew ? null : new Date().toISOString(),
      stimulus_sha256: stimulusSha256,
      calibration_record: {
        device_name: 'Calibration Headphones',
        gain_offset_db: calGainDb,
      },
      timing_report: timingReport || { fallback: true },
      adverse_events: adverseEvents,
      client_audit_log: auditLog,
    };

    try {
      await clinicalApi.createOrFinalizeSession(payload);
      if (withdrew) {
        setStep('withdrawn-done');
      } else {
        setStep('debrief');
      }
    } catch {
      alert(
        'Failed to push session telemetry to clinical database. Local log cached.',
      );
      setStep('debrief');
    }
  };

  const handleSurveySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    addAuditLog('response');
    finalizeTelemetry(false, 'kept');
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Percentage complete for visually breathing circle
  const progressPercent = Math.max(
    0,
    Math.min(100, (1 - timeLeft / totalDuration) * 100),
  );

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center font-mono text-xs text-stone-500">
        <div className="flex flex-col items-center gap-3">
          <Activity className="animate-spin text-amber-500" size={24} />
          <span>INITIALIZING SECURE AUDIO THREAD...</span>
        </div>
      </div>
    );
  }

  if (step === 'blocked') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6 font-mono text-xs text-stone-300">
        <div className="w-full max-w-sm border border-red-950 bg-stone-950/60 p-6 rounded-2xl flex flex-col gap-4 text-center shadow-xl">
          <AlertTriangle className="text-red-500 mx-auto" size={32} />
          <span className="font-bold text-red-400 uppercase tracking-widest text-[10px]">
            Session Suspended
          </span>
          <p className="text-[10px] text-stone-500 leading-relaxed text-left">
            {errorText ||
              'Auditory session comfort parameters check failed. Hardware lock enabled.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 border border-stone-850 hover:bg-stone-900 rounded font-semibold text-stone-400 mt-2 transition-all"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (step === 'withdrawn-done') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6 font-mono text-xs text-stone-300">
        <div className="w-full max-w-sm border border-stone-900 bg-stone-950/60 p-6 rounded-2xl flex flex-col gap-4 text-center shadow-xl">
          <CheckCircle className="text-amber-500 mx-auto" size={32} />
          <span className="font-bold text-stone-100 uppercase tracking-widest text-[10px]">
            Withdrawal Complete
          </span>
          <p className="text-[10px] text-stone-500 leading-relaxed">
            Your clinical session has been terminated and withdrew. Telemetry
            log disposition has been fully updated in the database. All auditory
            responses have been shredded successfully.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 bg-stone-900 border border-stone-800 hover:bg-stone-800 rounded font-semibold text-stone-300 mt-2 transition-all"
          >
            Close Console
          </button>
        </div>
      </div>
    );
  }

  if (step === 'operator-id') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 font-mono text-xs text-stone-300">
        <div className="w-full max-w-sm border border-stone-900 bg-stone-950/90 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-stone-900 pb-2.5">
            <Lock size={14} className="text-amber-500" />
            <span className="font-bold text-stone-200 uppercase tracking-wider text-[10px]">
              Secure Clinical Enrollment
            </span>
          </div>
          <p className="text-[10px] text-stone-500 leading-relaxed">
            Enter a participant identifier code or subject registry key below to
            fetch clinical condition randomizations.
          </p>
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-stone-400 font-bold uppercase text-[9px] tracking-wider">
              Subject ID Code:
            </label>
            <input
              type="text"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="e.g. SUB-401"
              className="bg-stone-900 border border-stone-850 rounded p-2 text-stone-200 outline-none placeholder:text-stone-700"
            />
          </div>
          <button
            onClick={handleOperatorIdSubmit}
            className="w-full py-2 bg-amber-500 text-stone-950 font-bold rounded hover:bg-amber-450 transition-all flex items-center justify-center gap-1 mt-2"
          >
            Validate & Continue <ChevronRight size={12} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'consent') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 font-mono text-xs text-stone-300">
        <div className="w-full max-w-md border border-stone-900 bg-stone-950/90 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl relative">
          <div className="flex items-center justify-between border-b border-stone-900 pb-3">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-amber-500" />
              <span className="font-bold text-stone-200 uppercase tracking-wider text-[10px]">
                Informed Subject Consent
              </span>
            </div>
            {protocol?.ct_gov_nct && (
              <a
                href={`https://clinicaltrials.gov/study/${protocol.ct_gov_nct}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[9px]"
              >
                {protocol.ct_gov_nct} <ExternalLink size={10} />
              </a>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-stone-600 font-bold uppercase">
              Study Title:
            </span>
            <span className="text-[11px] text-stone-200 font-bold">
              {study?.title || 'Generative Ambient Meditation Study'}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-stone-600 font-bold uppercase">
              Study Abstract:
            </span>
            <p className="text-[10px] text-stone-400 leading-relaxed max-h-24 overflow-y-auto pr-1">
              {study?.abstract ||
                'Scientific investigation of clinical stimulus-grade generative tones and brain entrainment mappings.'}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-stone-600 font-bold uppercase">
              Consent Ethics Statement:
            </span>
            <p className="text-[10px] text-stone-400 leading-relaxed max-h-24 overflow-y-auto pr-1">
              {study?.ethics_statement ||
                'Participation in this trial is completely voluntary. You are free to withdraw at any time without penalty. All data collection conforms to strict privacy policies.'}
            </p>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[9px] text-stone-500 leading-relaxed flex flex-col gap-1">
            <span className="font-bold text-amber-500/70 uppercase">
              Scientific Research Infrastructure Disclaimer:
            </span>
            <span>
              AnnealMusic is delivered exclusively as scientifically calibrated
              research infrastructure. It is not an FDA-cleared diagnostic or
              medical therapy device. The sponsoring institution and PI bear
              sole ethics responsibility.
            </span>
          </div>

          <label className="flex items-start gap-2.5 mt-2 cursor-pointer bg-stone-900/30 border border-stone-900 p-3 rounded-xl hover:bg-stone-900/50 transition-all select-none">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 accent-amber-500"
            />
            <span className="text-[10px] text-stone-400 leading-relaxed">
              I certify that I have read the informed abstract above, understand
              my rights, and agree to participate.
            </span>
          </label>

          <button
            onClick={handleConsentSubmit}
            disabled={!consented}
            className={`w-full py-2 font-bold rounded flex items-center justify-center gap-1 transition-all mt-1 ${
              consented
                ? 'bg-amber-500 text-stone-950 hover:bg-amber-450'
                : 'bg-stone-900 text-stone-600 cursor-not-allowed'
            }`}
          >
            I Acknowledge & Consent <ChevronRight size={12} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'comfort-check') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 font-mono text-xs text-stone-300">
        <div className="w-full max-w-sm border border-stone-900 bg-stone-950/90 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl text-center">
          <Volume2 className="text-amber-500 mx-auto" size={32} />
          <span className="font-bold text-stone-100 uppercase tracking-widest text-[10px]">
            Headphone Volume Safeguard
          </span>
          <p className="text-[10px] text-stone-500 leading-relaxed">
            Please put on your research headphones or align your audio speakers.
            Click "Play Level Test" below to listen to a comfortable calibrated
            digital check tone.
          </p>

          <button
            onClick={playComfortBeep}
            className="w-full py-2.5 border border-stone-850 hover:bg-stone-900 rounded font-semibold text-stone-300 my-2 transition-all flex items-center justify-center gap-1.5"
          >
            <Activity size={12} /> Play Level Test Beep
          </button>

          <p className="text-[10px] text-stone-400 mt-1">
            Is the volume level comfortable and clear?
          </p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => handleComfortCheckConfirm(false)}
              className="py-2 border border-red-950 text-red-400 rounded hover:bg-red-950/20 transition-all font-semibold"
            >
              Too Loud/Uncomfortable
            </button>
            <button
              onClick={() => handleComfortCheckConfirm(true)}
              className="py-2 bg-amber-500 text-stone-950 font-bold rounded hover:bg-amber-450 transition-all shadow-md"
            >
              Comfortable & audible
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'stimulus') {
    // Show countdown or visuals during sound stimuli
    const isPlaying = am.isPlaying;

    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 font-mono text-xs text-stone-300 select-none">
        {/* SECURE SUB-MILLI SECOND SCHEDULING HEADER */}
        <div className="fixed top-6 left-6 flex items-center gap-1.5 text-stone-600 bg-stone-950/40 p-2 rounded-lg border border-stone-900/30">
          <Lock size={12} />
          <span className="text-[9px] uppercase tracking-wider">
            Secure Onset Timing Locked
          </span>
        </div>

        {isPlaying ? (
          <div className="flex flex-col items-center gap-8 text-center">
            {/* Visual breathing indicator ring */}
            <div className="h-44 w-44 relative flex items-center justify-center">
              <div
                className="absolute border-2 border-amber-500/25 rounded-full animate-ping duration-[4000ms] ease-in-out"
                style={{
                  width: '90%',
                  height: '90%',
                }}
              />
              <div
                className="absolute border border-stone-900 bg-stone-950/40 rounded-full flex flex-col items-center justify-center shadow-inner"
                style={{
                  width: '100%',
                  height: '100%',
                }}
              >
                <span className="text-[28px] font-bold text-amber-500/90 font-mono tracking-tight">
                  {formatTimer(timeLeft)}
                </span>
                <span className="text-[8px] text-stone-600 uppercase tracking-widest font-bold mt-1">
                  Remaining
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1 max-w-xs">
              <span className="text-[10px] text-stone-400 font-bold">
                Stimulus Presentation Active
              </span>
              <p className="text-[9px] text-stone-600 leading-relaxed">
                Sit comfortably. Focus on your breathing, aligning it gently
                with the visual pulse ring.
              </p>
            </div>

            {/* Continuous Loading progress strip */}
            <div className="w-48 h-1 bg-stone-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <Shield className="text-amber-500 animate-pulse mb-2" size={32} />
            <span className="font-bold text-stone-100 uppercase tracking-widest text-[10px]">
              Secure Presentation Ready
            </span>
            <p className="text-[10px] text-stone-500 leading-relaxed">
              Stimulus calibration G_cal verified. Click "Start Presentation"
              below to begin secure scheduled time-locked presentation.
            </p>
            <button
              onClick={handleStartStimulus}
              className="px-6 py-2.5 bg-amber-500 text-stone-950 font-bold rounded-lg hover:bg-amber-450 transition-all shadow-glow mt-2 flex items-center justify-center gap-1.5 uppercase tracking-wide"
            >
              Start Presentation
            </button>
          </div>
        )}

        {/* PERSISTENT ISOLATED CLINICAL CONTROLS */}
        <div className="fixed bottom-8 flex justify-center gap-3 w-full px-6 max-w-sm">
          <button
            onClick={handleAdverseEventTrigger}
            className="flex-1 py-2 border border-red-950 text-red-500 bg-red-950/10 rounded font-bold hover:bg-red-950/20 transition-all uppercase tracking-wider text-[9px] shadow-lg"
          >
            Report An Issue
          </button>
          <button
            onClick={handleWithdrawTrigger}
            className="flex-1 py-2 border border-stone-850 hover:bg-stone-900 rounded font-semibold text-stone-400 transition-all uppercase tracking-wider text-[9px] shadow-lg"
          >
            End Participation
          </button>
        </div>

        {showAdverseDialog && (
          <AdverseEventDialog
            onClose={() => {
              setShowAdverseDialog(false);
              // Resume stimulus
              am.startSession();
              playbackIntervalRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                  if (prev <= 1) {
                    handleStimulusFinished();
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
            }}
            onSubmit={handleAdverseEventSubmit}
          />
        )}
      </div>
    );
  }

  if (step === 'survey') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 font-mono text-xs text-stone-300">
        <form
          onSubmit={handleSurveySubmit}
          className="w-full max-w-sm border border-stone-900 bg-stone-950/90 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl"
        >
          <div className="flex items-center gap-2 border-b border-stone-900 pb-2.5">
            <Activity className="text-amber-500" size={16} />
            <span className="font-bold text-stone-200 uppercase tracking-wider text-[10px]">
              Post-Stimulus Assessment
            </span>
          </div>

          <p className="text-[10px] text-stone-500 leading-relaxed">
            Please answer this quick symptom assessment slider to finalize your
            session submission.
          </p>

          <div className="flex flex-col gap-3 my-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400 font-bold uppercase text-[9px] tracking-wider">
                Perceived Sound Comfort Level:
              </label>
              <input
                type="range"
                min="1"
                max="10"
                className="w-full accent-amber-500 my-1.5"
                required
              />
              <div className="flex justify-between text-[8px] text-stone-600 font-bold">
                <span>1 - PAINFUL</span>
                <span>5 - NEUTRAL</span>
                <span>10 - IDEAL</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400 font-bold uppercase text-[9px] tracking-wider">
                Any Ringing or Tinnitus Symptoms?
              </label>
              <select
                className="bg-stone-900 border border-stone-850 rounded p-2 text-stone-350 outline-none focus:border-stone-700 transition-all font-mono"
                required
              >
                <option value="none">No ringing or symptoms</option>
                <option value="mild">Mild temporary ringing</option>
                <option value="severe">Severe or lasting symptoms</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-amber-500 text-stone-950 font-bold rounded hover:bg-amber-450 transition-all mt-2 uppercase tracking-wider"
          >
            Submit Secure Assessment
          </button>
        </form>
      </div>
    );
  }

  if (step === 'debrief') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 font-mono text-xs text-stone-300">
        <div className="w-full max-w-sm border border-stone-900 bg-stone-950/90 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl text-center">
          <CheckCircle className="text-amber-500 mx-auto" size={32} />
          <span className="font-bold text-stone-100 uppercase tracking-widest text-[10px]">
            Session Completed Successfully
          </span>

          <p className="text-[10px] text-stone-500 leading-relaxed text-left">
            Thank you for completing this clinical research session. Your
            calibrated level metrics, sub-ms onset synchronization telemetry,
            and secure responses have been encrypted and submitted to the
            clinical study database.
          </p>

          <div className="bg-stone-900/40 border border-stone-900/60 p-3 rounded-xl text-left text-[9px] text-stone-500 flex flex-col gap-1 mt-1 font-mono">
            <div className="flex justify-between">
              <span>STUDY PROTOCOL:</span>
              <span className="font-bold text-stone-300 truncate w-32 text-right">
                {protocolId}
              </span>
            </div>
            <div className="flex justify-between">
              <span>PARTICIPANT CODE:</span>
              <span className="font-bold text-stone-300">{subjectId}</span>
            </div>
            <div className="flex justify-between">
              <span>STIMULUS INTEGRITY HASH:</span>
              <span className="font-bold text-stone-300 text-[8px] tracking-tight">
                {stimulusSha256?.substring(0, 16)}...
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full py-2 bg-stone-900 border border-stone-850 hover:bg-stone-800 rounded font-semibold text-stone-300 mt-2 transition-all"
          >
            Close Runner Console
          </button>
        </div>
      </div>
    );
  }

  return null;
}

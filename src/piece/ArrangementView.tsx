/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { useParams } from 'react-router-dom';
import type {
  Piece,
  PieceSegment,
  VariationPoint,
  Movement,
  AutomationTrack,
  AutomationPoint,
  InterpolationMode,
  NotationNote,
} from '@/piece/types';
import { PiecePlayer } from '@/piece/PiecePlayer';
import { SegmentProperties } from '@/piece/SegmentProperties';
import { NotationEditor } from '@/piece/components/NotationEditor';
import { api } from '@/api/client';
import { doc, sessionConfigMap } from '@/jam/crdt';
import { getAnonId } from '@/api/anon';
import { useParamStore, CONTROL_DEFS } from '@/state/params';
import {
  SCHEMA_VERSION,
  KEY_BOUNDS,
  SHARED_KEYS,
  type SharedKey,
} from '@/share/schema';
import {
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  ChevronRight,
  Save,
  Share2,
  FolderOpen,
  Volume2,
  Activity,
  Dices,
  Sliders,
  Maximize2,
  Minimize2,
  Copy,
  Scissors,
  Grid,
} from 'lucide-react';
import type { Orchestrator } from '@/audio/orchestrator';
import { VariationEditorPanel } from '@/piece/components/VariationEditorPanel';
import { VariationDialog } from '@/piece/components/VariationDialog';
import { generateMetaArc } from '@/piece/generators';
import { ArcRunner } from '@/session/ArcRunner';
import { engineCapabilities } from '@/audio/engines/index';
import { hashStringToInt } from '@/piece/resolver';

interface ArrangementViewProps {
  ensureOrchestrator: () => Orchestrator;
  showToast: (msg: string) => void;
}

// Baseline horizontal zoom scale: 1 second = 60 pixels
const BASELINE_PX_PER_MS = 0.06;
const MIN_TRACK_HEIGHT_EXPANDED = 100;
const COLLAPSED_TRACK_HEIGHT = 16;
const TRACK_HEADER_WIDTH = 220;

export const ArrangementView: React.FC<ArrangementViewProps> = ({
  ensureOrchestrator,
  showToast,
}) => {
  // Main piece state
  const [piece, setPiece] = useState<Piece>({
    schemaVer: SCHEMA_VERSION,
    tempoBpm: null,
    title: 'New Ambient Composition',
    description: 'A custom timeline arrangement.',
    visibility: 'unlisted',
    defaultsState: {
      params: useParamStore.getState().params,
      engineId: useParamStore.getState().engineId,
      engineParams: useParamStore.getState().engineParams,
    },
    totalDurationMs: 15000,
    hasOpenSegment: false,
    segments: [
      { position: 0, type: 'fixed', durationMs: 5000, config: { params: {} } },
      {
        position: 1,
        type: 'transition',
        durationMs: 5000,
        config: { easing: 'easeInOut' },
      },
      {
        position: 2,
        type: 'fixed',
        durationMs: 5000,
        config: { params: { rootFreq: 180 } },
      },
    ],
  });

  // Editor states
  const [selectedIdx, setSelectedIdx] = useState<number | null>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadProgress, setPlayheadProgress] = useState(0); // 0 to 1 inside active segment
  const [activeSegIdx, setActiveSegIdx] = useState(0);
  const [savedPieces, setSavedPieces] = useState<any[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNotation, setShowNotation] = useState(false);
  const [editingMovementIdx, setEditingMovementIdx] = useState<number | null>(
    null,
  );

  // Zoom, scroll, collapse and snap states
  const [zoomFactor, setZoomFactor] = useState<number>(1.0); // ranges from 0.5x to 50.0x
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [viewportWidth, setViewportWidth] = useState<number>(800);
  const [snapMode, setSnapMode] = useState<
    'off' | 'grid' | 'bar' | 'movement' | 'segment'
  >('segment');

  // Track expansion states: key -> boolean
  const [expandedTracks, setExpandedTracks] = useState<Record<string, boolean>>(
    {
      segments: true,
      notation: true,
    },
  );

  // Region Selection states
  const [selectionStartMs, setSelectionStartMs] = useState<number | null>(null);
  const [selectionEndMs, setSelectionEndMs] = useState<number | null>(null);
  const [, setIsSelecting] = useState<boolean>(false);
  const [copiedRegion, setCopiedRegion] = useState<{
    durationMs: number;
    notation: NotationNote[];
    automationTracks: AutomationTrack[];
    segments: PieceSegment[];
  } | null>(null);

  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Responsive viewport width tracker
  useEffect(() => {
    const handleResize = () => {
      if (timelineContainerRef.current) {
        setViewportWidth(timelineContainerRef.current.clientWidth);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PiecePlayer | null>(null);
  const { slug } = useParams<{ slug: string }>();

  const zoomScale = useMemo(
    () => BASELINE_PX_PER_MS * zoomFactor,
    [zoomFactor],
  );

  const getSegmentDuration = useCallback(
    (seg: PieceSegment): number => {
      const raw = seg.durationMs ?? 5000;
      if (
        seg.config?.tempoLocked &&
        piece.tempoBpm !== null &&
        piece.tempoBpm > 0
      ) {
        return raw * 4 * (60 / piece.tempoBpm) * 1000;
      }
      return raw;
    },
    [piece.tempoBpm],
  );

  const totalDurationMs = useMemo(() => {
    const hasOpen = piece.segments.some((s) => s.type === 'open');
    if (hasOpen) return 60000; // open is rendered at 60s default length on timeline
    return piece.segments.reduce((sum, s) => sum + getSegmentDuration(s), 0);
  }, [piece.segments, getSegmentDuration]);

  const timelineWidthPx = useMemo(
    () => totalDurationMs * zoomScale,
    [totalDurationMs, zoomScale],
  );

  // Collaborative Jam Syncing: Broadcast changes as session leader
  useEffect(() => {
    const inJam = sessionConfigMap.size > 0;
    if (!inJam) return;

    const hostId = doc.getMap('metadata').get('hostId') as string | undefined;
    const isLeader = hostId === getAnonId() || !hostId;
    if (!isLeader) return;

    doc.transact(() => {
      if (piece.movements) {
        sessionConfigMap.set(
          'piece_movements',
          JSON.stringify(piece.movements),
        );
      } else {
        sessionConfigMap.delete('piece_movements');
      }
      if (piece.segments) {
        sessionConfigMap.set('piece_segments', JSON.stringify(piece.segments));
      }
      if (piece.automationTracks) {
        sessionConfigMap.set(
          'piece_automation',
          JSON.stringify(piece.automationTracks),
        );
      } else {
        sessionConfigMap.delete('piece_automation');
      }
    });
  }, [piece]);

  // Collaborative Jam Syncing: Observe changes as session follower
  useEffect(() => {
    const handleCrdtUpdate = () => {
      const inJam = sessionConfigMap.size > 0;
      if (!inJam) return;

      const hostId = doc.getMap('metadata').get('hostId') as string | undefined;
      const isLeader = hostId === getAnonId() || !hostId;
      if (isLeader) return; // Follower follows remote state

      const remoteMovements = sessionConfigMap.get('piece_movements');
      const remoteSegments = sessionConfigMap.get('piece_segments');
      const remoteAutomation = sessionConfigMap.get('piece_automation');

      let changed = false;
      const nextPiece = { ...piece };

      if (remoteMovements !== undefined) {
        try {
          const parsedMovements =
            typeof remoteMovements === 'string'
              ? JSON.parse(remoteMovements)
              : remoteMovements;
          if (
            JSON.stringify(piece.movements) !== JSON.stringify(parsedMovements)
          ) {
            nextPiece.movements = parsedMovements;
            changed = true;
          }
        } catch (e) {
          console.warn('[Jam] Error movements:', e);
        }
      }

      if (remoteSegments !== undefined) {
        try {
          const parsedSegments =
            typeof remoteSegments === 'string'
              ? JSON.parse(remoteSegments)
              : remoteSegments;
          if (
            JSON.stringify(piece.segments) !== JSON.stringify(parsedSegments)
          ) {
            nextPiece.segments = parsedSegments;
            changed = true;
          }
        } catch (e) {
          console.warn('[Jam] Error segments:', e);
        }
      }

      if (remoteAutomation !== undefined) {
        try {
          const parsedAutomation =
            typeof remoteAutomation === 'string'
              ? JSON.parse(remoteAutomation)
              : remoteAutomation;
          if (
            JSON.stringify(piece.automationTracks) !==
            JSON.stringify(parsedAutomation)
          ) {
            nextPiece.automationTracks = parsedAutomation;
            changed = true;
          }
        } catch (e) {
          console.warn('[Jam] Error automation:', e);
        }
      }

      if (changed) {
        setPiece(nextPiece);
        if (playerRef.current) {
          playerRef.current.updatePiece(nextPiece);
        }
      }
    };

    sessionConfigMap.observe(handleCrdtUpdate);
    return () => {
      sessionConfigMap.unobserve(handleCrdtUpdate);
    };
  }, [piece]);

  // Track visibility culling bounds
  const visibleStartMs = useMemo(
    () => scrollLeft / zoomScale,
    [scrollLeft, zoomScale],
  );
  const visibleEndMs = useMemo(
    () => (scrollLeft + viewportWidth) / zoomScale,
    [scrollLeft, viewportWidth, zoomScale],
  );

  // Snap engine
  const snapTime = useCallback(
    (rawMs: number): number => {
      if (snapMode === 'off') return rawMs;

      const possibleSnaps: number[] = [0];

      // Segment boundaries snaps
      let currentSumMs = 0;
      piece.segments.forEach((seg) => {
        const dur = getSegmentDuration(seg);
        possibleSnaps.push(currentSumMs);
        currentSumMs += dur;
        possibleSnaps.push(currentSumMs);
      });

      // Movement boundaries snaps
      if (piece.movements) {
        piece.movements.forEach((mov) => {
          let movStartMs = 0;
          for (let i = 0; i < mov.startSegmentIndex; i++) {
            if (piece.segments[i])
              movStartMs += getSegmentDuration(piece.segments[i]!);
          }
          let movEndMs = movStartMs;
          for (let i = mov.startSegmentIndex; i <= mov.endSegmentIndex; i++) {
            if (piece.segments[i])
              movEndMs += getSegmentDuration(piece.segments[i]!);
          }
          possibleSnaps.push(movStartMs, movEndMs);
        });
      }

      // Tempo grids snaps
      if (piece.tempoBpm && piece.tempoBpm > 0) {
        const beatMs = (60 / piece.tempoBpm) * 1000;
        const totalBeats = Math.ceil(totalDurationMs / beatMs);
        for (let i = 0; i <= totalBeats; i++) {
          if (snapMode === 'grid') {
            // snaps to quarter/eighth/16th notes
            possibleSnaps.push(i * beatMs);
            possibleSnaps.push(i * beatMs + beatMs / 2);
            possibleSnaps.push(i * beatMs + beatMs / 4);
          } else if (snapMode === 'bar') {
            // snap to bars (every 4 beats)
            if (i % 4 === 0) {
              possibleSnaps.push(i * beatMs);
            }
          }
        }
      }

      // Find closest snap target
      let bestSnap = rawMs;
      let minDiff = Infinity;
      possibleSnaps.forEach((s) => {
        const diff = Math.abs(s - rawMs);
        if (
          diff < minDiff &&
          diff < (snapMode === 'grid' || snapMode === 'bar' ? 150 : 250)
        ) {
          minDiff = diff;
          bestSnap = s;
        }
      });

      return bestSnap;
    },
    [
      snapMode,
      piece.segments,
      piece.movements,
      piece.tempoBpm,
      totalDurationMs,
      getSegmentDuration,
    ],
  );

  // Layout helper
  const getSegmentLeftOffset = useCallback(
    (idx: number): number => {
      let offsetMs = 0;
      for (let i = 0; i < idx; i++) {
        if (piece.segments[i]) {
          offsetMs += getSegmentDuration(piece.segments[i]!);
        }
      }
      return offsetMs * zoomScale;
    },
    [piece.segments, zoomScale, getSegmentDuration],
  );

  const getRangeLayout = useCallback(
    (startIdx: number, endIdx: number) => {
      const left = getSegmentLeftOffset(startIdx);
      let width = 0;
      for (let i = startIdx; i <= endIdx; i++) {
        if (piece.segments[i]) {
          width += getSegmentDuration(piece.segments[i]!) * zoomScale;
        }
      }
      return { left, width };
    },
    [getSegmentLeftOffset, piece.segments, zoomScale, getSegmentDuration],
  );

  // Fetch saved pieces & load slug on mount
  useEffect(() => {
    fetchSavedPieces();
    if (slug) {
      void api
        .getPiece(slug)
        .then((item) => {
          handleLoadPiece(item);
        })
        .catch(() => {
          showToast('Failed to load piece from URL');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchSavedPieces = async () => {
    if (!api.isBackendConfigured()) return;
    try {
      const res = await api.myPieces();
      setSavedPieces(res.items);
    } catch {
      // offline
    }
  };

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.stop();
      }
    };
  }, []);

  const handleCaptureDefaults = () => {
    const s = useParamStore.getState();
    setPiece({
      ...piece,
      defaultsState: {
        params: s.params,
        engineId: s.engineId,
        engineParams: s.engineParams,
      },
    });
    showToast('Defaults captured from active patch');
  };

  // Timeline segment manipulation
  const handleAddSegment = (type: PieceSegment['type']) => {
    const nextPos = piece.segments.length;
    const newSeg: PieceSegment = {
      position: nextPos,
      type,
      durationMs: type === 'open' ? null : 5000,
      config:
        type === 'transition'
          ? { easing: 'linear' }
          : type === 'arc'
            ? { arcId: 'bell' }
            : type === 'meta-arc'
              ? {
                  kind: 'random-walk',
                  seed: null,
                  randomWalk: {
                    params: ['rootFreq', 'brightness', 'space'],
                    driftStrength: 0.15,
                    meanReversion: 0.1,
                    steps: 20,
                    bounds: {
                      rootFreq: { min: 0.5, max: 1.5 },
                      brightness: { min: 0.3, max: 0.9 },
                      space: { min: 0.2, max: 0.8 },
                    },
                  },
                }
              : { params: {} },
    };
    const updatedSegs = [...piece.segments, newSeg];
    updatePieceSegments(updatedSegs);
    setSelectedIdx(nextPos);
  };

  const updatePieceSegments = (segments: PieceSegment[]) => {
    const hasOpen = segments.some((s) => s.type === 'open');
    const totalDuration = hasOpen
      ? null
      : segments.reduce((sum, s) => sum + (s.durationMs || 0), 0);

    setPiece({
      ...piece,
      segments,
      hasOpenSegment: hasOpen,
      totalDurationMs: totalDuration,
    });
  };

  const handleDeleteSegment = (idx: number) => {
    const updated = piece.segments
      .filter((_, i) => i !== idx)
      .map((seg, i) => ({ ...seg, position: i }));

    const adjustedMovements = adjustMovementsOnDelete(idx);

    const hasOpen = updated.some((s) => s.type === 'open');
    const totalDuration = hasOpen
      ? null
      : updated.reduce((sum, s) => sum + (s.durationMs || 0), 0);

    const updatedPiece = {
      ...piece,
      segments: updated,
      hasOpenSegment: hasOpen,
      totalDurationMs: totalDuration,
      movements: adjustedMovements,
    };

    setPiece(updatedPiece);
    if (playerRef.current) {
      playerRef.current.updatePiece(updatedPiece);
    }
    setSelectedIdx(updated.length > 0 ? 0 : null);
  };

  const adjustMovementsOnDelete = (delIdx: number) => {
    if (!piece.movements) return undefined;
    return piece.movements
      .map((mov) => {
        let start = mov.startSegmentIndex;
        let end = mov.endSegmentIndex;

        if (delIdx >= start && delIdx <= end) {
          if (start === end) return null;
          end--;
        } else {
          if (start > delIdx) start--;
          if (end > delIdx) end--;
        }

        return {
          ...mov,
          startSegmentIndex: start,
          endSegmentIndex: end,
        };
      })
      .filter(Boolean) as Movement[];
  };

  const handleSegmentChange = (updatedSeg: PieceSegment) => {
    const updated = piece.segments.map((seg, i) =>
      i === updatedSeg.position ? updatedSeg : seg,
    );
    updatePieceSegments(updated);
  };

  // Keyboard shortcut snapping mode cycling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'g' || e.key === 'G' || e.key === 's' || e.key === 'S') {
        const modes: (typeof snapMode)[] = [
          'off',
          'grid',
          'bar',
          'movement',
          'segment',
        ];
        const nextIdx = (modes.indexOf(snapMode) + 1) % modes.length;
        const nextMode = modes[nextIdx]!;
        setSnapMode(nextMode);
        showToast(`Snap Mode: ${nextMode.toUpperCase()}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snapMode, showToast]);

  // Drag Segment edge resize handler
  const handleMouseDownResize = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    const seg = piece.segments[idx];
    if (!seg || seg.type === 'open') return;

    const startX = e.clientX;
    const startDur = seg.durationMs || 5000;
    let accumulatedOffsetMs = 0;
    for (let i = 0; i < idx; i++) {
      accumulatedOffsetMs += getSegmentDuration(piece.segments[i]!);
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaMs = Math.round(deltaX / zoomScale);
      let nextDur = Math.max(1000, startDur + deltaMs); // minimum 1s

      // Snapping edge to timeline grid
      const edgeTimeMs = accumulatedOffsetMs + nextDur;
      const snappedEdgeMs = snapTime(edgeTimeMs);
      nextDur = Math.max(1000, snappedEdgeMs - accumulatedOffsetMs);

      const updated = piece.segments.map((s, i) =>
        i === idx ? { ...s, durationMs: nextDur } : s,
      );
      updatePieceSegments(updated);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Playback integration
  const globalPlayheadMs = useMemo(() => {
    if (!isPlaying) return 0;
    let total = 0;
    for (let i = 0; i < activeSegIdx; i++) {
      const seg = piece.segments[i];
      if (seg) {
        total += getSegmentDuration(seg);
      }
    }
    const currentSeg = piece.segments[activeSegIdx];
    const dur = currentSeg ? getSegmentDuration(currentSeg) : 5000;
    return total + playheadProgress * dur;
  }, [
    isPlaying,
    activeSegIdx,
    playheadProgress,
    piece.segments,
    getSegmentDuration,
  ]);

  const handlePlayPause = () => {
    const orch = ensureOrchestrator();
    if (isPlaying) {
      playerRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!playerRef.current) {
        playerRef.current = new PiecePlayer(piece, orch);
      }
      (window as any).activePiecePlayer = playerRef.current;

      setIsPlaying(true);
      playerRef.current.start(
        (progress, idx) => {
          setPlayheadProgress(progress);
          setActiveSegIdx(idx);
        },
        () => {
          setIsPlaying(false);
          setPlayheadProgress(0);
          setActiveSegIdx(0);
          showToast('Playback completed');
        },
      );
    }
  };

  const handleStop = () => {
    playerRef.current?.stop();
    setIsPlaying(false);
    setPlayheadProgress(0);
    setActiveSegIdx(0);
  };

  const handleReRoll = () => {
    const nextSeed = Math.floor(Math.random() * 1000000);
    const updated = { ...piece, variationSeed: nextSeed };
    setPiece(updated);
    if (playerRef.current) {
      playerRef.current.updatePiece(updated);
      playerRef.current.reRoll();
    }
    showToast(`Procedural variations re-rolled! (Seed: ${nextSeed})`);
  };

  const handleAdvanceOpen = () => {
    if (playerRef.current) {
      playerRef.current.nextSegment();
      showToast('Advancing open segment');
    }
  };

  // Persistence endpoints
  const handleSavePiece = async () => {
    if (!api.isBackendConfigured()) {
      showToast('Persistence requires active backend');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        defaults_state: piece.defaultsState,
        schema_ver: SCHEMA_VERSION,
        title: piece.title,
        description: piece.description,
        visibility: piece.visibility,
        tempo_bpm: piece.tempoBpm,
        notation: piece.notation || [],
        variation_seed: piece.variationSeed,
        variations: piece.variations || [],
        automation_tracks: piece.automationTracks || [],
        segments: piece.segments.map((s) => ({
          type: s.type,
          duration_ms: s.durationMs,
          config: s.config,
          variations: s.variations || [],
        })),
      };

      if (piece.id) {
        await api.updatePiece(piece.id, payload);
        showToast('Piece updated');
      } else {
        const res = await api.createPiece(payload);
        setPiece({
          ...piece,
          id: res.id,
          shortSlug: res.short_slug,
        });
        showToast('Piece saved successfully');
      }
      fetchSavedPieces();
    } catch {
      showToast('Failed to save piece');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPiece = (item: any) => {
    setPiece({
      id: item.id,
      schemaVer: item.schema_ver,
      title: item.title,
      description: item.description,
      visibility: item.visibility,
      tempoBpm: item.tempo_bpm !== undefined ? item.tempo_bpm : null,
      defaultsState: item.defaults_state,
      totalDurationMs: item.total_duration_ms,
      hasOpenSegment: item.has_open_segment,
      notation: item.notation !== undefined ? item.notation : [],
      variationSeed:
        item.variation_seed !== undefined ? item.variation_seed : null,
      variations: item.variations !== undefined ? item.variations : [],
      automationTracks:
        item.automation_tracks !== undefined ? item.automation_tracks : [],
      segments: item.segments.map((s: any) => ({
        id: s.id,
        position: s.position,
        type: s.type,
        durationMs: s.duration_ms,
        config: s.config,
        variations: s.variations !== undefined ? s.variations : [],
      })),
      shortSlug: item.short_slug,
    });
    setSelectedIdx(item.segments.length > 0 ? 0 : null);
    setShowLoadModal(false);
    showToast(`Loaded "${item.title || 'Untitled Piece'}"`);
  };

  const handleSharePiece = () => {
    if (!piece.shortSlug) {
      showToast('Save the piece first to generate a share link!');
      return;
    }
    const url = `${window.location.origin}/piece/${piece.shortSlug}`;
    navigator.clipboard.writeText(url);
    showToast('Share link copied to clipboard!');
  };

  // Movement manipulation
  const handleAddMovement = () => {
    const movements = piece.movements || [];
    if (movements.length >= 10) {
      showToast('Maximum of 10 movements reached');
      return;
    }

    let targetStart = -1;
    for (let i = 0; i < piece.segments.length; i++) {
      const inside = movements.some(
        (m) => i >= m.startSegmentIndex && i <= m.endSegmentIndex,
      );
      if (!inside) {
        targetStart = i;
        break;
      }
    }

    if (targetStart === -1) {
      showToast('All segments belong to a movement');
      return;
    }

    const newMovement = {
      name: `Movement ${movements.length + 1}`,
      description: '',
      startSegmentIndex: targetStart,
      endSegmentIndex: targetStart,
    };

    const updatedMovements = [...movements, newMovement].sort(
      (a, b) => a.startSegmentIndex - b.startSegmentIndex,
    );

    const updated = { ...piece, movements: updatedMovements };
    setPiece(updated);
    if (playerRef.current) {
      playerRef.current.updatePiece(updated);
    }
    showToast(`Added movement: "${newMovement.name}"`);
  };

  const handleStartDragMovement = (
    e: React.MouseEvent,
    movIdx: number,
    edge: 'left' | 'right',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const mov = piece.movements![movIdx]!;
    const initialStart = mov.startSegmentIndex;
    const initialEnd = mov.endSegmentIndex;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const timelineEl = timelineContentRef.current;
      if (!timelineEl) return;

      const rect = timelineEl.getBoundingClientRect();
      const relativeX = moveEvent.clientX - rect.left;
      const timeMs = relativeX / zoomScale;

      let targetIdx = 0;
      let accMs = 0;
      for (let i = 0; i < piece.segments.length; i++) {
        const dur = getSegmentDuration(piece.segments[i]!);
        if (timeMs < accMs + dur / 2) {
          targetIdx = i;
          break;
        }
        accMs += dur;
        targetIdx = i;
      }

      const movements = piece.movements || [];
      if (edge === 'left') {
        let minStart = 0;
        if (movIdx > 0) {
          minStart = movements[movIdx - 1]!.endSegmentIndex + 1;
        }
        const newStart = Math.max(minStart, Math.min(initialEnd, targetIdx));
        if (newStart !== mov.startSegmentIndex) {
          const updated = movements.map((m, i) =>
            i === movIdx ? { ...m, startSegmentIndex: newStart } : m,
          );
          const updatedPiece = { ...piece, movements: updated };
          setPiece(updatedPiece);
          if (playerRef.current) playerRef.current.updatePiece(updatedPiece);
        }
      } else {
        let maxEnd = piece.segments.length - 1;
        if (movIdx < movements.length - 1) {
          maxEnd = movements[movIdx + 1]!.startSegmentIndex - 1;
        }
        const newEnd = Math.max(initialStart, Math.min(maxEnd, targetIdx));
        if (newEnd !== mov.endSegmentIndex) {
          const updated = movements.map((m, i) =>
            i === movIdx ? { ...m, endSegmentIndex: newEnd } : m,
          );
          const updatedPiece = { ...piece, movements: updated };
          setPiece(updatedPiece);
          if (playerRef.current) playerRef.current.updatePiece(updatedPiece);
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Variation Points editor helpers
  const [activeVpEdit, setActiveVpEdit] = useState<{
    paramKey: string;
    paramLabel: string;
    initialPoint?: VariationPoint;
    minVal: number;
    maxVal: number;
    stepVal: number;
    target: 'piece' | 'segment';
    segmentIndex?: number;
  } | null>(null);

  const handleEditPoint = (
    point: VariationPoint,
    target: 'piece' | 'segment',
    segmentIndex?: number,
  ) => {
    const def = CONTROL_DEFS.find((d) => d.key === point.paramKey);
    setActiveVpEdit({
      paramKey: point.paramKey,
      paramLabel: def?.label || point.paramKey,
      initialPoint: point,
      minVal: def?.min || 0,
      maxVal: def?.max || 1,
      stepVal: def?.step || 0.01,
      target,
      segmentIndex,
    });
  };

  const handleSavePieceVariation = (vp: VariationPoint) => {
    if (!activeVpEdit) return;

    if (activeVpEdit.target === 'piece') {
      const vars = [...(piece.variations || [])].filter((v) => v.id !== vp.id);
      vars.push(vp);
      const updated = { ...piece, variations: vars };
      setPiece(updated);
      if (playerRef.current) {
        playerRef.current.updatePiece(updated);
      }
    } else {
      const segmentIndex = activeVpEdit.segmentIndex!;
      const updatedSegments = piece.segments.map((seg, idx) => {
        if (idx === segmentIndex) {
          const vars = [...(seg.variations || [])].filter(
            (v) => v.id !== vp.id,
          );
          vars.push(vp);
          return { ...seg, variations: vars };
        }
        return seg;
      });
      const updated = { ...piece, segments: updatedSegments };
      setPiece(updated);
      if (playerRef.current) {
        playerRef.current.updatePiece(updated);
      }
    }
    setActiveVpEdit(null);
  };

  const handleDeletePieceVariation = () => {
    if (!activeVpEdit) return;

    if (activeVpEdit.target === 'piece') {
      const updated = {
        ...piece,
        variations: (piece.variations || []).filter(
          (v) => v.paramKey !== activeVpEdit.paramKey,
        ),
      };
      setPiece(updated);
      if (playerRef.current) {
        playerRef.current.updatePiece(updated);
      }
    } else {
      const segmentIndex = activeVpEdit.segmentIndex!;
      const updatedSegments = piece.segments.map((seg, idx) => {
        if (idx === segmentIndex) {
          return {
            ...seg,
            variations: (seg.variations || []).filter(
              (v) => v.paramKey !== activeVpEdit.paramKey,
            ),
          };
        }
        return seg;
      });
      const updated = { ...piece, segments: updatedSegments };
      setPiece(updated);
      if (playerRef.current) {
        playerRef.current.updatePiece(updated);
      }
    }
    setActiveVpEdit(null);
  };

  // Zoom wheel / pinch listeners
  const handleContainerWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomCenterMs =
        (e.clientX -
          TRACK_HEADER_WIDTH -
          e.currentTarget.getBoundingClientRect().left +
          scrollLeft) /
        zoomScale;
      const zoomChange = e.deltaY < 0 ? 1.1 : 0.9;
      const nextFactor = Math.max(0.5, Math.min(50.0, zoomFactor * zoomChange));
      setZoomFactor(nextFactor);

      // Re-adjust scroll to hold mouse pivot steady
      const nextScale = BASELINE_PX_PER_MS * nextFactor;
      const nextScrollLeft = Math.max(
        0,
        zoomCenterMs * nextScale -
          (e.clientX -
            TRACK_HEADER_WIDTH -
            e.currentTarget.getBoundingClientRect().left),
      );

      const scrollEl = timelineContainerRef.current;
      if (scrollEl) {
        scrollEl.scrollLeft = nextScrollLeft;
      }
    }
  };

  // Snapping utilities & keyboard shortcuts
  const toggleTrackExpansion = (key: string) => {
    setExpandedTracks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Add automation track
  const handleAddAutomationTrack = (paramKey: string) => {
    const tracks = piece.automationTracks || [];
    if (tracks.some((t) => t.paramKey === paramKey)) {
      showToast(`${paramKey} automation track already exists.`);
      return;
    }
    const bounds = KEY_BOUNDS[paramKey as SharedKey] || { min: 0, max: 1 };
    const defaultVal =
      (piece.defaultsState.params as any)[paramKey] ??
      (bounds.min + bounds.max) / 2;

    const newTrack: AutomationTrack = {
      id: `track-${paramKey}-${Date.now()}`,
      paramKey,
      points: [
        {
          id: `pt-${Date.now()}-0`,
          timeMs: 0,
          value: defaultVal,
          interpolation: 'linear',
        },
        {
          id: `pt-${Date.now()}-1`,
          timeMs: totalDurationMs,
          value: defaultVal,
          interpolation: 'linear',
        },
      ],
    };

    setPiece((prev) => {
      const next = {
        ...prev,
        automationTracks: [...(prev.automationTracks || []), newTrack],
      };
      if (playerRef.current) playerRef.current.updatePiece(next);
      return next;
    });

    setExpandedTracks((prev) => ({ ...prev, [paramKey]: true }));
    showToast(`Added ${paramKey} automation track.`);
  };

  // Remove automation track
  const handleRemoveAutomationTrack = (paramKey: string) => {
    setPiece((prev) => {
      const next = {
        ...prev,
        automationTracks: (prev.automationTracks || []).filter(
          (t) => t.paramKey !== paramKey,
        ),
      };
      if (playerRef.current) playerRef.current.updatePiece(next);
      return next;
    });
    showToast(`Removed ${paramKey} automation track.`);
  };

  // Automation curve mouse interactions
  const handleAutomationTrackClick = (
    e: React.MouseEvent<SVGSVGElement>,
    trackKey: string,
  ) => {
    if (e.detail === 2) return; // double-click handled separately
    if ((e.target as HTMLElement).tagName === 'circle') return; // clicked a point, ignore track click

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const timeMs = snapTime(clickX / zoomScale);
    const bounds = KEY_BOUNDS[trackKey as SharedKey] || { min: 0, max: 1 };

    const pctY = 1.0 - clickY / rect.height;
    const value = bounds.min + pctY * (bounds.max - bounds.min);

    setPiece((prev) => {
      const tracks = (prev.automationTracks || []).map((t) => {
        if (t.paramKey === trackKey) {
          const newPt: AutomationPoint = {
            id: `pt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timeMs,
            value,
            interpolation: 'linear',
          };
          const pts = [...t.points, newPt].sort((a, b) => a.timeMs - b.timeMs);
          return { ...t, points: pts };
        }
        return t;
      });
      const next = { ...prev, automationTracks: tracks };
      if (playerRef.current) playerRef.current.updatePiece(next);
      return next;
    });
  };

  const handleAutomationPointDoubleClick = (
    e: React.MouseEvent,
    trackKey: string,
    ptId: string,
  ) => {
    e.stopPropagation();
    setPiece((prev) => {
      const tracks = (prev.automationTracks || []).map((t) => {
        if (t.paramKey === trackKey) {
          // Keep at least one boundary point
          if (t.points.length <= 2) {
            showToast(
              'Automation track requires at least two boundary points.',
            );
            return t;
          }
          const pts = t.points.filter((p) => p.id !== ptId);
          return { ...t, points: pts };
        }
        return t;
      });
      const next = { ...prev, automationTracks: tracks };
      if (playerRef.current) playerRef.current.updatePiece(next);
      return next;
    });
  };

  const handleAutomationPointDrag = (
    e: React.PointerEvent<SVGCircleElement>,
    trackKey: string,
    ptId: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const bounds = KEY_BOUNDS[trackKey as SharedKey] || { min: 0, max: 1 };
    const track = piece.automationTracks?.find((t) => t.paramKey === trackKey);
    if (!track) return;
    const ptIdx = track.points.findIndex((p) => p.id === ptId);
    if (ptIdx === -1) return;

    const pointsList = track.points;
    const prevPt = pointsList[ptIdx - 1];
    const nextPt = pointsList[ptIdx + 1];

    const minTimeMs = prevPt ? prevPt.timeMs + 50 : 0;
    const maxTimeMs = nextPt ? nextPt.timeMs - 50 : totalDurationMs;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const svg = el.parentElement as unknown as SVGSVGElement;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relativeX = moveEvent.clientX - rect.left;
      const relativeY = moveEvent.clientY - rect.top;

      let timeMs = relativeX / zoomScale;
      timeMs = Math.max(minTimeMs, Math.min(maxTimeMs, timeMs));

      // snap check (unless dragging boundary points horizontally)
      if (prevPt && nextPt) {
        timeMs = snapTime(timeMs);
        timeMs = Math.max(minTimeMs, Math.min(maxTimeMs, timeMs));
      } else {
        // Boundary points (start / end) locked in time
        timeMs = pointsList[ptIdx]!.timeMs;
      }

      const pctY =
        1.0 - Math.max(0, Math.min(rect.height, relativeY)) / rect.height;
      const value = bounds.min + pctY * (bounds.max - bounds.min);

      // Throttled UI update locally & debounced CRDT sync
      setPiece((prev) => {
        const tracks = (prev.automationTracks || []).map((t) => {
          if (t.paramKey === trackKey) {
            const pts = t.points
              .map((p) => {
                if (p.id === ptId) {
                  return { ...p, timeMs, value };
                }
                return p;
              })
              .sort((a, b) => a.timeMs - b.timeMs);
            return { ...t, points: pts };
          }
          return t;
        });
        const next = { ...prev, automationTracks: tracks };
        if (playerRef.current) playerRef.current.updatePiece(next);
        return next;
      });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      el.releasePointerCapture(upEvent.pointerId);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
    };

    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
  };

  // Toggle interpolation mode on point
  const handleToggleInterpolation = (trackKey: string, ptId: string) => {
    setPiece((prev) => {
      const tracks = (prev.automationTracks || []).map((t) => {
        if (t.paramKey === trackKey) {
          const pts = t.points.map((p) => {
            if (p.id === ptId) {
              const modes: InterpolationMode[] = [
                'linear',
                'exponential',
                'hold',
              ];
              const nextIdx =
                (modes.indexOf(p.interpolation) + 1) % modes.length;
              return { ...p, interpolation: modes[nextIdx]! };
            }
            return p;
          });
          return { ...t, points: pts };
        }
        return t;
      });
      const next = { ...prev, automationTracks: tracks };
      if (playerRef.current) playerRef.current.updatePiece(next);
      return next;
    });
  };

  // Selection events (Ruler drag)
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left + scrollLeft;
    const timeMs = snapTime(startX / zoomScale);

    setSelectionStartMs(timeMs);
    setSelectionEndMs(timeMs);
    setIsSelecting(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextX = moveEvent.clientX - rect.left + scrollLeft;
      const nextMs = snapTime(nextX / zoomScale);
      setSelectionEndMs(Math.max(0, nextMs));
    };

    const handleMouseUp = () => {
      setIsSelecting(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleClearSelection = () => {
    setSelectionStartMs(null);
    setSelectionEndMs(null);
  };

  // Region actions
  const handleRegionCopy = useCallback(() => {
    if (selectionStartMs === null || selectionEndMs === null) {
      showToast('Select a timeline region on the ruler first.');
      return;
    }
    const t0 = Math.min(selectionStartMs, selectionEndMs);
    const t1 = Math.max(selectionStartMs, selectionEndMs);
    const duration = t1 - t0;

    // Notation notes inside region
    const notesInRegion = (piece.notation || [])
      .filter((n) => n.onset_ms >= t0 && n.onset_ms < t1)
      .map((n) => ({
        ...n,
        onset_ms: n.onset_ms - t0, // shift relative
      }));

    // Automation points inside region
    const autoInRegion = (piece.automationTracks || [])
      .map((t) => {
        const pts = t.points
          .filter((p) => p.timeMs >= t0 && p.timeMs < t1)
          .map((p) => ({
            ...p,
            timeMs: p.timeMs - t0,
          }));
        return { ...t, points: pts };
      })
      .filter((t) => t.points.length > 0);

    // Segments inside region
    let currentSum = 0;
    const segsInRegion: PieceSegment[] = [];
    piece.segments.forEach((seg) => {
      const dur = getSegmentDuration(seg);
      const segStart = currentSum;
      const segEnd = currentSum + dur;

      if (segStart < t1 && segEnd > t0) {
        // Intersects
        segsInRegion.push(seg);
      }
      currentSum += dur;
    });

    setCopiedRegion({
      durationMs: duration,
      notation: notesInRegion,
      automationTracks: autoInRegion,
      segments: segsInRegion,
    });
    showToast('Copied selected region to clipboard.');
  }, [selectionStartMs, selectionEndMs, piece, getSegmentDuration, showToast]);

  const handleRegionDelete = useCallback(
    (ripple: boolean = false) => {
      if (selectionStartMs === null || selectionEndMs === null) {
        showToast('Select a timeline region on the ruler to delete.');
        return;
      }
      const t0 = Math.min(selectionStartMs, selectionEndMs);
      const t1 = Math.max(selectionStartMs, selectionEndMs);
      const delta = t1 - t0;

      // Delete notation notes
      let notes = (piece.notation || []).filter(
        (n) => !(n.onset_ms >= t0 && n.onset_ms < t1),
      );
      if (ripple) {
        notes = notes.map((n) => {
          if (n.onset_ms >= t1) {
            return { ...n, onset_ms: n.onset_ms - delta };
          }
          return n;
        });
      }

      // Delete automation points
      const autoTracks = (piece.automationTracks || []).map((t) => {
        let pts = t.points.filter((p) => !(p.timeMs >= t0 && p.timeMs < t1));
        if (ripple) {
          pts = pts.map((p) => {
            if (p.timeMs >= t1) {
              return { ...p, timeMs: p.timeMs - delta };
            }
            return p;
          });
        }
        // Re-inject boundary points if deleted
        if (pts.length > 0 && pts[0]!.timeMs !== 0) {
          pts.unshift({
            id: `pt-${Date.now()}-bound-0`,
            timeMs: 0,
            value: pts[0]!.value,
            interpolation: 'linear',
          });
        }
        return { ...t, points: pts };
      });

      // Ripple segments deletion
      let segments = [...piece.segments];
      if (ripple) {
        // Simple representation: remove segments starting inside the range and resize intersecting ones
        let accumMs = 0;
        const nextSegs: PieceSegment[] = [];
        piece.segments.forEach((seg) => {
          const dur = getSegmentDuration(seg);
          const start = accumMs;
          const end = accumMs + dur;

          if (start >= t0 && end <= t1) {
            // complete inside selection, delete it
          } else if (start < t0 && end > t1) {
            // selectors cross the segment, shrink it
            nextSegs.push({ ...seg, durationMs: Math.max(1000, dur - delta) });
          } else if (start < t0 && end > t0) {
            // intersects left edge
            const visibleDur = t0 - start;
            nextSegs.push({ ...seg, durationMs: Math.max(1000, visibleDur) });
          } else if (start < t1 && end > t1) {
            // intersects right edge
            const visibleDur = end - t1;
            nextSegs.push({ ...seg, durationMs: Math.max(1000, visibleDur) });
          } else {
            nextSegs.push(seg);
          }
          accumMs += dur;
        });
        segments = nextSegs.map((s, i) => ({ ...s, position: i }));
      }

      const updated: Piece = {
        ...piece,
        notation: notes,
        automationTracks: autoTracks,
        segments,
      };

      setPiece(updated);
      if (playerRef.current) playerRef.current.updatePiece(updated);
      handleClearSelection();
      showToast(
        ripple ? 'Ripple-deleted selection range.' : 'Cleared selection range.',
      );
    },
    [selectionStartMs, selectionEndMs, piece, getSegmentDuration, showToast],
  );

  const handleRegionPaste = useCallback(() => {
    if (!copiedRegion) {
      showToast('Clipboard is empty.');
      return;
    }
    // Paste starting at playhead or selection start
    const pasteTimeMs =
      selectionStartMs !== null ? selectionStartMs : globalPlayheadMs;

    // Paste notation: creates notation track if piece notation is empty
    const importedNotes = copiedRegion.notation.map((n) => ({
      ...n,
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      onset_ms: n.onset_ms + pasteTimeMs,
    }));
    const nextNotes = [...(piece.notation || []), ...importedNotes].sort(
      (a, b) => a.onset_ms - b.onset_ms,
    );

    // Paste automation tracks
    const nextTracks = [...(piece.automationTracks || [])];
    copiedRegion.automationTracks.forEach((copiedTrack) => {
      const existIdx = nextTracks.findIndex(
        (t) => t.paramKey === copiedTrack.paramKey,
      );
      const pointsToPaste = copiedTrack.points.map((p) => ({
        ...p,
        id: `pt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timeMs: p.timeMs + pasteTimeMs,
      }));

      if (existIdx !== -1) {
        const exist = nextTracks[existIdx]!;
        const mergedPts = [...exist.points, ...pointsToPaste].sort(
          (a, b) => a.timeMs - b.timeMs,
        );
        nextTracks[existIdx] = { ...exist, points: mergedPts };
      } else {
        // Create automation track if not present
        const newTrack: AutomationTrack = {
          id: `track-${copiedTrack.paramKey}-${Date.now()}`,
          paramKey: copiedTrack.paramKey,
          points: [
            {
              id: `pt-${Date.now()}-0`,
              timeMs: 0,
              value: pointsToPaste[0]?.value || 0.5,
              interpolation: 'linear' as InterpolationMode,
            },
            ...pointsToPaste,
          ].sort((a, b) => a.timeMs - b.timeMs),
        };
        nextTracks.push(newTrack);
        setExpandedTracks((prev) => ({
          ...prev,
          [copiedTrack.paramKey]: true,
        }));
      }
    });

    const updated: Piece = {
      ...piece,
      notation: nextNotes,
      automationTracks: nextTracks,
    };

    setPiece(updated);
    if (playerRef.current) playerRef.current.updatePiece(updated);
    showToast(`Pasted region at ${Math.round(pasteTimeMs / 1000)}s.`);
  }, [copiedRegion, selectionStartMs, globalPlayheadMs, piece, showToast]);

  const handleRegionDuplicate = useCallback(() => {
    if (selectionStartMs === null || selectionEndMs === null) {
      showToast('Select a timeline region on the ruler to duplicate.');
      return;
    }
    const t0 = Math.min(selectionStartMs, selectionEndMs);
    const t1 = Math.max(selectionStartMs, selectionEndMs);
    const duration = t1 - t0;

    // Simulate Copy & Paste immediately at t1
    const notesToDuplicate = (piece.notation || [])
      .filter((n) => n.onset_ms >= t0 && n.onset_ms < t1)
      .map((n) => ({
        ...n,
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        onset_ms: n.onset_ms + duration, // shifted forward by selection length
      }));

    const nextNotes = [...(piece.notation || []), ...notesToDuplicate].sort(
      (a, b) => a.onset_ms - b.onset_ms,
    );

    const nextTracks = (piece.automationTracks || []).map((t) => {
      const ptsToDup = t.points
        .filter((p) => p.timeMs >= t0 && p.timeMs < t1)
        .map((p) => ({
          ...p,
          id: `pt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timeMs: p.timeMs + duration,
        }));
      const mergedPts = [...t.points, ...ptsToDup].sort(
        (a, b) => a.timeMs - b.timeMs,
      );
      return { ...t, points: mergedPts };
    });

    const updated: Piece = {
      ...piece,
      notation: nextNotes,
      automationTracks: nextTracks,
    };

    setPiece(updated);
    if (playerRef.current) playerRef.current.updatePiece(updated);
    showToast('Duplicated selected region.');
  }, [selectionStartMs, selectionEndMs, piece, showToast]);

  // Bind copy/paste/duplicate keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleRegionCopy();
      } else if (isCmdOrCtrl && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handleRegionPaste();
      } else if (isCmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handleRegionDuplicate();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectionStartMs !== null && selectionEndMs !== null) {
          e.preventDefault();
          handleRegionDelete(e.shiftKey); // shift+backspace ripple deletes
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleRegionCopy,
    handleRegionPaste,
    handleRegionDuplicate,
    handleRegionDelete,
    selectionStartMs,
    selectionEndMs,
  ]);

  // Render SVG Path Curve plotter for hold/linear/exp curves
  const getCurvePath = (
    points: AutomationPoint[],
    paramKey: string,
    height: number,
  ) => {
    if (!points || points.length === 0) return '';
    const sorted = [...points].sort((a, b) => a.timeMs - b.timeMs);
    const bounds = KEY_BOUNDS[paramKey as SharedKey] || { min: 0, max: 1 };

    const valToY = (val: number) => {
      const pct = (val - bounds.min) / (bounds.max - bounds.min);
      return height - pct * height;
    };

    const first = sorted[0];
    if (!first) return '';
    const x0 = first.timeMs * zoomScale;
    const y0 = valToY(first.value);
    let path = `M ${x0} ${y0}`;

    for (let i = 0; i < sorted.length - 1; i++) {
      const p0 = sorted[i]!;
      const p1 = sorted[i + 1]!;
      const xEnd = p1.timeMs * zoomScale;
      const yStart = valToY(p0.value);
      const yEnd = valToY(p1.value);

      if (p0.interpolation === 'hold') {
        path += ` L ${xEnd} ${yStart} L ${xEnd} ${yEnd}`;
      } else if (p0.interpolation === 'exponential') {
        if (p0.value !== 0 && p1.value !== 0 && p0.value * p1.value > 0) {
          const steps = 15;
          for (let step = 1; step <= steps; step++) {
            const ratio = step / steps;
            const tMs = p0.timeMs + ratio * (p1.timeMs - p0.timeMs);
            const x = tMs * zoomScale;
            const val = p0.value * Math.pow(p1.value / p0.value, ratio);
            const y = valToY(val);
            path += ` L ${x} ${y}`;
          }
        } else {
          path += ` L ${xEnd} ${yEnd}`;
        }
      } else {
        path += ` L ${xEnd} ${yEnd}`;
      }
    }

    // extend line to right edge of timeline
    const lastPoint = sorted[sorted.length - 1];
    if (lastPoint) {
      const yLast = valToY(lastPoint.value);
      const xEndTimeline = totalDurationMs * zoomScale;
      path += ` L ${xEndTimeline} ${yLast}`;
    }

    return path;
  };

  // Meta-Arc Preview Track generator path
  const getMetaArcPreviewPaths = (
    seg: PieceSegment,
    idx: number,
    height: number,
  ): { path: string; param: string }[] => {
    if (seg.type !== 'meta-arc') return [];

    // Run meta-arc generator
    let seed = seg.config.seed;
    if (seed === null || seed === undefined) {
      seed = (piece.variationSeed ?? 0) + hashStringToInt('meta-arc-' + idx);
    }
    const generatedArc = generateMetaArc(
      seg.config.kind || 'random-walk',
      seg.config,
      seed,
    );

    const segmentStartMs = getSegmentLeftOffset(idx) / zoomScale;
    const durSec = getSegmentDuration(seg) / 1000;
    const pointsCount = 40;

    const pathsMap: Record<string, string> = {};
    const params = seg.config.randomWalk?.params || [
      'rootFreq',
      'brightness',
      'space',
    ];

    params.forEach((paramKey: string) => {
      const bounds = KEY_BOUNDS[paramKey as SharedKey] || { min: 0, max: 1 };
      const valToY = (val: number) => {
        const pct = (val - bounds.min) / (bounds.max - bounds.min);
        return height - pct * height;
      };

      let segmentPath = '';
      for (let step = 0; step <= pointsCount; step++) {
        const timeOffsetSec = (step / pointsCount) * durSec;
        const globalTimeMs = segmentStartMs * 1000 + timeOffsetSec * 1000;
        const x = globalTimeMs * zoomScale;

        // Sample generated arc
        const runner = new ArcRunner(
          generatedArc,
          durSec,
          { rootFreq: 150, brightness: 0.5, space: 0.5 } as any,
          engineCapabilities(piece.defaultsState.engineId),
        );
        const frame = runner.tick(timeOffsetSec);
        const val =
          (frame.params as any)[paramKey] ?? (bounds.min + bounds.max) / 2;
        const y = valToY(val);

        if (step === 0) {
          segmentPath += `M ${x} ${y}`;
        } else {
          segmentPath += ` L ${x} ${y}`;
        }
      }
      pathsMap[paramKey] = segmentPath;
    });

    return Object.entries(pathsMap).map(([param, path]) => ({ path, param }));
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto p-4 select-none font-body text-stone-200">
      {/* 1. Header Toolbar Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141219]/90 backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="space-y-1">
            <input
              type="text"
              value={piece.title || ''}
              onChange={(e) => setPiece({ ...piece, title: e.target.value })}
              className="bg-transparent text-xl font-extrabold text-stone-100 border-b border-transparent hover:border-white/20 focus:border-teal-500 focus:outline-none py-1 transition w-64 md:w-80"
              placeholder="Composition Title..."
            />
            <p className="text-[10px] uppercase tracking-widest text-teal-400 font-bold">
              v3.6 Arrangement DAW · Multi-Track Timeline
            </p>
          </div>

          {/* Piece-level Tempo Control */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl">
            {piece.tempoBpm === null ? (
              <button
                onClick={() => setPiece({ ...piece, tempoBpm: 120 })}
                className="flex items-center gap-2 text-xs font-bold text-teal-400 hover:text-teal-300 transition"
              >
                <Plus className="w-4 h-4" />
                Add Tempo Layer
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-stone-400">
                  Tempo:
                </span>
                <input
                  type="number"
                  min="40"
                  max="240"
                  value={piece.tempoBpm}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setPiece({
                      ...piece,
                      tempoBpm: isNaN(val)
                        ? 120
                        : Math.max(40, Math.min(240, val)),
                    });
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-stone-100 text-center py-1 w-16 focus:outline-none focus:border-teal-500"
                />
                <span className="text-xs text-stone-500 font-mono">BPM</span>
                <button
                  onClick={() => setPiece({ ...piece, tempoBpm: null })}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 transition pl-2 border-l border-white/10"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLoadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-stone-200 hover:bg-white/10 transition"
          >
            <FolderOpen className="w-4 h-4 text-teal-400" />
            Load Compositions
          </button>
          <button
            onClick={handleSavePiece}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/20 border border-teal-500/50 rounded-2xl text-xs font-bold text-teal-300 hover:bg-teal-500/30 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleSharePiece}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-500/20 border border-violet-500/50 rounded-2xl text-xs font-bold text-violet-300 hover:bg-violet-500/30 transition"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>

      {/* 2. Main Timeline DAW Surface */}
      <div className="bg-[#141219]/90 border border-white/5 p-6 rounded-3xl shadow-2xl space-y-6">
        {/* Playback Controls & Transport */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePlayPause}
              className={`p-3 rounded-2xl transition-all border ${
                isPlaying
                  ? 'bg-amber-500/25 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse'
                  : 'bg-teal-500/25 border-teal-500/50 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
              }`}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>
            <button
              onClick={handleStop}
              className="p-3 bg-white/5 border border-white/10 rounded-2xl text-stone-300 hover:bg-white/10 transition"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>

            {/* Re-Roll Seed */}
            <button
              onClick={handleReRoll}
              className="p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-300 transition flex items-center gap-1.5"
              title="Re-roll Variation Seed"
            >
              <Dices className="w-5 h-5" />
              {piece.variationSeed !== null &&
                piece.variationSeed !== undefined && (
                  <span className="text-[10px] font-mono font-black uppercase bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/20">
                    {piece.variationSeed}
                  </span>
                )}
            </button>

            {/* Snap Modes selector */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2.5 rounded-2xl text-xs">
              <Grid className="w-4 h-4 text-teal-400" />
              <span className="text-stone-400">Snap:</span>
              <select
                value={snapMode}
                onChange={(e) => setSnapMode(e.target.value as any)}
                className="bg-transparent text-teal-300 font-bold border-none outline-none cursor-pointer focus:ring-0 focus:outline-none"
              >
                <option value="off" className="bg-[#1b1723] text-stone-200">
                  Snap Off
                </option>
                <option value="grid" className="bg-[#1b1723] text-stone-200">
                  Snaps Grid (16th)
                </option>
                <option value="bar" className="bg-[#1b1723] text-stone-200">
                  Snaps Bar
                </option>
                <option
                  value="movement"
                  className="bg-[#1b1723] text-stone-200"
                >
                  Movements
                </option>
                <option value="segment" className="bg-[#1b1723] text-stone-200">
                  Segments
                </option>
              </select>
            </div>

            {/* Standalone Notation Editor Toggle */}
            <button
              onClick={() => setShowNotation(!showNotation)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-2xl text-xs font-bold transition-all ${
                showNotation
                  ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-pulse'
                  : 'bg-white/5 border border-white/10 text-stone-300 hover:bg-white/10'
              }`}
            >
              <Activity className="w-4 h-4 text-violet-400" />
              Piano Roll Editor
            </button>

            <button
              onClick={handleAddMovement}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/20 border border-teal-500/50 hover:bg-teal-500/30 text-teal-300 rounded-2xl text-xs font-bold transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Movement
            </button>

            {/* Advance Open Indicator */}
            {isPlaying && piece.segments[activeSegIdx]?.type === 'open' && (
              <button
                onClick={handleAdvanceOpen}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/25 border border-rose-500/50 rounded-2xl text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition animate-pulse"
              >
                Advance Open Segment →
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Sync default params */}
            <button
              onClick={handleCaptureDefaults}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold rounded-xl text-stone-400 hover:text-stone-200 transition"
            >
              <Volume2 className="w-4 h-4 text-teal-400" />
              Capture defaults
            </button>
          </div>
        </div>

        {/* Region Editor Toolbar Buttons */}
        {selectionStartMs !== null && selectionEndMs !== null && (
          <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/30 px-4 py-3 rounded-2xl animate-fadeIn justify-between">
            <div className="text-xs text-violet-300 font-semibold">
              Selected Region:{' '}
              <span className="font-mono">
                {(Math.min(selectionStartMs, selectionEndMs) / 1000).toFixed(2)}
                s
              </span>{' '}
              to{' '}
              <span className="font-mono">
                {(Math.max(selectionStartMs, selectionEndMs) / 1000).toFixed(2)}
                s
              </span>{' '}
              ({(Math.abs(selectionEndMs - selectionStartMs) / 1000).toFixed(2)}
              s duration)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRegionCopy}
                className="flex items-center gap-1.5 px-3 py-1 bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 rounded-lg text-xs transition"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <button
                onClick={handleRegionDuplicate}
                className="flex items-center gap-1.5 px-3 py-1 bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 rounded-lg text-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button
                onClick={() => handleRegionDelete(false)}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 rounded-lg text-xs transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear in-place
              </button>
              <button
                onClick={() => handleRegionDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600/30 border border-rose-500/40 text-rose-300 hover:bg-rose-600/40 rounded-lg text-xs transition"
                title="Ripple delete timeline selection range"
              >
                <Scissors className="w-3.5 h-3.5" /> Ripple Cut
              </button>
              <button
                onClick={handleClearSelection}
                className="px-2.5 py-1 text-stone-400 hover:text-stone-200 text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Stacked Tracks Container */}
        <div className="w-full border border-white/5 rounded-3xl bg-[#0f0c12] overflow-hidden flex flex-col relative">
          {/* Zoom controls inside the main window */}
          <div className="absolute top-2 right-4 flex items-center gap-3 z-30 bg-stone-900/80 border border-white/10 rounded-xl px-3 py-1.5 backdrop-blur">
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
              Timeline Zoom:
            </span>
            <button
              onClick={() => setZoomFactor((z) => Math.max(0.5, z * 0.8))}
              className="text-xs text-stone-400 hover:text-white"
            >
              Zoom Out
            </button>
            <span className="text-xs font-mono text-teal-400">
              {zoomFactor.toFixed(1)}x
            </span>
            <button
              onClick={() => setZoomFactor((z) => Math.min(50.0, z * 1.2))}
              className="text-xs text-stone-400 hover:text-white"
            >
              Zoom In
            </button>
          </div>

          <div
            ref={timelineContainerRef}
            onWheel={handleContainerWheel}
            onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
            className="w-full overflow-x-auto custom-scrollbar relative flex flex-col"
          >
            {/* Ruler / Timebar at the top */}
            <div
              className="h-10 border-b border-white/5 bg-[#14111a] relative cursor-crosshair"
              style={{
                width: `${timelineWidthPx + TRACK_HEADER_WIDTH}px`,
                paddingLeft: `${TRACK_HEADER_WIDTH}px`,
              }}
              onMouseDown={handleRulerMouseDown}
            >
              {/* SVG Grid Ruler ticks */}
              <div className="absolute inset-y-0 left-0 right-0 pointer-events-none">
                {(() => {
                  const ticks = [];
                  const intervalMs = piece.tempoBpm
                    ? (60 / piece.tempoBpm) * 4 * 1000
                    : 5000; // bar or 5s ticks
                  const totalTicks = Math.ceil(totalDurationMs / intervalMs);
                  for (let i = 0; i <= totalTicks; i++) {
                    const timeMs = i * intervalMs;
                    const left = TRACK_HEADER_WIDTH + timeMs * zoomScale;
                    ticks.push(
                      <div
                        key={i}
                        className="absolute bottom-0 border-l border-white/10 h-3 text-[8px] font-mono text-stone-500 pl-1"
                        style={{ left: `${left}px` }}
                      >
                        {piece.tempoBpm
                          ? `Bar ${i + 1}`
                          : `${(timeMs / 1000).toFixed(0)}s`}
                      </div>,
                    );
                  }
                  return ticks;
                })()}
              </div>
            </div>

            {/* 2.0 Movements Track */}
            {piece.movements && piece.movements.length > 0 && (
              <div
                className="flex border-b border-white/5 relative items-stretch group"
                style={{
                  width: `${timelineWidthPx + TRACK_HEADER_WIDTH}px`,
                  minHeight: `48px`,
                }}
              >
                {/* Header */}
                <div className="w-[220px] bg-[#14111a] border-r border-white/5 flex items-center justify-between px-4 z-20 sticky left-0 shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                    Movements
                  </span>
                </div>
                {/* Body scroll movements */}
                <div className="flex-1 relative bg-white/[0.005] h-12">
                  {piece.movements.map((mov, movIdx) => {
                    const { left, width } = getRangeLayout(
                      mov.startSegmentIndex,
                      mov.endSegmentIndex,
                    );
                    return (
                      <div
                        key={movIdx}
                        className="absolute top-1 bottom-1 border-t-2 border-x-2 border-teal-500/80 rounded-t-lg bg-teal-500/10 flex items-center justify-between px-3 text-xs font-bold text-teal-300 select-none group/mov animate-fadeIn"
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                        }}
                      >
                        {/* Left Drag Handle */}
                        <div
                          onMouseDown={(e) =>
                            handleStartDragMovement(e, movIdx, 'left')
                          }
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-teal-400/0 hover:bg-teal-400/40 rounded-l transition-colors z-20"
                        />

                        {/* Movement Info & Click to Edit */}
                        <span
                          onClick={() => setEditingMovementIdx(movIdx)}
                          className="truncate cursor-pointer hover:underline flex items-center gap-1.5 z-10 px-1"
                        >
                          {mov.name}
                        </span>

                        {/* Right Drag Handle */}
                        <div
                          onMouseDown={(e) =>
                            handleStartDragMovement(e, movIdx, 'right')
                          }
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-teal-400/0 hover:bg-teal-400/40 rounded-r transition-colors z-20"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2.1 Segment Track */}
            <div
              className="flex border-b border-white/5 relative items-stretch group"
              style={{
                width: `${timelineWidthPx + TRACK_HEADER_WIDTH}px`,
                minHeight: expandedTracks['segments']
                  ? `${MIN_TRACK_HEIGHT_EXPANDED}px`
                  : `${COLLAPSED_TRACK_HEIGHT}px`,
              }}
            >
              {/* Header */}
              <div className="w-[220px] bg-[#14111a] border-r border-white/5 flex items-center justify-between px-4 z-20 sticky left-0 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTrackExpansion('segments')}
                    className="text-stone-500 hover:text-stone-300"
                  >
                    {expandedTracks['segments'] ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                    Segment blocks
                  </span>
                </div>
                {expandedTracks['segments'] && (
                  <div className="flex items-center gap-1">
                    <select
                      onChange={(e) => {
                        handleAddSegment(e.target.value as any);
                        e.target.value = '';
                      }}
                      className="bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[10px] font-bold rounded px-1 cursor-pointer focus:outline-none"
                    >
                      <option value="">+ Add...</option>
                      <option value="fixed">Fixed Block</option>
                      <option value="transition">Transition</option>
                      <option value="arc">Arc curve</option>
                      <option value="meta-arc">Meta-Arc</option>
                      <option value="open">Open End</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Scrollable Track Body */}
              <div className="flex-1 relative bg-white/[0.01]">
                {expandedTracks['segments'] ? (
                  <div className="absolute inset-y-0 left-0 right-0 flex items-center gap-1 px-1">
                    {piece.segments.map((seg, idx) => {
                      const dur = getSegmentDuration(seg);
                      const left = getSegmentLeftOffset(idx);
                      const width = Math.max(60, dur * zoomScale);

                      // Viewport culling for segments
                      const segStartMs = left / zoomScale;
                      const segEndMs = segStartMs + dur;
                      if (
                        segEndMs < visibleStartMs ||
                        segStartMs > visibleEndMs
                      ) {
                        return null;
                      }

                      const isSelected = selectedIdx === idx;
                      const isActive = isPlaying && activeSegIdx === idx;

                      let colorClasses =
                        'border-teal-500 bg-teal-500/10 text-teal-300 hover:bg-teal-500/15';
                      if (seg.type === 'arc')
                        colorClasses =
                          'border-violet-500 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15';
                      if (seg.type === 'meta-arc')
                        colorClasses =
                          'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/15';
                      if (seg.type === 'open')
                        colorClasses =
                          'border-rose-500 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15';
                      if (seg.type === 'transition')
                        colorClasses =
                          'border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15';

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedIdx(idx)}
                          className={`absolute inset-y-2 border rounded-2xl flex items-center justify-between px-4 text-xs font-bold transition-all shadow select-none ${colorClasses} ${
                            isSelected
                              ? 'ring-2 ring-teal-400 z-20 border-teal-400'
                              : 'z-10'
                          } ${isActive ? 'shadow-[0_0_12px_rgba(20,184,166,0.3)] border-teal-300' : ''}`}
                          style={{
                            left: `${left}px`,
                            width: `${width - 4}px`,
                          }}
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="uppercase text-[9px] tracking-wider text-white/50">
                              {seg.type}
                            </span>
                            <span className="truncate text-white font-bold">
                              {seg.type === 'arc'
                                ? seg.config.arcId
                                : seg.type === 'meta-arc'
                                  ? 'Meta-Arc Walk'
                                  : `Segment ${idx + 1}`}
                            </span>
                          </div>

                          {/* Segment Resize drag handle */}
                          {seg.type !== 'open' && (
                            <div
                              onMouseDown={(e) => handleMouseDownResize(e, idx)}
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r-2xl bg-white/0 hover:bg-white/20 border-l border-white/5 transition z-30"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    {/* Collapsed block bars */}
                    {piece.segments.map((seg, idx) => {
                      const dur = getSegmentDuration(seg);
                      const left = getSegmentLeftOffset(idx);
                      const width = Math.max(10, dur * zoomScale);
                      let color = 'bg-teal-500/30';
                      if (seg.type === 'arc') color = 'bg-violet-500/30';
                      if (seg.type === 'meta-arc') color = 'bg-fuchsia-500/30';
                      if (seg.type === 'open') color = 'bg-rose-500/30';
                      if (seg.type === 'transition') color = 'bg-amber-500/30';
                      return (
                        <div
                          key={idx}
                          className={`absolute top-0 bottom-0 ${color}`}
                          style={{ left: `${left}px`, width: `${width}px` }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 2.2 Notation Track */}
            {piece.notation && (
              <div
                className="flex border-b border-white/5 relative items-stretch group"
                style={{
                  width: `${timelineWidthPx + TRACK_HEADER_WIDTH}px`,
                  minHeight: expandedTracks['notation']
                    ? `${MIN_TRACK_HEIGHT_EXPANDED}px`
                    : `${COLLAPSED_TRACK_HEIGHT}px`,
                }}
              >
                {/* Header */}
                <div className="w-[220px] bg-[#14111a] border-r border-white/5 flex items-center justify-between px-4 z-20 sticky left-0 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTrackExpansion('notation')}
                      className="text-stone-500 hover:text-stone-300"
                    >
                      {expandedTracks['notation'] ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                      Notation piano roll
                    </span>
                  </div>
                </div>

                {/* Body scroll notes */}
                <div className="flex-1 relative bg-white/[0.005] overflow-hidden">
                  {expandedTracks['notation'] ? (
                    <div className="w-full h-full relative">
                      {/* Render notes preview absolute positioned vertically based on pitch (zoom in 36..84) */}
                      {(piece.notation || []).map((n) => {
                        const left = n.onset_ms * zoomScale;
                        const width = n.duration_ms * zoomScale;

                        // Viewport culling for notation
                        if (
                          n.onset_ms + n.duration_ms < visibleStartMs ||
                          n.onset_ms > visibleEndMs
                        ) {
                          return null;
                        }

                        const pitchMin = 36;
                        const pitchMax = 84;
                        const pitchPct =
                          (n.pitch_midi - pitchMin) / (pitchMax - pitchMin);
                        const top =
                          MIN_TRACK_HEIGHT_EXPANDED -
                          Math.min(Math.max(0.1, pitchPct), 0.9) *
                            MIN_TRACK_HEIGHT_EXPANDED;

                        const isNotePlaying =
                          isPlaying &&
                          globalPlayheadMs >= n.onset_ms &&
                          globalPlayheadMs < n.onset_ms + n.duration_ms;

                        return (
                          <div
                            key={n.id}
                            className={`absolute rounded h-3 border text-[7px] font-bold text-white/80 overflow-hidden pl-1 ${
                              isNotePlaying
                                ? 'bg-gradient-to-r from-teal-400 to-violet-500 border-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.4)] z-20'
                                : 'bg-gradient-to-r from-teal-600/60 to-violet-700/60 border-teal-600/20 z-10'
                            }`}
                            style={{
                              left: `${left}px`,
                              width: `${width}px`,
                              top: `${top}px`,
                            }}
                          >
                            {n.pitch_midi}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="w-full h-full relative flex items-center">
                      {/* RenderCollapsed timeline notes */}
                      {(piece.notation || []).map((n) => (
                        <div
                          key={n.id}
                          className="absolute h-2 rounded bg-violet-400/40"
                          style={{
                            left: `${n.onset_ms * zoomScale}px`,
                            width: `${n.duration_ms * zoomScale}px`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2.3 Automation Tracks */}
            {(piece.automationTracks || []).map((track) => {
              const bounds = KEY_BOUNDS[track.paramKey as SharedKey] || {
                min: 0,
                max: 1,
              };
              const isExpanded = expandedTracks[track.paramKey] ?? true;
              const height = isExpanded
                ? MIN_TRACK_HEIGHT_EXPANDED
                : COLLAPSED_TRACK_HEIGHT;

              return (
                <div
                  key={track.id}
                  className="flex border-b border-white/5 relative items-stretch group"
                  style={{
                    width: `${timelineWidthPx + TRACK_HEADER_WIDTH}px`,
                    minHeight: `${height}px`,
                  }}
                >
                  {/* Header */}
                  <div className="w-[220px] bg-[#14111a] border-r border-white/5 flex items-center justify-between px-4 z-20 sticky left-0 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTrackExpansion(track.paramKey)}
                        className="text-stone-500 hover:text-stone-300"
                      >
                        {isExpanded ? (
                          <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                          <Maximize2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          {track.paramKey}
                        </span>
                        <span className="text-[9px] text-stone-500 uppercase tracking-widest font-mono">
                          curve
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <button
                        onClick={() =>
                          handleRemoveAutomationTrack(track.paramKey)
                        }
                        className="text-stone-500 hover:text-rose-400 transition"
                        title="Remove automation track"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Body SVG Automation editor */}
                  <div className="flex-1 relative bg-white/[0.003]">
                    <svg
                      width={timelineWidthPx}
                      height={height}
                      className="absolute inset-0"
                      onClick={(e) =>
                        handleAutomationTrackClick(e, track.paramKey)
                      }
                    >
                      {/* Plot path curve */}
                      <path
                        d={getCurvePath(track.points, track.paramKey, height)}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={isExpanded ? 2.5 : 1}
                        className="opacity-70 pointer-events-none"
                      />

                      {/* Render individual points if expanded */}
                      {isExpanded &&
                        track.points.map((pt) => {
                          const valToY = (val: number) => {
                            const pct =
                              (val - bounds.min) / (bounds.max - bounds.min);
                            return height - pct * height;
                          };
                          const x = pt.timeMs * zoomScale;
                          const y = valToY(pt.value);

                          // Viewport culling for points
                          if (
                            pt.timeMs < visibleStartMs - 1000 ||
                            pt.timeMs > visibleEndMs + 1000
                          ) {
                            return null;
                          }

                          return (
                            <g key={pt.id} className="cursor-pointer group/pt">
                              <circle
                                cx={x}
                                cy={y}
                                r={5}
                                fill="#f59e0b"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                                onPointerDown={(e) =>
                                  handleAutomationPointDrag(
                                    e,
                                    track.paramKey,
                                    pt.id,
                                  )
                                }
                                onDoubleClick={(e) =>
                                  handleAutomationPointDoubleClick(
                                    e,
                                    track.paramKey,
                                    pt.id,
                                  )
                                }
                              />
                              {/* Tap/click menu to change interpolation */}
                              <text
                                x={x}
                                y={y - 10}
                                className="text-[8px] fill-stone-400 opacity-0 group-hover/pt:opacity-100 font-bold transition-opacity"
                                textAnchor="middle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleInterpolation(
                                    track.paramKey,
                                    pt.id,
                                  );
                                }}
                              >
                                {pt.interpolation.slice(0, 3).toUpperCase()}
                              </text>
                            </g>
                          );
                        })}
                    </svg>
                  </div>
                </div>
              );
            })}

            {/* 2.4 Meta-Arc Preview Track (Read-Only) */}
            {piece.segments.some((s) => s.type === 'meta-arc') && (
              <div
                className="flex border-b border-white/5 relative items-stretch group"
                style={{
                  width: `${timelineWidthPx + TRACK_HEADER_WIDTH}px`,
                  minHeight: `${MIN_TRACK_HEIGHT_EXPANDED}px`,
                }}
              >
                {/* Header */}
                <div className="w-[220px] bg-[#14111a] border-r border-white/5 flex items-center justify-between px-4 z-20 sticky left-0 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400">
                      Meta-arc curves
                    </span>
                  </div>
                </div>

                {/* Read only preview SVG paths */}
                <div className="flex-1 relative bg-white/[0.002]">
                  <svg
                    width={timelineWidthPx}
                    height={MIN_TRACK_HEIGHT_EXPANDED}
                    className="absolute inset-0 pointer-events-none"
                  >
                    {piece.segments.map((seg, idx) => {
                      if (seg.type !== 'meta-arc') return null;
                      const paths = getMetaArcPreviewPaths(
                        seg,
                        idx,
                        MIN_TRACK_HEIGHT_EXPANDED,
                      );
                      const colors: Record<string, string> = {
                        rootFreq: '#ec4899', // pink
                        brightness: '#10b981', // green
                        space: '#06b6d4', // cyan
                      };
                      return (
                        <g key={idx} className="opacity-50">
                          {paths.map(({ path, param }) => (
                            <path
                              key={param}
                              d={path}
                              fill="none"
                              stroke={colors[param] || '#ffffff'}
                              strokeWidth={1.5}
                              strokeDasharray="4 2"
                            />
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}

            {/* Playhead Vertical Overlay Line */}
            {isPlaying && (
              <div
                className="absolute inset-y-0 w-0.5 bg-red-400/90 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)] z-30"
                style={{
                  left: `${TRACK_HEADER_WIDTH + globalPlayheadMs * zoomScale}px`,
                }}
              />
            )}

            {/* Selection overlay box */}
            {selectionStartMs !== null && selectionEndMs !== null && (
              <div
                className="absolute inset-y-0 bg-violet-500/15 border-x border-violet-500/50 pointer-events-none z-20 shadow-[inset_0_0_15px_rgba(139,92,246,0.1)]"
                style={{
                  left: `${TRACK_HEADER_WIDTH + Math.min(selectionStartMs, selectionEndMs) * zoomScale}px`,
                  width: `${Math.abs(selectionEndMs - selectionStartMs) * zoomScale}px`,
                }}
              />
            )}
          </div>
        </div>

        {/* Dynamic add automation dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">
            Add Automation Track:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {SHARED_KEYS.filter((k) => k !== 'rootFreq').map((k) => (
              <button
                key={k}
                onClick={() => handleAddAutomationTrack(k)}
                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold hover:text-white transition flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Detailed Editor Properties Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Segment attributes editing panel */}
          {selectedIdx !== null && piece.segments[selectedIdx] ? (
            <div className="bg-[#141219]/90 border border-white/5 p-6 rounded-3xl shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-teal-400">
                  Segment {selectedIdx + 1} Properties (
                  {piece.segments[selectedIdx].type})
                </h3>
                <button
                  onClick={() => handleDeleteSegment(selectedIdx)}
                  className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold transition"
                >
                  <Trash2 className="w-4 h-4" /> Delete Block
                </button>
              </div>

              <SegmentProperties
                segment={piece.segments[selectedIdx]}
                onChange={handleSegmentChange}
              />
            </div>
          ) : (
            <div className="bg-[#141219]/90 border border-white/5 p-12 rounded-3xl shadow-2xl text-center text-stone-500 text-xs font-medium uppercase tracking-wider">
              Select a segment block on the timeline track to configure
              parameters
            </div>
          )}
        </div>

        {/* Procedural Variation Rule Manager Column */}
        <div className="space-y-6">
          <VariationEditorPanel
            piece={piece}
            onUpdate={(updated: Piece) => {
              setPiece(updated);
              if (playerRef.current) playerRef.current.updatePiece(updated);
            }}
            onEditPoint={(vp) => handleEditPoint(vp, 'piece')}
          />
        </div>
      </div>

      {/* Standalone full piano roll overlays */}
      {showNotation && (
        <div className="fixed inset-0 bg-[#070609]/95 z-40 overflow-auto p-6 md:p-12 flex flex-col justify-start select-none">
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between mb-6">
            <h2 className="text-xl uppercase tracking-[0.2em] font-extrabold text-violet-300">
              Monophonic Piano Roll overlay
            </h2>
            <button
              onClick={() => setShowNotation(false)}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-xs font-bold transition shadow-lg"
            >
              Back to Arranger View
            </button>
          </div>
          <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
            <NotationEditor
              piece={piece}
              onChange={(updated) => {
                setPiece(updated);
                if (playerRef.current) playerRef.current.updatePiece(updated);
              }}
              isPlaying={isPlaying}
              globalPlayheadMs={globalPlayheadMs}
            />
          </div>
        </div>
      )}

      {/* 4. CRUD loading Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn text-stone-200">
          <div className="bg-[#18151f] border border-white/10 w-full max-w-lg p-6 rounded-3xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-teal-400">
                Load Pieces
              </h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="text-stone-400 hover:text-stone-200 transition text-xs font-bold"
              >
                Close
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-3 custom-scrollbar">
              {savedPieces.length === 0 ? (
                <div className="text-center text-xs text-stone-500 py-12 uppercase tracking-wider font-semibold">
                  No saved pieces found.
                </div>
              ) : (
                savedPieces.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleLoadPiece(item)}
                    className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl cursor-pointer border border-white/5 hover:border-teal-500/20 transition-all group shadow-sm"
                  >
                    <div>
                      <h4 className="text-sm font-bold group-hover:text-teal-300 transition-colors">
                        {item.title || 'Untitled Piece'}
                      </h4>
                      <p className="text-[10px] text-stone-400 mt-1 uppercase tracking-wider">
                        Segments: {item.segments?.length || 0} ·{' '}
                        {item.tempo_bpm ? `${item.tempo_bpm} BPM` : 'Tempoless'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-teal-400 transition-colors" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Movements edit modal */}
      {editingMovementIdx !== null &&
        piece.movements?.[editingMovementIdx] &&
        (() => {
          const mov = piece.movements[editingMovementIdx];
          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn text-stone-200">
              <div className="bg-[#18151f] border border-white/10 w-full max-w-lg p-6 rounded-3xl shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-teal-400">
                    Edit Movement
                  </h3>
                  <button
                    onClick={() => setEditingMovementIdx(null)}
                    className="text-stone-400 hover:text-stone-200 transition text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-teal-400 mb-2">
                      Movement Name
                    </label>
                    <input
                      type="text"
                      value={mov.name}
                      onChange={(e) => {
                        const updated = piece.movements!.map((m, i) =>
                          i === editingMovementIdx
                            ? { ...m, name: e.target.value }
                            : m,
                        );
                        const updatedPiece = { ...piece, movements: updated };
                        setPiece(updatedPiece);
                        if (playerRef.current)
                          playerRef.current.updatePiece(updatedPiece);
                      }}
                      className="w-full bg-white/5 border border-white/10 focus:border-teal-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition text-stone-200"
                      placeholder="e.g. Intro / Phase I"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-teal-400 mb-2">
                      Description
                    </label>
                    <textarea
                      value={mov.description || ''}
                      onChange={(e) => {
                        const updated = piece.movements!.map((m, i) =>
                          i === editingMovementIdx
                            ? { ...m, description: e.target.value }
                            : m,
                        );
                        const updatedPiece = { ...piece, movements: updated };
                        setPiece(updatedPiece);
                        if (playerRef.current)
                          playerRef.current.updatePiece(updatedPiece);
                      }}
                      className="w-full bg-white/5 border border-white/10 focus:border-teal-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition min-h-[80px] text-stone-200"
                      placeholder="Optional description of this movement..."
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <button
                    onClick={() => {
                      const updated = piece.movements!.filter(
                        (_, i) => i !== editingMovementIdx,
                      );
                      const updatedPiece = { ...piece, movements: updated };
                      setPiece(updatedPiece);
                      if (playerRef.current)
                        playerRef.current.updatePiece(updatedPiece);
                      setEditingMovementIdx(null);
                      showToast('Movement deleted');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/20 border border-rose-500/50 hover:bg-rose-500/30 text-rose-300 rounded-2xl text-xs font-bold transition"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Movement
                  </button>
                  <button
                    onClick={() => setEditingMovementIdx(null)}
                    className="px-6 py-2.5 bg-teal-500 border border-teal-600 text-white rounded-2xl text-xs font-bold hover:bg-teal-600 transition"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Procedural variations helper dial */}
      {activeVpEdit && (
        <VariationDialog
          isOpen={true}
          onClose={() => setActiveVpEdit(null)}
          paramKey={activeVpEdit.paramKey}
          paramLabel={activeVpEdit.paramLabel}
          initialPoint={activeVpEdit.initialPoint}
          minVal={activeVpEdit.minVal}
          maxVal={activeVpEdit.maxVal}
          stepVal={activeVpEdit.stepVal}
          onSave={handleSavePieceVariation}
          onDelete={handleDeletePieceVariation}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Piece, NotationNote } from '@/piece/types';
import {
  Trash2,
  ZoomIn,
  Grid,
  HelpCircle,
  Activity,
  Upload,
  Download,
} from 'lucide-react';
import { Midi } from '@tonejs/midi';

interface NotationEditorProps {
  piece: Piece;
  onChange: (updatedPiece: Piece) => void;
  isPlaying: boolean;
  globalPlayheadMs: number;
}

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

// Generate MIDI note rows from C0 (12) to C8 (108)
const MIDI_NOTES = (() => {
  const notes = [];
  for (let p = 108; p >= 12; p--) {
    const name = NOTE_NAMES[p % 12] || '';
    const octave = Math.floor(p / 12) - 1;
    const isBlack = name.includes('#');
    notes.push({ name: `${name}${octave}`, isBlack, pitch: p });
  }
  return notes;
})();

const BASE_PX_PER_SEC = 60; // 60px = 1 second at 1.0x horizontal zoom
const MIN_NOTE_DURATION_MS = 50;

export const NotationEditor: React.FC<NotationEditorProps> = ({
  piece,
  onChange,
  isPlaying,
  globalPlayheadMs,
}) => {
  // Navigation & Zoom State
  const [zoomH, setZoomH] = useState(1.2); // Horizontal zoom factor (0.5x - 3.0x)
  const [zoomV, setZoomV] = useState(24); // Vertical row height (16px - 40px)
  const [gridSnap, setGridSnap] = useState<
    'off' | '1/4' | '1/8' | '1/16' | '1/32'
  >('1/16');
  const [smoothPitch, setSmoothPitch] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // MIDI Import/Export State
  const [midiImport, setMidiImport] = useState<{
    tracks: {
      index: number;
      name: string;
      noteCount: number;
      notes: { onset_ms: number; duration_ms: number; pitch_midi: number }[];
    }[];
    selectedTrackIndex: number;
    detectedBpm: number | null;
    syncTempo: boolean;
    snapOnImport: 'off' | '1/4' | '1/8' | '1/16' | '1/32';
    appendMode: boolean;
  } | null>(null);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const keysContainerRef = useRef<HTMLDivElement>(null);

  // Time conversion metrics based on zoom
  const pxPerMs = useMemo(() => (BASE_PX_PER_SEC / 1000) * zoomH, [zoomH]);

  // Determine total visible width based on the piece duration or notes boundaries
  const totalDurationMs = useMemo(() => {
    let maxTime = piece.totalDurationMs || 30000;
    if (piece.notation && piece.notation.length > 0) {
      piece.notation.forEach((n) => {
        maxTime = Math.max(maxTime, n.onset_ms + n.duration_ms + 2000);
      });
    }
    return maxTime;
  }, [piece.totalDurationMs, piece.notation]);

  const editorWidthPx = useMemo(
    () => totalDurationMs * pxPerMs,
    [totalDurationMs, pxPerMs],
  );

  // Quantization Math
  const getSubdivisionDurationMs = (): number | null => {
    if (piece.tempoBpm === null || piece.tempoBpm <= 0 || gridSnap === 'off') {
      return null;
    }
    const beatDurationMs = (60 / piece.tempoBpm) * 1000;
    switch (gridSnap) {
      case '1/4':
        return beatDurationMs;
      case '1/8':
        return beatDurationMs / 2;
      case '1/16':
        return beatDurationMs / 4;
      case '1/32':
        return beatDurationMs / 8;
      default:
        return null;
    }
  };

  const quantizeValue = (ms: number): number => {
    const subMs = getSubdivisionDurationMs();
    if (subMs === null) return Math.max(0, ms);
    return Math.max(0, Math.round(ms / subMs) * subMs);
  };

  // Synchronize Vertical Scroll between the Piano Keys sidebar and the grid container
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (keysContainerRef.current) {
      keysContainerRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Add a Note
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent adding if we clicked directly on an existing note
    if ((e.target as HTMLElement).closest('.note-block')) return;

    if (!gridContainerRef.current) return;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const rawOnsetMs = clickX / pxPerMs;
    const onsetMs = quantizeValue(rawOnsetMs);
    const pitchIdx = Math.floor(clickY / zoomV);
    const midiPitch = MIDI_NOTES[pitchIdx]?.pitch;

    if (midiPitch === undefined) return;

    // Set default note duration: 1 subdivision step or 500ms
    const subMs = getSubdivisionDurationMs();
    const durationMs = subMs !== null ? subMs : 500;

    // Check monophonic overlapping notes
    const overlapping = piece.notation?.some(
      (n) => onsetMs >= n.onset_ms && onsetMs < n.onset_ms + n.duration_ms,
    );
    if (overlapping) return; // Prevent overlapping notes

    const newNote: NotationNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      onset_ms: onsetMs,
      duration_ms: durationMs,
      pitch_midi: midiPitch,
    };

    const updatedNotation = [...(piece.notation || []), newNote].sort(
      (a, b) => a.onset_ms - b.onset_ms,
    );

    onChange({
      ...piece,
      notation: updatedNotation,
    });
    setSelectedNoteId(newNote.id);
  };

  // Drag and Resize handlers
  const handleNotePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    note: NotationNote,
    action: 'move' | 'resize',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedNoteId(note.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startOnset = note.onset_ms;
    const startDuration = note.duration_ms;
    const startPitch = note.pitch_midi;

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.stopPropagation();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const deltaOnsetMs = deltaX / pxPerMs;

      if (action === 'move') {
        let nextOnset = Math.max(0, startOnset + deltaOnsetMs);
        nextOnset = quantizeValue(nextOnset);

        const deltaPitch = -Math.round(deltaY / zoomV);
        const nextPitch = Math.max(12, Math.min(108, startPitch + deltaPitch));

        // Enforce monophonic note limit: no overlap during move
        const otherNotes = (piece.notation || []).filter(
          (n) => n.id !== note.id,
        );
        const hasOverlap = otherNotes.some(
          (n) =>
            (nextOnset >= n.onset_ms &&
              nextOnset < n.onset_ms + n.duration_ms) ||
            (nextOnset + startDuration > n.onset_ms &&
              nextOnset < n.onset_ms + n.duration_ms),
        );

        const updated = (piece.notation || []).map((n) => {
          if (n.id === note.id) {
            return {
              ...n,
              onset_ms: hasOverlap ? n.onset_ms : nextOnset,
              pitch_midi: nextPitch,
            };
          }
          return n;
        });

        onChange({ ...piece, notation: updated });
      } else if (action === 'resize') {
        let nextDuration = Math.max(
          MIN_NOTE_DURATION_MS,
          startDuration + deltaOnsetMs,
        );
        nextDuration = quantizeValue(nextDuration);

        // Prevent resizing note to overlap subsequent note
        const otherNotes = (piece.notation || []).filter(
          (n) => n.id !== note.id,
        );
        const subsequentNote = otherNotes
          .filter((n) => n.onset_ms >= startOnset)
          .sort((a, b) => a.onset_ms - b.onset_ms)[0];

        if (
          subsequentNote &&
          startOnset + nextDuration > subsequentNote.onset_ms
        ) {
          nextDuration = subsequentNote.onset_ms - startOnset;
        }

        const updated = (piece.notation || []).map((n) => {
          if (n.id === note.id) {
            return { ...n, duration_ms: nextDuration };
          }
          return n;
        });

        onChange({ ...piece, notation: updated });
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      upEvent.stopPropagation();
      el.releasePointerCapture(upEvent.pointerId);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
    };

    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
  };

  // Delete a note
  const handleDeleteNote = (noteId: string) => {
    const updated = (piece.notation || []).filter((n) => n.id !== noteId);
    onChange({ ...piece, notation: updated });
    if (selectedNoteId === noteId) setSelectedNoteId(null);
  };

  // Handle MIDI File Upload
  const handleMidiUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleMidiFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (!arrayBuffer) return;

        const midi = new Midi(arrayBuffer);
        const bpm = midi.header.tempos[0]?.bpm || null;

        const parsedTracks = midi.tracks
          .map((track, index) => {
            const notes = track.notes.map((n) => ({
              onset_ms: Math.round(n.time * 1000),
              duration_ms: Math.round(n.duration * 1000),
              pitch_midi: n.midi,
            }));
            return {
              index,
              name: track.name || `Track ${index + 1}`,
              noteCount: notes.length,
              notes,
            };
          })
          .filter((t) => t.noteCount > 0);

        if (parsedTracks.length === 0) {
          alert('No tracks with notes found in this MIDI file.');
          return;
        }

        setMidiImport({
          tracks: parsedTracks,
          selectedTrackIndex: parsedTracks[0]?.index ?? 0,
          detectedBpm: bpm,
          syncTempo: bpm !== null,
          snapOnImport: '1/16',
          appendMode: false,
        });
      } catch (err) {
        console.error('Error parsing MIDI file:', err);
        alert(
          'Failed to parse MIDI file. Make sure it is a valid .mid or .midi file.',
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Convert track notes to monophonic and apply quantization if requested
  const handleExecuteImport = () => {
    if (!midiImport) return;
    const selectedTrack = midiImport.tracks.find(
      (t) => t.index === midiImport.selectedTrackIndex,
    );
    if (!selectedTrack) return;

    const targetTempo =
      midiImport.syncTempo && midiImport.detectedBpm
        ? midiImport.detectedBpm
        : piece.tempoBpm || 120;

    // Quantize notes
    const notes = selectedTrack.notes.map((n) => {
      const snap = midiImport.snapOnImport;
      if (snap === 'off') return n;

      const beatMs = (60 / targetTempo) * 1000;
      let subdivMs = beatMs;
      if (snap === '1/4') subdivMs = beatMs;
      else if (snap === '1/8') subdivMs = beatMs / 2;
      else if (snap === '1/16') subdivMs = beatMs / 4;
      else if (snap === '1/32') subdivMs = beatMs / 8;

      return {
        ...n,
        onset_ms: Math.round(n.onset_ms / subdivMs) * subdivMs,
        duration_ms: Math.max(
          MIN_NOTE_DURATION_MS,
          Math.round(n.duration_ms / subdivMs) * subdivMs,
        ),
      };
    });

    // Make monophonic
    // Sort by onset ascending. If same onset, sort by pitch descending (highest note wins)
    notes.sort((a, b) => {
      if (Math.abs(a.onset_ms - b.onset_ms) < 1) {
        return b.pitch_midi - a.pitch_midi;
      }
      return a.onset_ms - b.onset_ms;
    });

    const monophonic: {
      onset_ms: number;
      duration_ms: number;
      pitch_midi: number;
    }[] = [];
    for (let i = 0; i < notes.length; i++) {
      const noteItem = notes[i];
      if (!noteItem) continue;
      const current = { ...noteItem };
      if (monophonic.length > 0) {
        const prev = monophonic[monophonic.length - 1];
        if (prev) {
          if (Math.abs(prev.onset_ms - current.onset_ms) < 1) {
            continue; // Skip duplicates (already kept the highest note due to sorting)
          }
          if (current.onset_ms < prev.onset_ms + prev.duration_ms) {
            prev.duration_ms = Math.max(
              MIN_NOTE_DURATION_MS,
              current.onset_ms - prev.onset_ms,
            );
          }
        }
      }
      monophonic.push(current);
    }

    // Offset ids
    const importedNotes: NotationNote[] = monophonic.map((n, i) => ({
      id: `imported-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
      onset_ms: n.onset_ms,
      duration_ms: n.duration_ms,
      pitch_midi: n.pitch_midi,
    }));

    let finalNotation: NotationNote[] = [];
    if (midiImport.appendMode) {
      const existing = piece.notation || [];
      if (existing.length > 0) {
        const maxTime = Math.max(
          ...existing.map((n) => n.onset_ms + n.duration_ms),
        );
        const shiftedImported = importedNotes.map((n) => ({
          ...n,
          onset_ms: n.onset_ms + maxTime,
        }));
        finalNotation = [...existing, ...shiftedImported];
      } else {
        finalNotation = importedNotes;
      }
    } else {
      finalNotation = importedNotes;
    }

    // Monophonic safeguard check on the final list (sorting and boundary capping)
    finalNotation.sort((a, b) => a.onset_ms - b.onset_ms);
    const checkedNotation: NotationNote[] = [];
    for (let i = 0; i < finalNotation.length; i++) {
      const noteItem = finalNotation[i];
      if (!noteItem) continue;
      const current = { ...noteItem };
      if (checkedNotation.length > 0) {
        const prev = checkedNotation[checkedNotation.length - 1];
        if (prev && current.onset_ms < prev.onset_ms + prev.duration_ms) {
          prev.duration_ms = Math.max(
            MIN_NOTE_DURATION_MS,
            current.onset_ms - prev.onset_ms,
          );
        }
      }
      checkedNotation.push(current);
    }

    onChange({
      ...piece,
      tempoBpm:
        midiImport.syncTempo && midiImport.detectedBpm
          ? Math.round(midiImport.detectedBpm)
          : piece.tempoBpm,
      notation: checkedNotation,
    });

    setMidiImport(null);
  };

  // Handle MIDI File Export
  const handleMidiExport = () => {
    try {
      const midi = new Midi();
      midi.name = piece.title || 'Ambient Piece';

      if (piece.tempoBpm !== null && piece.tempoBpm > 0) {
        midi.header.setTempo(piece.tempoBpm);
      }

      const track = midi.addTrack();
      track.name = 'Notation Track';

      const notes = piece.notation || [];
      if (notes.length === 0) {
        alert('No notes in the notation track to export.');
        return;
      }

      notes.forEach((n) => {
        track.addNote({
          midi: n.pitch_midi,
          time: n.onset_ms / 1000,
          duration: n.duration_ms / 1000,
        });
      });

      const midiArray = midi.toArray();
      const blob = new Blob([midiArray.buffer as ArrayBuffer], {
        type: 'audio/midi',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(piece.title || 'ambient_piece').toLowerCase().replace(/\s+/g, '_')}_notation.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting MIDI file:', err);
      alert('Failed to export MIDI file.');
    }
  };

  // Handle Keyboard deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedNoteId && (e.key === 'Delete' || e.key === 'Backspace')) {
        // Prevent deleting note if typing in an input field
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return;
        }
        handleDeleteNote(selectedNoteId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId, piece.notation]);

  // Center vertical view to Middle C (C4 = MIDI pitch 60) on load
  useEffect(() => {
    if (scrollContainerRef.current) {
      const rowIndex = MIDI_NOTES.findIndex((n) => n.pitch === 60);
      if (rowIndex !== -1) {
        scrollContainerRef.current.scrollTop =
          rowIndex * zoomV - scrollContainerRef.current.clientHeight / 2;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update PiecePlayer's smooth transition preference
  useEffect(() => {
    // Attempt to access global PiecePlayer instance if running
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.activePiecePlayer) {
      win.activePiecePlayer.setSmoothPitch(smoothPitch);
    }
  }, [smoothPitch]);

  return (
    <div className="flex flex-col bg-[#16121c]/90 border border-white/5 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl transition-all">
      {/* Editor Controls Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between border-b border-white/5 bg-[#1b1723]/90 px-6 py-4 gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-400" />
            <span className="font-extrabold text-sm text-white/95 uppercase tracking-wider">
              Notation track
            </span>
          </div>

          {/* Grid Snap Control */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/70">
            <Grid className="w-3.5 h-3.5 text-teal-400" />
            <span>Snap:</span>
            <select
              value={gridSnap}
              onChange={(e) =>
                setGridSnap(
                  e.target.value as 'off' | '1/4' | '1/8' | '1/16' | '1/32',
                )
              }
              className="bg-transparent text-teal-300 font-bold border-none outline-none cursor-pointer focus:ring-0"
              disabled={piece.tempoBpm === null}
            >
              {piece.tempoBpm === null ? (
                <option value="off" className="bg-[#1b1723]">
                  Snap Off (Tempoless)
                </option>
              ) : (
                <>
                  <option value="1/4" className="bg-[#1b1723] text-white">
                    1/4 (Beat)
                  </option>
                  <option value="1/8" className="bg-[#1b1723] text-white">
                    1/8 (Half-Beat)
                  </option>
                  <option value="1/16" className="bg-[#1b1723] text-white">
                    1/16 (16th Note)
                  </option>
                  <option value="1/32" className="bg-[#1b1723] text-white">
                    1/32
                  </option>
                  <option value="off" className="bg-[#1b1723] text-white">
                    Off
                  </option>
                </>
              )}
            </select>
          </div>

          {/* Pitch Transition Smoothness Control */}
          <button
            onClick={() => setSmoothPitch(!smoothPitch)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition ${
              smoothPitch
                ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            {smoothPitch ? 'Smooth Ramps (Glide)' : 'Instant Changes'}
          </button>

          {/* MIDI Import Button */}
          <button
            onClick={handleMidiUploadClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold rounded-xl transition"
            title="Import a monophonic track from a MIDI file (.mid)"
          >
            <Upload className="w-3.5 h-3.5" />
            Import MIDI
          </button>

          {/* MIDI Export Button */}
          <button
            onClick={handleMidiExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl transition disabled:opacity-50"
            title="Export this notation track as a standard MIDI file (.mid)"
            disabled={!piece.notation || piece.notation.length === 0}
          >
            <Download className="w-3.5 h-3.5" />
            Export MIDI
          </button>

          {/* Hidden File Input for MIDI Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleMidiFileChange}
            accept=".mid,.midi"
            className="hidden"
          />
        </div>

        {/* Zoom & Helper Tools */}
        <div className="flex flex-wrap items-center gap-5 w-full lg:w-auto justify-end">
          {/* Zoom H */}
          <div className="flex items-center gap-2 text-xs text-white/50">
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Zoom H:</span>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={zoomH}
              onChange={(e) => setZoomH(parseFloat(e.target.value))}
              className="w-20 md:w-28 accent-teal-500 cursor-pointer"
            />
          </div>

          {/* Zoom V */}
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="font-mono select-none">↕</span>
            <span>Zoom V:</span>
            <input
              type="range"
              min="16"
              max="40"
              step="2"
              value={zoomV}
              onChange={(e) => setZoomV(parseInt(e.target.value, 10))}
              className="w-20 md:w-28 accent-teal-500 cursor-pointer"
            />
          </div>

          {/* Quick Delete Selected Note */}
          {selectedNoteId && (
            <button
              onClick={() => handleDeleteNote(selectedNoteId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition"
              title="Delete selected note (or press Delete/Backspace)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Note
            </button>
          )}

          <button
            onClick={() => setShowHelp(!showHelp)}
            title="Toggle Help"
            aria-label="Toggle Help"
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/60 hover:text-white transition"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Help Banner overlay */}
      {showHelp && (
        <div className="bg-[#1f1a29]/95 px-6 py-4 border-b border-white/5 text-xs text-white/70 space-y-1 animate-slideDown">
          <p className="font-bold text-white/90">Piano-Roll Interactions:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <span className="text-teal-400 font-bold">Add Note:</span> Click
              any empty grid cell.
            </li>
            <li>
              <span className="text-teal-400 font-bold">Move/Transpose:</span>{' '}
              Click and drag a note horizontally to adjust timing, or vertically
              to shift pitch.
            </li>
            <li>
              <span className="text-teal-400 font-bold">Change Duration:</span>{' '}
              Click and drag the{' '}
              <span className="underline decoration-teal-400 decoration-2 font-semibold">
                right edge handle
              </span>{' '}
              of a note block.
            </li>
            <li>
              <span className="text-teal-400 font-bold">Delete Note:</span>{' '}
              Select a note and click "Delete Note" or press{' '}
              <kbd className="bg-white/10 px-1 rounded">Backspace</kbd>/
              <kbd className="bg-white/10 px-1 rounded">Delete</kbd>.
            </li>
            <li>
              <span className="text-teal-400 font-bold">Monophony:</span>{' '}
              Overlapping notes are automatically restricted to preserve the
              engine's monophonic character.
            </li>
          </ul>
        </div>
      )}

      {/* Editor Main Sandbox */}
      <div className="flex flex-1 min-h-[300px] max-h-[500px] relative overflow-hidden bg-[#0e0c12]">
        {/* Left sidebar: Vertical Piano Keys */}
        <div
          ref={keysContainerRef}
          className="w-16 md:w-20 flex-shrink-0 select-none overflow-hidden border-r border-white/5 bg-[#14111a]"
          style={{ height: '100%' }}
        >
          {MIDI_NOTES.map((note) => (
            <div
              key={note.pitch}
              style={{ height: `${zoomV}px`, lineHeight: `${zoomV}px` }}
              className={`px-2 text-[9px] md:text-[10px] font-bold border-b border-white/5 flex items-center justify-between transition-colors ${
                note.isBlack
                  ? 'bg-black text-white/50 border-r-4 border-teal-500/20'
                  : 'bg-white/90 text-black border-r-4 border-white/10'
              }`}
            >
              <span>{note.name}</span>
              {note.pitch % 12 === 0 && (
                <span className="opacity-40 text-[7px]">Oct</span>
              )}
            </div>
          ))}
        </div>

        {/* Scrollable Notation Canvas */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto custom-scrollbar relative"
          style={{ height: '100%' }}
        >
          <div
            ref={gridContainerRef}
            onClick={handleGridClick}
            className="relative select-none"
            style={{
              width: `${editorWidthPx}px`,
              height: `${MIDI_NOTES.length * zoomV}px`,
            }}
          >
            {/* Grid rows background */}
            {MIDI_NOTES.map((note, index) => (
              <div
                key={note.pitch}
                style={{
                  height: `${zoomV}px`,
                  top: `${index * zoomV}px`,
                }}
                className={`absolute inset-x-0 border-b border-white/[0.03] pointer-events-none ${
                  note.isBlack ? 'bg-white/[0.01]' : 'bg-transparent'
                }`}
              />
            ))}

            {/* Vertical grid line ticks (Beats & Subdivisions) */}
            {piece.tempoBpm !== null && (
              <div className="absolute inset-0 pointer-events-none">
                {(() => {
                  const ticks = [];
                  const beatMs = (60 / piece.tempoBpm) * 1000;
                  const subdivMs = getSubdivisionDurationMs() || beatMs;
                  const totalSubdivisions = Math.ceil(
                    totalDurationMs / subdivMs,
                  );

                  for (let i = 0; i <= totalSubdivisions; i++) {
                    const timeMs = i * subdivMs;
                    const left = timeMs * pxPerMs;
                    const isBeat = timeMs % beatMs === 0;
                    const isBar = timeMs % (beatMs * 4) === 0;

                    let borderClass = 'border-white/[0.03]';
                    if (isBeat) borderClass = 'border-white/[0.08]';
                    if (isBar) borderClass = 'border-teal-500/20 w-[2px]';

                    ticks.push(
                      <div
                        key={i}
                        className={`absolute inset-y-0 border-l ${borderClass}`}
                        style={{ left: `${left}px` }}
                      />,
                    );
                  }
                  return ticks;
                })()}
              </div>
            )}

            {/* Note blocks absolute plotting */}
            {(piece.notation || []).map((note) => {
              const left = note.onset_ms * pxPerMs;
              const width = Math.max(
                MIN_NOTE_DURATION_MS * pxPerMs,
                note.duration_ms * pxPerMs,
              );
              const pitchIndex = MIDI_NOTES.findIndex(
                (n) => n.pitch === note.pitch_midi,
              );
              const top = pitchIndex * zoomV;

              const isSelected = selectedNoteId === note.id;
              const isNotePlaying =
                isPlaying &&
                globalPlayheadMs >= note.onset_ms &&
                globalPlayheadMs < note.onset_ms + note.duration_ms;

              const noteName = MIDI_NOTES[pitchIndex]?.name || '';

              return (
                <div
                  key={note.id}
                  onPointerDown={(e) => handleNotePointerDown(e, note, 'move')}
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    top: `${top}px`,
                    height: `${zoomV - 1}px`,
                  }}
                  className={`absolute rounded-lg border transition-shadow note-block group cursor-grab select-none flex items-center justify-between px-2 text-[9px] md:text-[10px] font-extrabold text-white shadow-md select-none ${
                    isNotePlaying
                      ? 'bg-gradient-to-r from-teal-400 via-emerald-400 to-violet-500 border-teal-300 ring-2 ring-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.5)] z-20'
                      : isSelected
                        ? 'bg-gradient-to-r from-teal-500 to-violet-600 border-teal-400 ring-1 ring-teal-500/50 z-20'
                        : 'bg-gradient-to-r from-teal-600/80 to-violet-700/80 hover:from-teal-500 hover:to-violet-600 border-teal-600/30 hover:border-teal-500/40 z-10'
                  }`}
                >
                  <span className="truncate pr-1 pointer-events-none">
                    {noteName}
                  </span>

                  {/* Inside note hover delete button */}
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => handleDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition absolute right-3 bg-black/40 hover:bg-black/80"
                  >
                    ×
                  </button>

                  {/* Horizontal resize drag handle */}
                  <div
                    onPointerDown={(e) =>
                      handleNotePointerDown(e, note, 'resize')
                    }
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r-lg bg-white/20 opacity-0 group-hover:opacity-100 hover:bg-white/40 border-l border-white/10 transition-opacity"
                  />
                </div>
              );
            })}

            {/* Playhead line overlay */}
            {isPlaying && (
              <div
                className="absolute inset-y-0 w-0.5 bg-red-400/90 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)] z-30"
                style={{ left: `${globalPlayheadMs * pxPerMs}px` }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer statistics */}
      <div className="bg-[#1b1723]/90 px-6 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
        <span>
          Note count: {(piece.notation || []).length} monophonic notes
        </span>
        {piece.tempoBpm !== null && (
          <span>
            Grid size: 1 beat = {((60 / piece.tempoBpm) * 1000).toFixed(0)} ms
          </span>
        )}
      </div>

      {/* MIDI Import Modal Dialog */}
      {midiImport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#1b1723] border border-white/10 w-full max-w-lg p-6 rounded-3xl shadow-2xl space-y-6 text-white text-left">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-violet-400" />
                <h3 className="text-lg font-bold">Import MIDI Notation</h3>
              </div>
              <button
                onClick={() => setMidiImport(null)}
                className="text-white/40 hover:text-white/80 transition text-sm"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-4">
              {/* Track Picker */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/60 block">
                  Select Track ({midiImport.tracks.length} tracks found):
                </label>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                  {midiImport.tracks.map((track) => (
                    <div
                      key={track.index}
                      onClick={() =>
                        setMidiImport({
                          ...midiImport,
                          selectedTrackIndex: track.index,
                        })
                      }
                      className={`p-3 bg-white/5 border rounded-2xl cursor-pointer transition flex items-center justify-between ${
                        midiImport.selectedTrackIndex === track.index
                          ? 'border-violet-500/80 bg-violet-500/10'
                          : 'border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-white/95">
                          {track.name}
                        </p>
                        <p className="text-xs text-white/40">
                          Track index: {track.index}
                        </p>
                      </div>
                      <span className="text-xs font-bold bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl text-teal-400">
                        {track.noteCount} notes
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tempo Sync */}
              {midiImport.detectedBpm !== null && (
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-2xl">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white/90">
                      Sync Piece Tempo
                    </p>
                    <p className="text-[10px] text-white/40">
                      Set the piece's tempo to the MIDI file's BPM (
                      {Math.round(midiImport.detectedBpm)} BPM)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={midiImport.syncTempo}
                    onChange={(e) =>
                      setMidiImport({
                        ...midiImport,
                        syncTempo: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-white/10 text-violet-600 focus:ring-0 bg-white/5 cursor-pointer"
                  />
                </div>
              )}

              {/* Snap/Quantization dropdown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/60 block">
                    Quantize / Snap Grid:
                  </label>
                  <select
                    value={midiImport.snapOnImport}
                    onChange={(e) =>
                      setMidiImport({
                        ...midiImport,
                        snapOnImport: e.target.value as
                          | 'off'
                          | '1/4'
                          | '1/8'
                          | '1/16'
                          | '1/32',
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white p-3 focus:outline-none focus:border-violet-500"
                  >
                    <option value="1/4" className="bg-[#1b1723] text-white">
                      1/4 (Beat)
                    </option>
                    <option value="1/8" className="bg-[#1b1723] text-white">
                      1/8 (Half-Beat)
                    </option>
                    <option value="1/16" className="bg-[#1b1723] text-white">
                      1/16 (16th Note)
                    </option>
                    <option value="1/32" className="bg-[#1b1723] text-white">
                      1/32
                    </option>
                    <option value="off" className="bg-[#1b1723] text-white">
                      No Quantization
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/60 block">
                    Import Mode:
                  </label>
                  <select
                    value={midiImport.appendMode ? 'append' : 'replace'}
                    onChange={(e) =>
                      setMidiImport({
                        ...midiImport,
                        appendMode: e.target.value === 'append',
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white p-3 focus:outline-none focus:border-violet-500"
                  >
                    <option value="replace" className="bg-[#1b1723] text-white">
                      Replace entire track
                    </option>
                    <option value="append" className="bg-[#1b1723] text-white">
                      Append to end of track
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
              <button
                onClick={() => setMidiImport(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteImport}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold rounded-2xl transition shadow-lg shadow-violet-500/20"
              >
                Import Selected Track
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

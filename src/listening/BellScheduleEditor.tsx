import { useState } from 'react';
import { Bell, Play, Plus, Trash2, HelpCircle } from 'lucide-react';
import {
  BELL_REGISTRY,
  getBellById,
  type BellDef,
} from '@/audio/bells/registry';
import { playBellPreview, type BellEvent } from '@/audio/bells/scheduler';
import type { Movement } from '@/piece/types';

interface BellScheduleEditorProps {
  schedule: BellEvent[];
  onChange: (newSchedule: BellEvent[]) => void;
  movements?: Movement[];
  totalDurationMs?: number | null;
}

let tempAudioCtx: AudioContext | null = null;

function getPreviewContext(): AudioContext {
  if (!tempAudioCtx) {
    const Ctx =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    tempAudioCtx = new Ctx();
  }
  if (tempAudioCtx && tempAudioCtx.state === 'suspended') {
    void tempAudioCtx.resume();
  }
  return tempAudioCtx;
}

export default function BellScheduleEditor({
  schedule = [],
  onChange,
  movements = [],
}: BellScheduleEditorProps) {
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  const handlePreview = async (
    bellId: string,
    volume = 0.7,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    try {
      setActivePreviewId(bellId);
      const ctx = getPreviewContext();
      await playBellPreview(ctx, ctx.destination, bellId, volume);
      // Brief active flash
      setTimeout(() => setActivePreviewId(null), 1000);
    } catch (err) {
      console.error('[BellScheduleEditor] Failed to preview bell:', err);
      setActivePreviewId(null);
    }
  };

  const handleAddEvent = () => {
    const newEvent: BellEvent = {
      bellId: 'zen_bell_rin',
      trigger: 'at-start',
      volume: 0.7,
      offsetMs: 0,
      intervalMin: 5,
    };
    onChange([...schedule, newEvent]);
  };

  const handleRemoveEvent = (index: number) => {
    const updated = [...schedule];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleUpdateEvent = (index: number, fields: Partial<BellEvent>) => {
    const updated = schedule.map((evt, idx) => {
      if (idx !== index) return evt;
      return { ...evt, ...fields } as BellEvent;
    });
    onChange(updated);
  };

  // Group bells by category
  const categories = BELL_REGISTRY.reduce<Record<string, BellDef[]>>(
    (acc, bell) => {
      if (!acc[bell.category]) acc[bell.category] = [];
      (acc[bell.category] as BellDef[]).push(bell);
      return acc;
    },
    {},
  );

  return (
    <div className="w-full space-y-4 rounded-xl border border-stone-850 bg-stone-950/40 p-4 backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-stone-900 pb-3">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-amber-400" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-amber-200 font-semibold">
            Bells & Punctuation
          </h3>
        </div>
        <button
          type="button"
          onClick={handleAddEvent}
          className="flex items-center gap-1 rounded bg-stone-900 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-amber-300 hover:bg-stone-850 transition-colors border border-stone-800"
        >
          <Plus size={10} />
          Add Bell
        </button>
      </header>

      {schedule.length === 0 ? (
        <div className="py-6 text-center border border-dashed border-stone-900 rounded-lg">
          <p className="font-mono text-[9px] uppercase tracking-wider text-stone-500">
            No scheduled bells.
          </p>
          <p className="text-[8px] uppercase tracking-wide text-stone-600 mt-1 max-w-xs mx-auto">
            Bells can punctuate sessions at movement boundaries or regular
            intervals.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
          {schedule.map((event, index) => {
            const bellDef = getBellById(event.bellId);

            return (
              <div
                key={index}
                className="group relative flex flex-col gap-3 rounded-lg border border-stone-900 bg-stone-950/80 p-3 hover:border-stone-800 transition-colors"
              >
                {/* Upper Row: Trigger Selection, Bell Selection, Delete */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  {/* Select Bell Instrument */}
                  <div className="sm:col-span-5 flex items-center gap-1.5">
                    <select
                      value={event.bellId}
                      onChange={(e) =>
                        handleUpdateEvent(index, { bellId: e.target.value })
                      }
                      className="w-full rounded border border-stone-850 bg-stone-950 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-stone-200 focus:border-amber-500/50 focus:outline-none"
                    >
                      {Object.entries(categories).map(([cat, bells]) => (
                        <optgroup key={cat} label={cat}>
                          {bells.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={(e) =>
                        handlePreview(event.bellId, event.volume, e)
                      }
                      disabled={activePreviewId !== null}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border border-stone-800 bg-stone-900 hover:border-amber-500/40 text-stone-400 hover:text-amber-300 transition-colors ${
                        activePreviewId === event.bellId
                          ? 'animate-pulse bg-amber-500/10 border-amber-500/30'
                          : ''
                      }`}
                      title="Preview Sound"
                    >
                      <Play size={10} fill="currentColor" />
                    </button>
                  </div>

                  {/* Trigger Selection */}
                  <div className="sm:col-span-4">
                    <select
                      value={event.trigger}
                      onChange={(e) =>
                        handleUpdateEvent(index, {
                          trigger: e.target.value as BellEvent['trigger'],
                          offsetMs: 0,
                          intervalMin: 5,
                        })
                      }
                      className="w-full rounded border border-stone-850 bg-stone-950 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-stone-200 focus:border-amber-500/50 focus:outline-none"
                    >
                      <option value="at-start">At Session Start</option>
                      <option value="at-end">At Session End</option>
                      <option value="at-time">At Specific Time</option>
                      <option value="every">Every N Minutes</option>
                      {movements.length > 0 && (
                        <>
                          <option value="at-movement-start">
                            At Movement Start
                          </option>
                          <option value="at-movement-end">
                            At Movement End
                          </option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Volume Slider */}
                  <div className="sm:col-span-2 flex items-center gap-1.5">
                    <span className="font-mono text-[8px] text-stone-500 uppercase tracking-widest shrink-0">
                      VOL:
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={event.volume}
                      onChange={(e) =>
                        handleUpdateEvent(index, {
                          volume: Number(e.target.value),
                        })
                      }
                      className="w-full h-1 bg-stone-900 rounded appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Delete Button */}
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveEvent(index)}
                      className="text-stone-600 hover:text-red-400 p-1 transition-colors rounded hover:bg-red-500/5"
                      title="Delete Event"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Lower Row: Specific Trigger Options */}
                {['at-start', 'at-end', 'at-time'].includes(event.trigger) && (
                  <div className="flex items-center gap-2 pl-1.5 border-l-2 border-stone-800 py-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">
                      Offset:
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={Math.round((event.offsetMs || 0) / 1000)}
                      onChange={(e) =>
                        handleUpdateEvent(index, {
                          offsetMs: Math.max(0, Number(e.target.value)) * 1000,
                        })
                      }
                      className="w-16 rounded border border-stone-850 bg-stone-950 px-2 py-0.5 font-mono text-[10px] text-stone-200 focus:border-amber-500/30 focus:outline-none"
                    />
                    <span className="font-mono text-[8px] uppercase tracking-widest text-stone-600">
                      seconds
                    </span>
                  </div>
                )}

                {event.trigger === 'every' && (
                  <div className="flex items-center gap-2 pl-1.5 border-l-2 border-stone-800 py-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">
                      Interval:
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={event.intervalMin || 5}
                      onChange={(e) =>
                        handleUpdateEvent(index, {
                          intervalMin: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-16 rounded border border-stone-850 bg-stone-950 px-2 py-0.5 font-mono text-[10px] text-stone-200 focus:border-amber-500/30 focus:outline-none"
                    />
                    <span className="font-mono text-[8px] uppercase tracking-widest text-stone-600">
                      minutes
                    </span>
                  </div>
                )}

                {['at-movement-start', 'at-movement-end'].includes(
                  event.trigger,
                ) && (
                  <div className="flex items-center gap-3 pl-1.5 border-l-2 border-stone-800 py-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">
                        Movement:
                      </span>
                      <select
                        value={event.movementIndex ?? 0}
                        onChange={(e) =>
                          handleUpdateEvent(index, {
                            movementIndex: Number(e.target.value),
                          })
                        }
                        className="rounded border border-stone-850 bg-stone-950 px-2 py-0.5 font-mono text-[10px] uppercase text-stone-200 focus:border-amber-500/30 focus:outline-none"
                      >
                        {movements.map((mov, mIdx) => (
                          <option key={mIdx} value={mIdx}>
                            {mIdx + 1}: {mov.name || 'Untitled Movement'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">
                        Offset:
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={Math.round((event.offsetMs || 0) / 1000)}
                        onChange={(e) =>
                          handleUpdateEvent(index, {
                            offsetMs:
                              Math.max(0, Number(e.target.value)) * 1000,
                          })
                        }
                        className="w-14 rounded border border-stone-850 bg-stone-950 px-2 py-0.5 font-mono text-[10px] text-stone-200 focus:border-amber-500/30 focus:outline-none"
                      />
                      <span className="font-mono text-[8px] uppercase tracking-widest text-stone-600">
                        s
                      </span>
                    </div>
                  </div>
                )}

                {/* Sub-info description */}
                {bellDef && (
                  <div className="text-[8px] tracking-wide text-stone-500 leading-normal border-t border-stone-900/40 pt-1.5 mt-0.5">
                    {bellDef.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Licensing attributions accordion-like footer */}
      <footer className="border-t border-stone-900 pt-2 flex items-center justify-between text-[8px] uppercase tracking-wider text-stone-600">
        <span className="flex items-center gap-1">
          <HelpCircle size={9} />
          All bells licensed under Creative Commons Zero (CC0) Original
          synthesis.
        </span>
      </footer>
    </div>
  );
}

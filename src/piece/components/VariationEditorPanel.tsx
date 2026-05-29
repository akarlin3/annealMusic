import React from 'react';
import type { Piece, PieceSegment, VariationPoint } from '@/piece/types';
import { Trash2, ShieldAlert, Sparkles, Sliders } from 'lucide-react';
import { CONTROL_DEFS } from '@/state/params';

interface VariationEditorPanelProps {
  piece: Piece;
  onUpdate: (updated: Piece) => void;
  onEditPoint: (
    point: VariationPoint,
    target: 'piece' | 'segment',
    segmentIndex?: number,
  ) => void;
}

export const VariationEditorPanel: React.FC<VariationEditorPanelProps> = ({
  piece,
  onUpdate,
  onEditPoint,
}) => {
  // Aggregate all variation points
  const piecePoints = piece.variations || [];
  const segmentPoints: {
    segmentIndex: number;
    segment: PieceSegment;
    point: VariationPoint;
  }[] = [];

  piece.segments.forEach((seg, idx) => {
    if (seg.variations) {
      seg.variations.forEach((vp) => {
        segmentPoints.push({
          segmentIndex: idx,
          segment: seg,
          point: vp,
        });
      });
    }
  });

  const totalPointsCount = piecePoints.length + segmentPoints.length;

  // Max-Variability Heuristic Guardrail calculation
  const calculateVariabilityFraction = (vp: VariationPoint): number => {
    const c = vp.constraint;
    if (c.type === 'range') {
      const def = CONTROL_DEFS.find((d) => d.key === vp.paramKey);
      if (def && c.min !== undefined && c.max !== undefined) {
        return (c.max - c.min) / (def.max - def.min);
      }
      return 0.25;
    } else if (c.type === 'enum') {
      return Math.min(0.3, (c.choices?.length || 1) * 0.08);
    } else if (c.type === 'relative') {
      return (c.percent ?? 15) / 100;
    } else if (c.type === 'correlated') {
      return 0.15; // standard minor variance contribution
    }
    return 0.2;
  };

  const totalVariability =
    piecePoints.reduce((sum, vp) => sum + calculateVariabilityFraction(vp), 0) +
    segmentPoints.reduce(
      (sum, item) => sum + calculateVariabilityFraction(item.point),
      0,
    );

  const coherenceIndex = Math.max(0.0, 1.0 - totalVariability);
  const isHighVariability = coherenceIndex < 0.6;

  // Deletion handlers
  const handleDeletePiecePoint = (id: string) => {
    const updated = {
      ...piece,
      variations: (piece.variations || []).filter((vp) => vp.id !== id),
    };
    onUpdate(updated);
  };

  const handleDeleteSegmentPoint = (segmentIndex: number, id: string) => {
    const updatedSegments = piece.segments.map((seg, idx) => {
      if (idx === segmentIndex) {
        return {
          ...seg,
          variations: (seg.variations || []).filter((vp) => vp.id !== id),
        };
      }
      return seg;
    });

    onUpdate({
      ...piece,
      segments: updatedSegments,
    });
  };

  if (totalPointsCount === 0) {
    return (
      <div className="bg-[#121016]/90 border border-white/5 p-6 rounded-3xl text-center space-y-3">
        <Sliders className="w-8 h-8 text-white/20 mx-auto" />
        <h4 className="text-sm font-bold text-white/80">
          No Variation Rules configured
        </h4>
        <p className="text-xs text-white/40 max-w-sm mx-auto">
          Hover over or right-click any parameter override slider in the segment
          panel below to configure a dynamic parameter wander.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#121016]/90 border border-white/5 p-6 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
      {/* Decorative accent background glows */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-[#eab308]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Panel header and variability bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-base font-extrabold uppercase tracking-wider text-white/90 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#eab308]" />
            Procedural Variation Space
          </h3>
          <p className="text-xs text-white/40">
            Procedural rules that dynamically modulate parameters each time the
            piece is played.
          </p>
        </div>

        {/* Guardrail visualization */}
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-2xl border border-white/5">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-white/40">Coherence Index:</span>
              <span
                className={`font-black ${
                  isHighVariability ? 'text-[#eab308]' : 'text-teal-400'
                }`}
              >
                {(coherenceIndex * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                style={{ width: `${coherenceIndex * 100}%` }}
                className={`h-full transition-all duration-300 ${
                  isHighVariability ? 'bg-[#eab308]' : 'bg-teal-400'
                }`}
              />
            </div>
          </div>
          {isHighVariability && (
            <div
              className="pl-2 border-l border-white/10 text-[#eab308]"
              title="High variability - piece identity may drift"
            >
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Warning alert if too variable */}
      {isHighVariability && (
        <div className="flex items-center gap-3 bg-[#eab308]/10 border border-[#eab308]/30 px-4 py-3 rounded-2xl text-xs text-[#eab308] animate-pulse">
          <ShieldAlert size={16} />
          <span>
            <strong>High variability:</strong> With a coherence score under 60%,
            plays may drift significantly from the baseline patch identity.
            Consider narrowing range limits.
          </span>
        </div>
      )}

      {/* List of active variation rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        {/* Piece-Level Variation Point Cards */}
        {piecePoints.map((vp) => {
          const def = CONTROL_DEFS.find((d) => d.key === vp.paramKey);
          const label = def?.label || vp.paramKey;

          return (
            <div
              key={vp.id}
              onClick={() => onEditPoint(vp, 'piece')}
              className="bg-white/5 border border-white/5 hover:border-[#eab308]/30 p-4 rounded-2xl cursor-pointer transition flex justify-between items-center group relative overflow-hidden"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20 px-2 py-0.5 rounded-md">
                    Piece-Level
                  </span>
                  <span className="text-xs font-bold text-white/90">
                    {label}
                  </span>
                </div>
                <p className="text-[11px] text-white/50">
                  {vp.constraint.type === 'range' &&
                    `Range: [${vp.constraint.min} .. ${vp.constraint.max}]`}
                  {vp.constraint.type === 'enum' &&
                    `Choices: ${vp.constraint.choices?.join(', ')}`}
                  {vp.constraint.type === 'relative' &&
                    `Deviates ±${vp.constraint.percent}%`}
                  {vp.constraint.type === 'correlated' &&
                    `Correlates with ${vp.constraint.targetParam} (coeff: ${vp.constraint.coefficient})`}
                </p>
                <p className="text-[9px] font-mono text-white/30 uppercase">
                  Regen: {vp.rule.replace('per-', '')}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePiecePoint(vp.id);
                }}
                className="p-2 text-white/35 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                title="Remove variation rule"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        {/* Segment-Level Variation Point Cards */}
        {segmentPoints.map(({ segmentIndex, segment, point: vp }) => {
          const def = CONTROL_DEFS.find((d) => d.key === vp.paramKey);
          const label = def?.label || vp.paramKey;

          return (
            <div
              key={vp.id}
              onClick={() => onEditPoint(vp, 'segment', segmentIndex)}
              className="bg-white/5 border border-white/5 hover:border-teal-500/30 p-4 rounded-2xl cursor-pointer transition flex justify-between items-center group relative overflow-hidden"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded-md">
                    Seg {segmentIndex + 1} ({segment.type})
                  </span>
                  <span className="text-xs font-bold text-white/90">
                    {label}
                  </span>
                </div>
                <p className="text-[11px] text-white/50">
                  {vp.constraint.type === 'range' &&
                    `Range: [${vp.constraint.min} .. ${vp.constraint.max}]`}
                  {vp.constraint.type === 'enum' &&
                    `Choices: ${vp.constraint.choices?.join(', ')}`}
                  {vp.constraint.type === 'relative' &&
                    `Deviates ±${vp.constraint.percent}%`}
                  {vp.constraint.type === 'correlated' &&
                    `Correlates with ${vp.constraint.targetParam} (coeff: ${vp.constraint.coefficient})`}
                </p>
                <p className="text-[9px] font-mono text-white/30 uppercase">
                  Regen: {vp.rule.replace('per-', '')}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSegmentPoint(segmentIndex, vp.id);
                }}
                className="p-2 text-white/35 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                title="Remove variation rule"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

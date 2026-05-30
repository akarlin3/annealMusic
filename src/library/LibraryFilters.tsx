import {
  LENGTH_CATEGORIES,
  INTENTIONS,
  CHARACTER_TAGS,
} from '@/library/taxonomy';
import type { LibraryFilters as Filters } from '@/library/api';

interface LibraryFiltersProps {
  filters: Filters;
  onChange: (next: Filters) => void;
}

type Axis = keyof Filters;

function Axis({
  label,
  items,
  selected,
  onPick,
}: {
  label: string;
  items: { id: string; label: string }[];
  selected: string | undefined;
  onPick: (id: string | undefined) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-600">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onPick(undefined)}
          className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
            !selected
              ? 'bg-amber-500/90 text-stone-950'
              : 'border border-stone-800 text-stone-400 hover:text-stone-200'
          }`}
        >
          All
        </button>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onPick(it.id)}
            className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              selected === it.id
                ? 'bg-amber-500/90 text-stone-950'
                : 'border border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LibraryFilters({
  filters,
  onChange,
}: LibraryFiltersProps) {
  const set = (axis: Axis, value: string | undefined) =>
    onChange({ ...filters, [axis]: value });

  return (
    <div className="space-y-5">
      <Axis
        label="Intention"
        items={INTENTIONS}
        selected={filters.intention}
        onPick={(v) => set('intention', v)}
      />
      <Axis
        label="Length"
        items={LENGTH_CATEGORIES}
        selected={filters.length}
        onPick={(v) => set('length', v)}
      />
      <Axis
        label="Character"
        items={CHARACTER_TAGS}
        selected={filters.character}
        onPick={(v) => set('character', v)}
      />
    </div>
  );
}

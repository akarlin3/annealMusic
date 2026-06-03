import type { GallerySort } from '@/gallery/types';

export interface FilterState {
  sort: GallerySort;
  engine: string;
  mode: string;
  hasCaptures: boolean;
  followedOnly?: boolean;
}

interface Props {
  value: FilterState;
  onChange: (next: FilterState) => void;
  showFollowedOnly: boolean;
}

const selectStyle: React.CSSProperties = {
  background: '#1c1917',
  border: '1px solid #44403c',
  color: '#e7e5e4',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
};

export default function GalleryFilters({
  value,
  onChange,
  showFollowedOnly,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Labeled label="Sort">
        <select
          aria-label="Sort"
          style={selectStyle}
          value={value.sort}
          onChange={(e) =>
            onChange({ ...value, sort: e.target.value as GallerySort })
          }
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="most_loaded">Most loaded</option>
          <option value="most_liked">Most liked</option>
        </select>
      </Labeled>

      <Labeled label="Engine">
        <select
          aria-label="Engine"
          style={selectStyle}
          value={value.engine}
          onChange={(e) => onChange({ ...value, engine: e.target.value })}
        >
          <option value="">Any</option>
          <option value="sine">Sine</option>
          <option value="fm">FM</option>
        </select>
      </Labeled>

      <Labeled label="Mode">
        <select
          aria-label="Mode"
          style={selectStyle}
          value={value.mode}
          onChange={(e) => onChange({ ...value, mode: e.target.value })}
        >
          <option value="">Any</option>
          <option value="open">Open</option>
          <option value="arc">Arc</option>
        </select>
      </Labeled>

      <label
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em]"
        style={{ color: '#a8a29e' }}
      >
        <input
          type="checkbox"
          checked={value.hasCaptures}
          onChange={(e) =>
            onChange({ ...value, hasCaptures: e.target.checked })
          }
        />
        Has captures
      </label>

      {showFollowedOnly && (
        <label
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] cursor-pointer"
          style={{ color: '#a8a29e' }}
        >
          <input
            type="checkbox"
            checked={value.followedOnly || false}
            onChange={(e) =>
              onChange({ ...value, followedOnly: e.target.checked })
            }
          />
          Followed only
        </label>
      )}
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ color: '#a8a29e' }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

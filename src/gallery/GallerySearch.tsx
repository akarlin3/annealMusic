import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

interface Props {
  value: string;
  onSearch: (q: string) => void;
  debounceMs?: number;
}

/** Debounced search input. Emits `onSearch` after the user stops typing. */
export default function GallerySearch({
  value,
  onSearch,
  debounceMs = 300,
}: Props) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onSearch(local), debounceMs);
    return () => clearTimeout(t);
  }, [local, value, onSearch, debounceMs]);

  return (
    <div
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
      style={{ background: '#1c1917', border: '1px solid #44403c' }}
    >
      <Search size={13} style={{ color: '#78716c' }} />
      <input
        aria-label="Search"
        placeholder="Search patches…"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="bg-transparent text-sm outline-none"
        style={{ color: '#e7e5e4', width: 200 }}
      />
    </div>
  );
}

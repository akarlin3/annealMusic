import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';

interface ToolbarDropdownProps {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export default function ToolbarDropdown({
  label,
  icon: Icon,
  children,
}: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full px-4 py-2.5 transition-all border border-[var(--color-border)] bg-[var(--color-surf)]/20 text-stone-300 hover:text-stone-150 hover:border-stone-700 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
      >
        <Icon size={13} strokeWidth={1.5} className="text-stone-400" />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
          {label}
        </span>
        <ChevronDown
          size={11}
          className={`transition-transform duration-200 ${
            open ? 'rotate-180 text-stone-200' : 'text-stone-500'
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-stone-800 bg-[#0c0a09]/95 p-2 shadow-2xl backdrop-blur-md transition-all duration-200 z-50 flex flex-col gap-1.5 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

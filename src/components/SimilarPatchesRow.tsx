import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '@/api/client';
import type { GalleryItem } from '@/gallery/types';
import GalleryCard from '@/gallery/GalleryCard';

interface SimilarPatchesRowProps {
  patchId: string;
  showToast: (msg: string) => void;
}

export default function SimilarPatchesRow({
  patchId,
  showToast,
}: SimilarPatchesRowProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    api
      .similarPatches(patchId)
      .then((res) => {
        if (active) {
          // Exclude the current patch just in case, and limit to 8 items
          const filtered = res.items
            .filter((item) => item.id !== patchId)
            .slice(0, 8);
          setItems(filtered);
        }
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [patchId]);

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-amber-500 animate-pulse" />
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-stone-500">
            Finding Similar Vibes...
          </h3>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="w-[320px] h-[300px] shrink-0 rounded-lg animate-pulse"
              style={{ background: '#0f0d0c', border: '1px solid #292524' }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-amber-500" />
          <h3
            className="font-mono text-[11px] uppercase tracking-[0.22em]"
            style={{ color: '#fef3c7' }}
          >
            Similar Vibes
          </h3>
        </div>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.15em]"
          style={{ color: '#78716c' }}
        >
          AI Semantic Match
        </span>
      </div>

      <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-thin snap-x">
        {items.map((item) => (
          <div key={item.id} className="w-[320px] shrink-0 snap-start">
            <GalleryCard
              item={item}
              playing={false}
              onTogglePreview={() => {
                showToast(`Press 'Load' to preview or tweak this patch`);
              }}
              onReport={() => {
                showToast(`Reported patch`);
              }}
              onEmbed={() => {
                showToast(`Copy embed code in gallery`);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

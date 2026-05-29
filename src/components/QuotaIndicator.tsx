import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { AIQuota } from '@/api/types';

export default function QuotaIndicator() {
  const [quota, setQuota] = useState<AIQuota | null>(null);

  useEffect(() => {
    let active = true;
    api
      .aiQuota()
      .then((q) => {
        if (active) setQuota(q);
      })
      .catch(() => {
        // Ignored
      });

    return () => {
      active = false;
    };
  }, []);

  if (!quota) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[9px] uppercase tracking-wider transition-all"
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        color: '#78716c',
      }}
    >
      <span>AI Quota:</span>
      <span className="text-amber-500/80">
        {quota.hour_used}/{quota.hour_limit} hr
      </span>
    </div>
  );
}

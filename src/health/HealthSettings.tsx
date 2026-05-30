import { useEffect, useState } from 'react';
import { healthApi, isIOS, isAndroid, isMobile } from '@/health/api';
import { api, getErrorMessage } from '@/api/client';
import { Heart, FileSpreadsheet } from 'lucide-react';

interface HealthSettingsProps {
  showToast: (text: string) => void;
}

export default function HealthSettings({ showToast }: HealthSettingsProps) {
  const [appleEnabled, setAppleEnabled] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [includeTimer, setIncludeTimer] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setAppleEnabled(healthApi.getAppleOptIn());
    setGoogleEnabled(healthApi.getGoogleOptIn());
    setIncludeTimer(healthApi.getIncludeTimer());
  }, []);

  const handleAppleToggle = async (checked: boolean) => {
    if (checked) {
      const granted = await healthApi.requestPermission();
      if (granted) {
        healthApi.setAppleOptIn(true);
        setAppleEnabled(true);
        showToast('Apple Health integration enabled');
      } else {
        showToast('HealthKit permission was denied');
        setAppleEnabled(false);
      }
    } else {
      healthApi.setAppleOptIn(false);
      setAppleEnabled(false);
      showToast('Apple Health integration disabled');
    }
  };

  const handleGoogleToggle = async (checked: boolean) => {
    if (checked) {
      const granted = await healthApi.requestPermission();
      if (granted) {
        healthApi.setGoogleOptIn(true);
        setGoogleEnabled(true);
        showToast('Google Health Connect enabled');
      } else {
        showToast('Health Connect permission was denied');
        setGoogleEnabled(false);
      }
    } else {
      healthApi.setGoogleOptIn(false);
      setGoogleEnabled(false);
      showToast('Google Health Connect disabled');
    }
  };

  const handleTimerToggle = (checked: boolean) => {
    healthApi.setIncludeTimer(checked);
    setIncludeTimer(checked);
    showToast(
      checked
        ? 'Stand-alone timer logs enabled'
        : 'Stand-alone timer logs disabled',
    );
  };

  const handleCsvExport = async () => {
    setExporting(true);
    try {
      if (!api.isBackendConfigured()) {
        showToast('Backend connection required for history export');
        return;
      }

      const response = await fetch(
        '/api/v1/listening-sessions/me/sessions/export',
        {
          headers: {
            'x-anon-id': localStorage.getItem('am_anon_id') || '',
          },
        },
      );

      if (!response.ok) {
        throw new Error('Export request failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'annealmusic_history_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast('History CSV exported successfully');
    } catch (err) {
      showToast('Export failed: ' + getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section
      className="rounded-xl p-6 border border-stone-850 space-y-6"
      style={{ background: '#141210', borderColor: '#292524' }}
    >
      <div className="flex items-center justify-between border-b border-stone-900 pb-3">
        <div className="flex items-center gap-2">
          <Heart size={14} className="text-red-500 animate-pulse" />
          <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
            Health & Integrations
          </h2>
        </div>
        <span className="text-[7.5px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Premium
        </span>
      </div>

      <div className="space-y-5">
        {/* iOS specific: Apple Health */}
        {isIOS() && (
          <label className="flex items-start gap-3.5 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                id="apple-health-sync"
                checked={appleEnabled}
                onChange={(e) => handleAppleToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-stone-900 rounded-full border border-stone-850 peer-checked:bg-amber-500 transition-all duration-300 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-500 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-stone-950 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-stone-950" />
            </div>
            <div>
              <span className="text-[10px] text-stone-300 font-semibold uppercase tracking-wider block transition-colors group-hover:text-amber-200">
                Sync Mindful Minutes with Apple Health
              </span>
              <span className="text-[9px] text-stone-500 leading-normal block mt-0.5">
                Automatically writes completed or partial listening sessions to
                the iOS Health app under Mindful Minutes.
              </span>
            </div>
          </label>
        )}

        {/* Android specific: Google Health Connect */}
        {isAndroid() && (
          <label className="flex items-start gap-3.5 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                id="google-health-sync"
                checked={googleEnabled}
                onChange={(e) => handleGoogleToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-stone-900 rounded-full border border-stone-850 peer-checked:bg-amber-500 transition-all duration-300 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-500 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-stone-950 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-stone-950" />
            </div>
            <div>
              <span className="text-[10px] text-stone-300 font-semibold uppercase tracking-wider block transition-colors group-hover:text-amber-200">
                Sync with Google Health Connect
              </span>
              <span className="text-[9px] text-stone-500 leading-normal block mt-0.5">
                Integrates with Android Health Connect to write your mindfulness
                sessions directly to your Google ecosystem activity.
              </span>
            </div>
          </label>
        )}

        {/* Stand-alone timer toggle */}
        {isMobile() && (
          <label className="flex items-start gap-3.5 cursor-pointer group border-t border-stone-900/60 pt-4">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                id="include-bell-timer"
                checked={includeTimer}
                onChange={(e) => handleTimerToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-stone-900 rounded-full border border-stone-850 peer-checked:bg-amber-500 transition-all duration-300 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-500 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-stone-950 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-stone-950" />
            </div>
            <div>
              <span className="text-[10px] text-stone-300 font-semibold uppercase tracking-wider block transition-colors group-hover:text-amber-200">
                Include Stand-alone Bell Timer Sessions
              </span>
              <span className="text-[9px] text-stone-500 leading-normal block mt-0.5">
                Include silent focus timer sessions punctuated by chimes in your
                synchronized mindful activity records.
              </span>
            </div>
          </label>
        )}

        {/* CSV Export for Web / general backup */}
        <div className="border-t border-stone-900 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-0.5">
            <span className="text-[10px] text-stone-300 font-semibold uppercase tracking-wider block">
              Export Session History
            </span>
            <span className="text-[9px] text-stone-500 leading-normal block">
              Download your complete played history, durations, and session tags
              as a standard CSV spreadsheet format.
            </span>
          </div>

          <button
            onClick={handleCsvExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded border border-stone-800 bg-stone-950/40 px-3.5 py-2 font-mono text-[9px] uppercase tracking-wider font-semibold text-stone-400 hover:text-white hover:border-stone-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 disabled:opacity-50"
          >
            <FileSpreadsheet size={12} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>
    </section>
  );
}

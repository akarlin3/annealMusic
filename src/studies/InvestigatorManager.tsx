import { useState } from 'react';
import { UserPlus, Trash2, ShieldCheck } from 'lucide-react';
import { studiesApi, ApiError } from './api';
import type { Investigator, InvestigatorRole, Study } from './types';

const ROLES: InvestigatorRole[] = [
  'pi',
  'co-investigator',
  'analyst',
  'viewer',
];

export function InvestigatorManager({
  study,
  onChange,
}: {
  study: Study;
  onChange: () => void;
}) {
  const isPi = study.my_role === 'pi';
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvestigatorRole>('viewer');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pis = study.investigators.filter((i) => i.role === 'pi').length;

  const add = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await studiesApi.addInvestigator(study.id, {
        account_email: email.trim().toLowerCase(),
        role,
      });
      setEmail('');
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'error');
    } finally {
      setBusy(false);
    }
  };

  const setInvRole = async (inv: Investigator, next: InvestigatorRole) => {
    setError(null);
    try {
      await studiesApi.changeRole(study.id, inv.account_id, next);
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'error');
    }
  };

  const remove = async (inv: Investigator) => {
    setError(null);
    try {
      await studiesApi.removeInvestigator(study.id, inv.account_id);
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'error');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-2">
        <ShieldCheck size={14} className="text-amber-500" />
        Investigators ({study.investigators.length})
      </span>

      <ul className="flex flex-col gap-1.5">
        {study.investigators.map((inv) => {
          const lastPi = inv.role === 'pi' && pis <= 1;
          return (
            <li
              key={inv.account_id}
              className="flex items-center justify-between gap-2 rounded-lg border border-stone-900 bg-stone-900/20 px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-xs font-mono text-stone-200">
                  {inv.display_name || inv.account_id.substring(0, 8)}
                </span>
                <span className="text-[10px] font-mono text-stone-500">
                  {inv.orcid ? `ORCID ${inv.orcid}` : 'no ORCID'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isPi ? (
                  <select
                    value={inv.role}
                    disabled={lastPi}
                    onChange={(e) =>
                      setInvRole(inv, e.target.value as InvestigatorRole)
                    }
                    title={lastPi ? 'A study must keep at least one PI' : ''}
                    className="bg-stone-900 border border-stone-800 rounded text-[10px] font-mono text-stone-300 px-1.5 py-1 disabled:opacity-40"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[10px] font-mono uppercase text-amber-400/80 px-2">
                    {inv.role}
                  </span>
                )}
                {isPi && (
                  <button
                    onClick={() => remove(inv)}
                    disabled={lastPi}
                    title={
                      lastPi ? 'A study must keep at least one PI' : 'Remove'
                    }
                    className="p-1 rounded text-stone-500 hover:text-rose-400 disabled:opacity-30"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isPi && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investigator email"
              className="flex-1 bg-stone-900 border border-stone-800 rounded px-2 py-1.5 text-[11px] font-mono text-stone-200 placeholder:text-stone-600"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as InvestigatorRole)}
              className="bg-stone-900 border border-stone-800 rounded text-[10px] font-mono text-stone-300 px-1.5"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              onClick={add}
              disabled={busy}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber-500 text-stone-950 text-[11px] font-mono font-semibold hover:bg-amber-400 disabled:opacity-40"
            >
              <UserPlus size={13} /> Add
            </button>
          </div>
          {error && (
            <span className="text-[10px] font-mono text-rose-400">
              {error === 'not_found'
                ? 'No account with that email.'
                : error === 'already_investigator'
                  ? 'Already an investigator.'
                  : error === 'last_pi'
                    ? 'A study must keep at least one PI.'
                    : `Error: ${error}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useJam } from './JamProvider';
import { LissajousAvatar } from '@/components/LissajousAvatar';
import InviteDialog from './InviteDialog';
import { Users, Link, Save, LogOut, ChevronDown } from 'lucide-react';
import { getAnonId } from '@/api/anon';
import type { JamParticipant } from '@/api/types';

export default function JamIndicator() {
  const jam = useJam();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!jam) return null;

  const { session, participants, status, mode, leaveJam, saveJamPatch } = jam;

  if (!session) return null;

  const myId = getAnonId();
  const activeParticipants = participants.filter(
    (p: JamParticipant) => !p.left_at,
  );

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#10b981'; // Green
      case 'connecting':
        return '#f59e0b'; // Amber
      default:
        return '#ef4444'; // Red
    }
  };

  const handleSavePatch = async () => {
    setSaving(true);
    try {
      const title = prompt(
        'Enter a title for this shared patch:',
        'Jam ' + new Date().toLocaleDateString(),
      );
      if (title === null) return; // cancelled

      const patch = await saveJamPatch({
        title: title.trim() || 'Collaborative Jam',
        description: `Created during a real-time collaborative jam session.`,
        visibility: 'unlisted',
      });
      if (patch) {
        alert(
          `Shared patch saved successfully!\nShort link: ${window.location.origin}/p/${patch.short_slug}`,
        );
      }
    } catch {
      alert('Failed to save shared patch. Make sure you are signed in.');
    } finally {
      setSaving(false);
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-full border shadow-2xl font-mono text-[10px] uppercase tracking-wider select-none bg-stone-950/70 border-stone-800 backdrop-blur-md">
      {/* Pulse connection indicator */}
      <span className="relative flex h-2 w-2">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ background: getStatusColor() }}
        />
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ background: getStatusColor() }}
        />
      </span>

      <span className="text-stone-400 font-semibold tracking-[0.18em]">
        Jam
      </span>

      <span className="w-px h-3 bg-stone-800" />

      {/* Participant avatars */}
      <div className="flex items-center -space-x-2">
        {activeParticipants.map((p: JamParticipant) => {
          const isSelf = p.user_id === myId;
          const tooltip = `${p.display_name}${isSelf ? ' (You)' : ''}`;
          const seed = p.avatar_seed || p.user_id;

          return (
            <div
              key={p.user_id}
              className="relative group flex items-center justify-center rounded-full"
              style={{
                outline: `2px solid ${p.color}`,
                outlineOffset: '1px',
                zIndex: isSelf ? 2 : 1,
              }}
              title={tooltip}
            >
              <LissajousAvatar seed={seed} size={20} />

              {/* Tooltip */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-900 border border-stone-800 text-stone-200 px-2 py-1 rounded text-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {tooltip}
              </div>
            </div>
          );
        })}
      </div>

      <span className="w-px h-3 bg-stone-800" />

      {/* Transport mode tag */}
      <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[8px] text-stone-500 font-medium">
        {mode === 'webrtc'
          ? 'P2P Link'
          : mode === 'websocket'
            ? 'Relayed'
            : 'Connecting'}
      </span>

      <button
        type="button"
        onClick={() => setIsInviteOpen(true)}
        className="px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-colors bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-stone-100 border border-stone-800"
      >
        <Users size={10} />
        Invite
      </button>

      <span className="w-px h-3 bg-stone-800" />

      {/* Action dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="p-1 rounded-full text-stone-500 hover:text-stone-300 hover:bg-stone-900 transition-colors"
          aria-label="Collaboration options"
        >
          <ChevronDown size={14} />
        </button>

        {isDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />
            <div
              className="absolute right-0 mt-2 w-44 rounded-xl border p-1 shadow-2xl z-50 flex flex-col gap-0.5 bg-stone-950/90 border-stone-800 backdrop-blur-md"
              style={{
                boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsInviteOpen(true);
                  setIsDropdownOpen(false);
                }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-stone-300 hover:text-white hover:bg-stone-900 transition-colors"
              >
                <Link size={11} />
                <span>Invite Link</span>
              </button>

              <button
                type="button"
                onClick={handleSavePatch}
                disabled={saving}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-stone-300 hover:text-white hover:bg-stone-900 transition-colors disabled:opacity-50"
              >
                <Save size={11} />
                <span>{saving ? 'Saving...' : 'Save Shared Patch'}</span>
              </button>

              <div className="h-px bg-stone-800 my-1 mx-2" />

              <button
                type="button"
                onClick={() => {
                  leaveJam();
                  setIsDropdownOpen(false);
                }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors"
              >
                <LogOut size={11} />
                <span>End Jam</span>
              </button>
            </div>
          </>
        )}
      </div>

      <InviteDialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        sessionId={session.id}
      />
    </div>
  );
}

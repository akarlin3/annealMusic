import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import JamIndicator from './JamIndicator';
import InviteDialog from './InviteDialog';
import ParticipantCursor from './ParticipantCursor';
import { useJam } from './JamProvider';
import type { JamSession } from '@/api/types';

vi.mock('./JamProvider', () => ({
  useJam: vi.fn(),
}));

vi.mock('@/api/anon', () => ({
  getAnonId: () => 'user-1',
}));

vi.mock('@/components/LissajousAvatar', () => ({
  LissajousAvatar: () => <div data-testid="avatar">Avatar</div>,
}));

import { beforeAll } from 'vitest';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Jam Session UI Components', () => {
  describe('JamIndicator', () => {
    it('renders nothing when session is null', () => {
      vi.mocked(useJam).mockReturnValue({
        session: null,
        participants: [],
        status: 'disconnected',
        mode: 'none',
        myColor: null,
        activeCursors: {},
        startJam: vi.fn(),
        joinJam: vi.fn(),
        leaveJam: vi.fn(),
        updateCursorPresence: vi.fn(),
        clearCursorPresence: vi.fn(),
        saveJamPatch: vi.fn(),
      });

      const { container } = render(<JamIndicator />);
      expect(container.firstChild).toBeNull();
    });

    it('renders participants, connection status, and options when session is active', () => {
      const leaveJam = vi.fn();
      vi.mocked(useJam).mockReturnValue({
        session: {
          id: 'session-123',
          host_id: 'user-1',
          created_at: '2026-05-29',
        } as unknown as JamSession,
        participants: [
          {
            user_id: 'user-1',
            display_name: 'Avery',
            color: '#ff0000',
            joined_at: '2026-05-29',
            left_at: null,
            avatar_seed: 'seed-1',
          },
          {
            user_id: 'user-2',
            display_name: 'Collab Partner',
            color: '#00ff00',
            joined_at: '2026-05-29',
            left_at: null,
            avatar_seed: 'seed-2',
          },
        ],
        status: 'connected',
        mode: 'webrtc',
        myColor: '#ff0000',
        activeCursors: {},
        startJam: vi.fn(),
        joinJam: vi.fn(),
        leaveJam,
        updateCursorPresence: vi.fn(),
        clearCursorPresence: vi.fn(),
        saveJamPatch: vi.fn(),
      });

      render(<JamIndicator />);

      expect(screen.getByText('Jam')).toBeInTheDocument();
      expect(screen.getByText('P2P Link')).toBeInTheDocument();
      expect(screen.getByText('Invite')).toBeInTheDocument();

      // Trigger active option dropdown
      const dropdownBtn = screen.getByRole('button', {
        name: /collaboration options/i,
      });
      fireEvent.click(dropdownBtn);

      expect(screen.getAllByText('Invite Link')[0]).toBeInTheDocument();
      expect(screen.getByText('Save Shared Patch')).toBeInTheDocument();
      expect(screen.getByText('End Jam')).toBeInTheDocument();

      // Test leave jam
      fireEvent.click(screen.getByText('End Jam'));
      expect(leaveJam).toHaveBeenCalled();
    });
  });

  describe('InviteDialog', () => {
    it('renders QR code and link when open', async () => {
      const onClose = vi.fn();
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });

      render(
        <InviteDialog
          isOpen={true}
          onClose={onClose}
          sessionId="session-123"
        />,
      );

      expect(screen.getByText('Invite Collaborator')).toBeInTheDocument();
      expect(screen.getByTitle('Copy Link')).toBeInTheDocument();

      // Test copying link
      await act(async () => {
        fireEvent.click(screen.getByTitle('Copy Link'));
      });

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('/jam/session-123'),
      );
    });
  });

  describe('ParticipantCursor', () => {
    it('renders glowing borders and custom CSS styles for remote cursors', () => {
      vi.mocked(useJam).mockReturnValue({
        session: { id: 'session-123' } as unknown as JamSession,
        participants: [],
        status: 'connected',
        mode: 'webrtc',
        myColor: '#ff0000',
        activeCursors: {
          'user-2': {
            paramKey: 'cutoff',
            color: '#00ff00',
            name: 'Partner',
            ts: Date.now(),
          },
        },
        startJam: vi.fn(),
        joinJam: vi.fn(),
        leaveJam: vi.fn(),
        updateCursorPresence: vi.fn(),
        clearCursorPresence: vi.fn(),
        saveJamPatch: vi.fn(),
      });

      const { container } = render(<ParticipantCursor />);
      expect(container.querySelector('style')).toBeInTheDocument();
      expect(container.querySelector('style')?.innerHTML).toContain(
        'div[data-tour="cutoff"]',
      );
      expect(container.querySelector('style')?.innerHTML).toContain('Partner');
      expect(container.querySelector('style')?.innerHTML).toContain('#00ff00');
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SessionHistoryPage from '@/history/SessionHistoryPage';
import { api } from '@/api/client';
import type { SessionPlay, SessionStats } from '@/api/types';

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ isAuthenticated: true, account: { id: 'a' } }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function play(over: Partial<SessionPlay> = {}): SessionPlay {
  return {
    id: 'p1',
    listening_session_id: 'ls1',
    started_at: '2026-05-30T10:00:00Z',
    completed_at: '2026-05-30T10:21:00Z',
    duration_listened_ms: 21 * 60000,
    reflection: null,
    created_at: '2026-05-30T10:00:00Z',
    session_title: 'Evening Settle',
    session_slug: 'evenslug',
    session_length_category: 'short',
    ...over,
  };
}

const stats: SessionStats = {
  total_sessions: 12,
  total_listened_ms: 15_480_000,
  average_length_ms: 1_290_000,
  this_month_sessions: 12,
  this_month_listened_ms: 15_480_000,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/me/sessions']}>
      <Routes>
        <Route path="/me/sessions" element={<SessionHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SessionHistoryPage', () => {
  it('renders entries and calm, understated stats', async () => {
    vi.spyOn(api, 'listSessionPlays').mockResolvedValue({
      items: [play()],
      next_cursor: null,
    });
    vi.spyOn(api, 'sessionStats').mockResolvedValue(stats);

    renderPage();

    await waitFor(() => screen.getByText('Evening Settle'));
    // Descriptive monthly framing, not a streak/goal.
    expect(screen.getByText(/12 sessions/)).toBeTruthy();
    expect(screen.getByText(/total this month/)).toBeTruthy();
    expect(screen.getByText(/Listened 21 min/)).toBeTruthy();
    // No engagement-loop language anywhere on the page.
    const body = document.body.textContent ?? '';
    for (const banned of [
      'streak',
      'level up',
      'achievement',
      'daily goal',
      'badge',
    ]) {
      expect(body.toLowerCase()).not.toContain(banned);
    }
  });

  it('forgets a session and refreshes stats', async () => {
    vi.spyOn(api, 'listSessionPlays').mockResolvedValue({
      items: [play()],
      next_cursor: null,
    });
    const statsSpy = vi.spyOn(api, 'sessionStats').mockResolvedValue(stats);
    const forgetSpy = vi.spyOn(api, 'forgetSessionPlay').mockResolvedValue();

    renderPage();
    await waitFor(() => screen.getByText('Evening Settle'));

    fireEvent.click(screen.getByTitle('Forget this session'));

    await waitFor(() =>
      expect(screen.queryByText('Evening Settle')).toBeNull(),
    );
    expect(forgetSpy).toHaveBeenCalledWith('p1');
    expect(statsSpy).toHaveBeenCalledTimes(2); // initial load + post-forget refresh
  });

  it('saves a reflection through the editor', async () => {
    vi.spyOn(api, 'listSessionPlays').mockResolvedValue({
      items: [play()],
      next_cursor: null,
    });
    vi.spyOn(api, 'sessionStats').mockResolvedValue(stats);
    const updateSpy = vi
      .spyOn(api, 'updateSessionPlay')
      .mockResolvedValue(play({ reflection: 'Felt calm.' }));

    renderPage();
    await waitFor(() => screen.getByText('Evening Settle'));

    fireEvent.click(screen.getByText('Add a reflection'));
    fireEvent.change(screen.getByPlaceholderText(/few words/i), {
      target: { value: 'Felt calm.' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('p1', {
        reflection: 'Felt calm.',
      }),
    );
  });
});

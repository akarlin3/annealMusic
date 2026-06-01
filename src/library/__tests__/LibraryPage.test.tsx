import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LibraryPage from '@/library/LibraryPage';
import { api } from '@/api/client';
import type { LibraryListing } from '@/api/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function listing(over: Partial<LibraryListing> = {}): LibraryListing {
  return {
    id: 'l1',
    listening_session_id: 'ls1',
    intention: 'evening',
    length_category: 'short',
    character_tags: ['composed'],
    editor_pick: false,
    editor_pick_at: null,
    curator_note: 'A gentle wind-down.',
    added_at: '2026-05-30T10:00:00Z',
    archived_at: null,
    session_title: 'Evening Settle',
    session_slug: 'evenslug',
    total_duration_ms: 600000,
    preview_status: 'ready',
    preview_url: '/api/v1/pieces/abc/preview',
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/listen']}>
      <Routes>
        <Route path="/listen" element={<LibraryPage />} />
        <Route path="/listening/:slug" element={<div>Listener</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LibraryPage', () => {
  it('renders cards and an editor-picks strip', async () => {
    vi.spyOn(api, 'isBackendConfigured').mockReturnValue(true);
    vi.spyOn(api, 'getLibrary').mockResolvedValue({ items: [listing()] });
    vi.spyOn(api, 'getLibraryPicks').mockResolvedValue({
      items: [
        listing({ id: 'pk', editor_pick: true, session_title: 'Pick One' }),
      ],
    });

    renderPage();

    await waitFor(() => screen.getByText('Pick One'));
    expect(screen.getByText("Editor's recent picks")).toBeTruthy();
    expect(screen.getAllByText('Evening Settle').length).toBeGreaterThan(0);
    // A "Listen" load link points at the source session.
    expect(screen.getAllByText('Listen').length).toBeGreaterThan(0);
  });

  it('refetches when a filter is chosen', async () => {
    vi.spyOn(api, 'isBackendConfigured').mockReturnValue(true);
    vi.spyOn(api, 'getLibraryPicks').mockResolvedValue({ items: [] });
    const listSpy = vi
      .spyOn(api, 'getLibrary')
      .mockResolvedValue({ items: [listing()] });

    renderPage();
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Morning'));
    await waitFor(() =>
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ intention: 'morning' }),
      ),
    );
  });

  it('renders offline local listings when backend is not configured', async () => {
    vi.spyOn(api, 'isBackendConfigured').mockReturnValue(false);

    renderPage();

    await waitFor(() =>
      expect(screen.getAllByText('Cosmic Hum').length).toBeGreaterThan(0),
    );
    expect(screen.getByText("Editor's recent picks")).toBeTruthy();
    expect(screen.getAllByText('Tibetan Bowls').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Autumn Rain').length).toBeGreaterThan(0);
  });
});

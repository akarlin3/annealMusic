import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GalleryPage from '@/gallery/GalleryPage';
import { galleryApi } from '@/gallery/api';
import type { GalleryItem } from '@/gallery/types';

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    account: null,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function item(overrides: Partial<GalleryItem>): GalleryItem {
  return {
    id: 'id-1',
    short_slug: 'slug1234',
    title: 'Calm ocean',
    description: 'a gentle drift',
    state: 'm=open&e=sine&rootFreq=110',
    engine: 'sine',
    mode: 'open',
    has_captures: false,
    load_count: 3,
    published_at: new Date().toISOString(),
    preview_status: 'ready',
    preview_duration_ms: 20000,
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gallery" element={<GalleryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GalleryPage', () => {
  it('renders cards from the gallery API', async () => {
    vi.spyOn(galleryApi, 'list').mockResolvedValue({
      items: [item({ title: 'Calm ocean' })],
      next_cursor: null,
    });
    renderAt('/gallery');
    expect(await screen.findByText('Calm ocean')).toBeInTheDocument();
    expect(screen.getByText(/3 loads/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no results', async () => {
    vi.spyOn(galleryApi, 'list').mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    renderAt('/gallery');
    expect(await screen.findByText('No patches match.')).toBeInTheDocument();
  });

  it('shows a graceful error when the backend is offline', async () => {
    vi.spyOn(galleryApi, 'list').mockRejectedValue(new Error('offline'));
    renderAt('/gallery');
    await waitFor(() =>
      expect(
        screen.getByText(/Couldn't reach the gallery/),
      ).toBeInTheDocument(),
    );
  });
});

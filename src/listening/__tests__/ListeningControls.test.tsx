/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import ListeningControls from '../ListeningControls';
import { api } from '@/api/client';

afterEach(cleanup);

vi.mock('@/api/client', () => ({
  api: {
    isBackendConfigured: () => true,
    myPieces: vi.fn(),
    myPatches: vi.fn(),
    createListeningSession: vi.fn(),
  },
  getErrorMessage: (err: any) => err.message || 'error',
}));

describe('ListeningControls with Drone Mode support', () => {
  const mockPieces = [
    { id: 'piece-1', title: 'Serene Meadow', visibility: 'unlisted' },
    { id: 'piece-2', title: 'Mountain Wind', visibility: 'unlisted' },
  ];

  const mockPatches = [
    {
      id: 'drone-1',
      title: 'Ocean Drone',
      mode: 'drone',
      visibility: 'unlisted',
    },
    {
      id: 'sketch-1',
      title: 'Synth Lead',
      mode: 'sketch',
      visibility: 'unlisted',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.myPieces).mockResolvedValue({
      items: mockPieces,
      next_cursor: null,
    } as any);
    vi.mocked(api.myPatches).mockResolvedValue({
      items: mockPatches,
      next_cursor: null,
    } as any);
  });

  it('fetches and merges both Composed Pieces and Saved Drones into the selector', async () => {
    render(<ListeningControls onSessionCreated={() => {}} />);

    await waitFor(() => {
      expect(api.myPieces).toHaveBeenCalled();
      expect(api.myPatches).toHaveBeenCalled();
    });

    // Check that we render options for pieces and only drone patches (excluding sketch patches)
    await waitFor(() => {
      const piece1Opt = screen.queryByRole('option', { name: 'Serene Meadow' });
      const piece2Opt = screen.queryByRole('option', { name: 'Mountain Wind' });
      const droneOpt = screen.queryByRole('option', { name: 'Ocean Drone' });
      const sketchOpt = screen.queryByRole('option', { name: 'Synth Lead' });

      expect(piece1Opt).toBeInTheDocument();
      expect(piece2Opt).toBeInTheDocument();
      expect(droneOpt).toBeInTheDocument();
      expect(sketchOpt).not.toBeInTheDocument();
    });
  });

  it('correctly creates a Listening Session with piece_id when a Piece is selected', async () => {
    const onSessionCreated = vi.fn();
    vi.mocked(api.createListeningSession).mockResolvedValue({
      id: 'sess-1',
    } as any);

    render(<ListeningControls onSessionCreated={onSessionCreated} />);

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Serene Meadow' }),
      ).toBeInTheDocument();
    });

    // Select piece-2
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'piece:piece-2' } });

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create session/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createListeningSession).toHaveBeenCalledWith(
        expect.objectContaining({
          piece_id: 'piece-2',
          patch_id: undefined,
          title: 'Mountain Wind Session',
        }),
      );
      expect(onSessionCreated).toHaveBeenCalledWith({ id: 'sess-1' });
    });
  });

  it('correctly creates a Listening Session with patch_id when a Drone is selected', async () => {
    const onSessionCreated = vi.fn();
    vi.mocked(api.createListeningSession).mockResolvedValue({
      id: 'sess-2',
    } as any);

    render(<ListeningControls onSessionCreated={onSessionCreated} />);

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Ocean Drone' }),
      ).toBeInTheDocument();
    });

    // Select drone-1
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'drone:drone-1' } });

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create session/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createListeningSession).toHaveBeenCalledWith(
        expect.objectContaining({
          piece_id: undefined,
          patch_id: 'drone-1',
          title: 'Ocean Drone Session',
        }),
      );
      expect(onSessionCreated).toHaveBeenCalledWith({ id: 'sess-2' });
    });
  });
});

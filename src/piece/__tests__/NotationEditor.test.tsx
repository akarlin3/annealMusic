import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NotationEditor } from '@/piece/components/NotationEditor';
import { DEFAULT_PARAMS } from '@/state/params';
import type { Piece } from '@/piece/types';

vi.mock('@tonejs/midi', () => {
  return {
    Midi: vi.fn().mockImplementation(() => {
      return {
        header: {
          tempos: [{ bpm: 120 }],
          setTempo: vi.fn(),
        },
        addTrack: vi.fn().mockReturnValue({
          name: 'Notation Track',
          addNote: vi.fn(),
        }),
        tracks: [
          {
            name: 'Track 1',
            notes: [
              { time: 0, duration: 1, midi: 60 },
              { time: 1.5, duration: 0.5, midi: 62 },
            ],
          },
        ],
        toArray: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      };
    }),
  };
});

afterEach(cleanup);

const mockPiece: Piece = {
  schemaVer: 10,
  tempoBpm: 120,
  title: 'Melodic Composition',
  description: 'Test composition',
  visibility: 'unlisted',
  totalDurationMs: 10000,
  hasOpenSegment: false,
  defaultsState: {
    params: DEFAULT_PARAMS,
    engineId: 'sine',
    engineParams: {},
  },
  segments: [{ position: 0, type: 'fixed', durationMs: 10000, config: {} }],
  notation: [
    { id: 'note-a', onset_ms: 1000, duration_ms: 1000, pitch_midi: 60 },
    { id: 'note-b', onset_ms: 3000, duration_ms: 2000, pitch_midi: 64 },
  ],
};

describe('NotationEditor', () => {
  it('renders the note count and note blocks correctly', () => {
    const onChange = vi.fn();
    render(
      <NotationEditor
        piece={mockPiece}
        onChange={onChange}
        isPlaying={false}
        globalPlayheadMs={0}
      />,
    );

    // Verify footer note counter
    expect(screen.getByText(/2 monophonic notes/)).toBeInTheDocument();

    // Verify note names are rendered on the grid (C4 and E4)
    expect(screen.getAllByText('C4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('E4').length).toBeGreaterThan(0);
  });

  it('toggles the help instructions panel when help button clicked', () => {
    render(
      <NotationEditor
        piece={mockPiece}
        onChange={vi.fn()}
        isPlaying={false}
        globalPlayheadMs={0}
      />,
    );

    // Initial state: help is hidden
    expect(screen.queryByText(/Piano-Roll Interactions:/)).toBeNull();

    // Click the help button uniquely
    const helpButton = screen.getByRole('button', { name: 'Toggle Help' });
    fireEvent.click(helpButton);

    // Help panel should be visible
    expect(screen.getByText(/Piano-Roll Interactions:/)).toBeInTheDocument();
    expect(screen.getByText(/Add Note:/)).toBeInTheDocument();

    // Click it again to close
    fireEvent.click(helpButton);
    expect(screen.queryByText(/Piano-Roll Interactions:/)).toBeNull();
  });

  it('toggles the smooth glide pitch transition mode', () => {
    render(
      <NotationEditor
        piece={mockPiece}
        onChange={vi.fn()}
        isPlaying={false}
        globalPlayheadMs={0}
      />,
    );

    const smoothButton = screen.getByText('Smooth Ramps (Glide)');
    expect(smoothButton).toBeInTheDocument();

    // Click to toggle to instant
    fireEvent.click(smoothButton);
    expect(screen.getByText('Instant Changes')).toBeInTheDocument();

    // Toggle back
    fireEvent.click(screen.getByText('Instant Changes'));
    expect(screen.getByText('Smooth Ramps (Glide)')).toBeInTheDocument();
  });

  it('renders MIDI import and export buttons', () => {
    // Mock URL and document functions for export
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url');
    global.URL.createObjectURL = createObjectURLSpy;
    global.URL.revokeObjectURL = vi.fn();

    render(
      <NotationEditor
        piece={mockPiece}
        onChange={vi.fn()}
        isPlaying={false}
        globalPlayheadMs={0}
      />,
    );

    // Verify MIDI buttons are rendered
    const importBtn = screen.getByRole('button', { name: /Import MIDI/i });
    const exportBtn = screen.getByRole('button', { name: /Export MIDI/i });
    expect(importBtn).toBeInTheDocument();
    expect(exportBtn).toBeInTheDocument();

    // Click export button to verify it runs without crashing
    fireEvent.click(exportBtn);
    expect(createObjectURLSpy).toHaveBeenCalled();
  });
});

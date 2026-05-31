import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { NextLessonPicker } from '../recommend/NextLessonPicker';
import type { Track } from '../LearnApp';
import { useMode } from '@/mode/useMode';

vi.mock('@/mode/useMode', () => ({
  useMode: vi.fn(),
}));

const TRACKS: Track[] = [
  {
    id: 't1',
    slug: 'synthesis-fundamentals',
    title: 'Synthesis Fundamentals',
    description: 'Engines',
    position: 0,
    color: '#f59e0b',
    lessons: [
      {
        id: 'l1',
        track_id: 't1',
        slug: 'sine',
        title: 'The Sine Engine',
        description: '',
        difficulty: 'intro',
        estimated_minutes: 8,
        position: 0,
        prerequisites: [],
        steps: [],
        modes: [],
        onboarding_mode: null,
      },
    ],
  },
];

function mockRecsOnce(body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200 }),
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  (useMode as any).mockReturnValue({
    mode: 'musician',
    loading: false,
    setMode: vi.fn(),
    showPicker: false,
    setShowPicker: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('NextLessonPicker', () => {
  it('renders 1–3 cards with a one-sentence rationale and an escape hatch', async () => {
    mockRecsOnce({
      source: 'llm',
      items: [
        {
          lesson_id: 'l2',
          slug: 'fm',
          title: 'FM Ratios',
          difficulty: 'intro',
          track_slug: 'synthesis-fundamentals',
          rationale: 'Builds directly on the sine engine.',
        },
      ],
    });
    const onPick = vi.fn();
    render(
      <NextLessonPicker
        apiBase=""
        authenticated
        context="completion"
        justCompletedLessonId="l1"
        tracks={TRACKS}
        onPick={onPick}
      />,
    );

    expect(await screen.findByText('FM Ratios')).toBeInTheDocument();
    expect(
      screen.getByText('Builds directly on the sine engine.'),
    ).toBeInTheDocument();
    // Always offers a browse escape — never a funnel.
    expect(screen.getByText(/browse all lessons/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('FM Ratios'));
    expect(onPick).toHaveBeenCalledWith('synthesis-fundamentals', 'fm');
  });

  it('shows track chips for the onboarding source', async () => {
    mockRecsOnce({
      source: 'onboarding',
      items: [
        {
          lesson_id: 'l1',
          slug: 'sine',
          title: 'The Sine Engine',
          difficulty: 'intro',
          track_slug: 'synthesis-fundamentals',
          rationale: 'A gentle way in.',
        },
      ],
    });
    const onPick = vi.fn();
    render(
      <NextLessonPicker
        apiBase=""
        authenticated
        context="arrival"
        justCompletedLessonId={null}
        tracks={TRACKS}
        onPick={onPick}
      />,
    );
    expect(
      await screen.findByText('A gentle place to begin'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Synthesis Fundamentals'));
    expect(onPick).toHaveBeenCalledWith('synthesis-fundamentals', 'sine');
  });

  it('renders nothing when there is nothing to recommend', async () => {
    mockRecsOnce({ source: 'empty', items: [] });
    const { container } = render(
      <NextLessonPicker
        apiBase=""
        authenticated
        context="arrival"
        justCompletedLessonId={null}
        tracks={TRACKS}
        onPick={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector('.picker-cards')).toBeNull();
    });
  });

  it('can be dismissed', async () => {
    mockRecsOnce({
      source: 'llm',
      items: [
        {
          lesson_id: 'l2',
          slug: 'fm',
          title: 'FM Ratios',
          difficulty: 'intro',
          track_slug: 'synthesis-fundamentals',
          rationale: 'Next.',
        },
      ],
    });
    render(
      <NextLessonPicker
        apiBase=""
        authenticated
        context="completion"
        justCompletedLessonId="l1"
        tracks={TRACKS}
        onPick={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByText('Dismiss'));
    expect(screen.queryByText('FM Ratios')).toBeNull();
  });

  it('renders cross-mode relevance badge if lesson modes mismatch active mode', async () => {
    (useMode as any).mockReturnValue({
      mode: 'meditation',
      loading: false,
      setMode: vi.fn(),
      showPicker: false,
      setShowPicker: vi.fn(),
    });

    const crossModeTracks: Track[] = [
      {
        id: 't1',
        slug: 'synthesis-fundamentals',
        title: 'Synthesis Fundamentals',
        description: 'Engines',
        position: 0,
        color: '#f59e0b',
        lessons: [
          {
            id: 'l2',
            track_id: 't1',
            slug: 'fm',
            title: 'FM Ratios',
            description: '',
            difficulty: 'intro',
            estimated_minutes: 8,
            position: 0,
            prerequisites: [],
            steps: [],
            modes: ['musician'],
            onboarding_mode: null,
          },
        ],
      },
    ];

    mockRecsOnce({
      source: 'llm',
      items: [
        {
          lesson_id: 'l2',
          slug: 'fm',
          title: 'FM Ratios',
          difficulty: 'intro',
          track_slug: 'synthesis-fundamentals',
          rationale: 'Deepen your acoustic intuition.',
        },
      ],
    });

    render(
      <NextLessonPicker
        apiBase=""
        authenticated
        context="completion"
        justCompletedLessonId="l1"
        tracks={crossModeTracks}
        onPick={vi.fn()}
      />,
    );

    expect(await screen.findByText('FM Ratios')).toBeInTheDocument();
    expect(
      screen.getByText('This lesson is also relevant to Musician mode'),
    ).toBeInTheDocument();
  });
});

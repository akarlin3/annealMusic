import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { LearnApp } from '../LearnApp';
import { useMode } from '@/mode/useMode';

vi.mock('@/mode/useMode', () => ({
  useMode: vi.fn(),
}));

const TRACKS = [
  {
    id: 't1',
    slug: 'synthesis-fundamentals',
    title: 'Synthesis Fundamentals',
    description: 'Learn phase coupling',
    position: 0,
    color: '#818cf8',
    lessons: [
      {
        id: 'l1',
        track_id: 't1',
        slug: 'sine',
        title: 'The Sine Engine',
        description: 'Bells and glass',
        difficulty: 'intro',
        estimated_minutes: 8,
        position: 0,
        prerequisites: [],
        steps: [],
        modes: ['musician', 'meditation'],
        onboarding_mode: null,
      },
      {
        id: 'l2',
        track_id: 't1',
        slug: 'fm-ratio',
        title: 'FM Ratios',
        description: 'Frequency modulation basics',
        difficulty: 'intermediate',
        estimated_minutes: 10,
        position: 1,
        prerequisites: ['l1'],
        steps: [],
        modes: ['musician'],
        onboarding_mode: null,
      },
    ],
  },
];

const ONBOARDING_LESSON = {
  id: 'onboarding-musician',
  track_id: 'onboarding-track',
  slug: 'onboarding-musician',
  title: 'Musician Mode Onboarding',
  description: 'Welcome to Musician Sandbox',
  difficulty: 'intro',
  estimated_minutes: 3,
  position: 0,
  prerequisites: [],
  steps: [
    {
      id: 'step1',
      lesson_id: 'onboarding-musician',
      position: 0,
      type: 'text',
      config: { title: 'Welcome', body: 'Let us start your journey.' },
    },
  ],
  modes: ['musician'],
  onboarding_mode: 'musician',
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // Default useMode mock
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

describe('LearnApp - Onboarding & Mode-Filtered Curriculum', () => {
  it('correctly filters lessons by active mode, and handles Show All toggle', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/v1/tracks')) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: TRACKS }), { status: 200 }),
        );
      }
      if (url.toString().includes('/api/v1/onboarding/')) {
        return Promise.resolve(
          new Response(JSON.stringify(ONBOARDING_LESSON), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });

    // Mark onboarding as dismissed so it doesn't auto-play
    localStorage.setItem('anneal_onboarding_dismissed_musician', 'true');

    render(<LearnApp />);

    // Wait for the tracks to load and verify "The Sine Engine" is visible
    expect(await screen.findByText('The Sine Engine')).toBeInTheDocument();
    expect(screen.getByText('FM Ratios')).toBeInTheDocument();

    // Now switch mode to 'meditation'
    cleanup();
    (useMode as any).mockReturnValue({
      mode: 'meditation',
      loading: false,
    });
    localStorage.setItem('anneal_onboarding_dismissed_meditation', 'true');

    render(<LearnApp />);
    expect(await screen.findByText('The Sine Engine')).toBeInTheDocument();
    // 'FM Ratios' is ONLY tagged for 'musician', so it should be filtered out
    expect(screen.queryByText('FM Ratios')).toBeNull();

    // Now click the "Show All Lessons" button
    const showAllBtn = screen.getByRole('button', {
      name: /Show All Lessons/i,
    });
    fireEvent.click(showAllBtn);

    // Verify "FM Ratios" is now visible in Meditation mode under the Show All override
    expect(screen.getByText('FM Ratios')).toBeInTheDocument();
  });

  it('automatically triggers the mode onboarding lesson on first visit', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/v1/tracks')) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: TRACKS }), { status: 200 }),
        );
      }
      if (urlStr.includes('/api/v1/onboarding/musician')) {
        return Promise.resolve(
          new Response(JSON.stringify(ONBOARDING_LESSON), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });

    // Explicitly make sure onboarding is NOT marked dismissed
    localStorage.removeItem('anneal_onboarding_dismissed_musician');

    render(<LearnApp />);

    // Verify onboarding is fetched and auto-played
    expect(
      await screen.findByText('Musician Mode Onboarding'),
    ).toBeInTheDocument();
    expect(screen.getByText('Skip Intro')).toBeInTheDocument();

    // Click "Skip Intro" to dismiss it
    fireEvent.click(screen.getByText('Skip Intro'));

    // Verify it returned to the standard curriculum browser
    expect(await screen.findByText('The Sine Engine')).toBeInTheDocument();
    expect(localStorage.getItem('anneal_onboarding_dismissed_musician')).toBe(
      'true',
    );
  });
});

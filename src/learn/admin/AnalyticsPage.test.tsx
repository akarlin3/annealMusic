import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';

const lessons = {
  items: [
    {
      lesson_id: 'L1',
      slug: 'fm-engine',
      title: 'FM Engine',
      track_id: 'T1',
      views: 10,
      completions: 4,
      completion_rate: 0.4,
      avg_completion_ms: 300000,
      abandonments: 2,
      reflections: 3,
      reflection_rate: 0.3,
    },
  ],
};
const tracks = {
  items: [
    {
      track_id: 'T1',
      slug: 'synthesis-fundamentals',
      title: 'Synthesis',
      lessons: 5,
      starts: 12,
      completions: 4,
      completion_rate: 0.3333,
      top_paths: [],
      off_graph_paths: [],
    },
  ],
};
const clips = {
  items: [
    {
      clip_slug: 'clipA',
      exposures: 8,
      plays: 6,
      replays: 2,
      skips: 2,
      skip_rate: 0.25,
    },
  ],
};
const detail = {
  rollup: lessons.items[0],
  total_steps: 4,
  dropoff: [1.0, 0.7, 0.5, 0.4],
  step_times: [],
  prompt_stats: {
    prompt_steps: [2],
    tried: 3,
    skipped: 1,
    tried_ratio: 0.75,
    per_step: [],
  },
  clip_stats: clips.items,
};

vi.mock('./adminApi', () => ({
  getLessonAnalytics: vi.fn(() => Promise.resolve(lessons)),
  getTrackAnalytics: vi.fn(() => Promise.resolve(tracks)),
  getClipAnalytics: vi.fn(() => Promise.resolve(clips)),
  getLessonAnalyticsDetail: vi.fn(() => Promise.resolve(detail)),
  refreshAnalytics: vi.fn(() =>
    Promise.resolve({ refreshed: false, refreshed_at: '2026-05-30T00:00:00Z' }),
  ),
}));

import { AnalyticsPage } from './AnalyticsPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AnalyticsPage (v6.5 admin)', () => {
  it('renders the per-lesson rollup with completion rate', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('FM Engine')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument(); // completion_rate
  });

  it('states clearly that analytics are aggregate / anonymized', async () => {
    render(<AnalyticsPage />);
    await screen.findByText('FM Engine');
    expect(
      screen.getByText(/no individual learner's progress is shown/i),
    ).toBeInTheDocument();
  });

  it('opens the per-lesson drop-off detail on row click', async () => {
    render(<AnalyticsPage />);
    fireEvent.click(await screen.findByText('FM Engine'));
    await waitFor(() =>
      expect(screen.getByText(/drop-off/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/3 tried/)).toBeInTheDocument();
  });

  it('switches to the clips view', async () => {
    render(<AnalyticsPage />);
    await screen.findByText('FM Engine');
    fireEvent.click(screen.getByRole('tab', { name: 'Clips' }));
    expect(await screen.findByText('clipA')).toBeInTheDocument();
  });

  it('offers a CSV export button', async () => {
    render(<AnalyticsPage />);
    await screen.findByText('FM Engine');
    expect(
      screen.getByRole('button', { name: /export csv/i }),
    ).toBeInTheDocument();
  });
});

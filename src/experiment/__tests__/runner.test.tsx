import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExperimentRunner } from '../ExperimentRunner';
import type { ExperimentDefinition } from '../types';

// Mock react-router-dom hooks
vi.mock('react-router-dom', () => ({
  useParams: () => ({ slug: 'test-slug' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '' }),
}));

// Mock useAnnealMusic hook
vi.mock('@/hooks/useAnnealMusic', () => ({
  useAnnealMusic: () => ({
    setEngine: vi.fn(),
    setParam: vi.fn(),
    startSession: vi.fn(),
    stopSession: vi.fn(),
  }),
}));

const mockDefinition: ExperimentDefinition = {
  title: 'Consonance study',
  description: 'An experiment in consonance/dissonance height.',
  consent_text: 'I consent to this study.',
  debrief_text: 'Thank you.',
  demographics: {
    fields: ['age'],
  },
  steps: [
    {
      type: 'block',
      name: 'Main Block',
      randomize: 'fixed',
      counterbalance: false,
      trials: [
        {
          stimulus: {
            id: 'control',
            patch: { engine: 'sine', rootFreq: 220 },
            duration: 1.0,
          },
          response: {
            type: 'LikertResponse',
            prompt: 'How stable does this feel?',
            scale: 7,
          },
        },
      ],
    },
  ],
};

describe('ExperimentRunner Flow', () => {
  it('renders consent screen initially and toggles start button on checkbox agreement', () => {
    render(
      <ExperimentRunner isPreview={true} previewDefinition={mockDefinition} />,
    );

    expect(screen.getByText('Consonance study')).toBeInTheDocument();
    expect(screen.getByText('I consent to this study.')).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /begin study/i });
    expect(startBtn).toBeDisabled();

    // Toggle consent checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(startBtn).toBeEnabled();
  });
});

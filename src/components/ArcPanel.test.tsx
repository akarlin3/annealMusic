import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ArcPanel from '@/components/ArcPanel';

afterEach(cleanup);

const noop = () => {};

describe('ArcPanel', () => {
  it('renders the three preset cards with the selected one checked', () => {
    render(
      <ArcPanel
        arcId="bell"
        setArcId={noop}
        durationSec={600}
        setDurationSec={noop}
        engineId="sine"
      />,
    );
    expect(screen.getByRole('radio', { name: /Bell Curve/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /Dawn/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Dusk/ })).toBeInTheDocument();
  });

  it('selects a preset on click', () => {
    const setArcId = vi.fn();
    render(
      <ArcPanel
        arcId="bell"
        setArcId={setArcId}
        durationSec={600}
        setDurationSec={noop}
        engineId="sine"
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /Dawn/ }));
    expect(setArcId).toHaveBeenCalledWith('dawn');
  });

  it('updates the duration via the slider', () => {
    const setDurationSec = vi.fn();
    render(
      <ArcPanel
        arcId="bell"
        setArcId={noop}
        durationSec={600}
        setDurationSec={setDurationSec}
        engineId="sine"
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Arc duration' });
    fireEvent.change(slider, { target: { value: '900' } });
    expect(setDurationSec).toHaveBeenCalledWith(900);
  });

  it('shows a density-held note when the engine locks density and the arc moves it', () => {
    render(
      <ArcPanel
        arcId="dawn"
        setArcId={noop}
        durationSec={600}
        setDurationSec={noop}
        engineId="sine"
      />,
    );
    expect(screen.getByText(/density held/)).toBeInTheDocument();
  });

  it('omits the density-held note for arcs that do not touch density', () => {
    render(
      <ArcPanel
        arcId="bell"
        setArcId={noop}
        durationSec={600}
        setDurationSec={noop}
        engineId="sine"
      />,
    );
    expect(screen.queryByText(/density held/)).toBeNull();
  });

  it('disables all controls when locked', () => {
    render(
      <ArcPanel
        arcId="bell"
        setArcId={noop}
        durationSec={600}
        setDurationSec={noop}
        engineId="sine"
        disabled
      />,
    );
    expect(screen.getByRole('slider', { name: 'Arc duration' })).toBeDisabled();
    for (const card of screen.getAllByRole('radio')) {
      expect(card).toBeDisabled();
    }
  });
});

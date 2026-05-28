import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PresetsPanel from '@/components/PresetsPanel';
import { useParamStore } from '@/state/params';

afterEach(cleanup);

describe('PresetsPanel', () => {
  const showToast = vi.fn();

  beforeEach(() => {
    showToast.mockClear();
    useParamStore.getState().reset();
  });

  it('renders all presets with correct titles', () => {
    render(<PresetsPanel showToast={showToast} />);
    expect(screen.getByText('Cosmic Hum')).toBeInTheDocument();
    expect(screen.getByText('Tibetan Bowls')).toBeInTheDocument();
    expect(screen.getByText('Autumn Rain')).toBeInTheDocument();
    expect(screen.getByText('String Quartet')).toBeInTheDocument();
  });

  it('collapses and expands when toggle button is clicked', () => {
    render(<PresetsPanel showToast={showToast} />);

    // By default it is expanded, cards should be visible
    expect(screen.getByText('Cosmic Hum')).toBeInTheDocument();

    // Click collapse
    const toggleBtn = screen.getByRole('button', { name: /Collapse/i });
    fireEvent.click(toggleBtn);

    // Cards should now be hidden
    expect(screen.queryByText('Cosmic Hum')).toBeNull();

    // The button text should change
    expect(
      screen.getByRole('button', { name: /Show Presets/i }),
    ).toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByRole('button', { name: /Show Presets/i }));
    expect(screen.getByText('Cosmic Hum')).toBeInTheDocument();
  });

  it('auto-detects and highlights the active preset when state matches', () => {
    // Configure store to match 'Cosmic Hum' exactly
    const store = useParamStore.getState();
    store.setEngine('sine');
    store.setMany({
      rootFreq: 55,
      spread: 0.75,
      density: 4,
      coupling: 0.8,
      drift: 0.3,
      brightness: 0.2,
      space: 0.6,
    });

    render(<PresetsPanel showToast={showToast} />);

    // Active status indicator should be rendered
    expect(screen.getByText('Active: Cosmic Hum')).toBeInTheDocument();

    // The Cosmic Hum radio card should be checked (aria-checked)
    const card = screen.getByRole('radio', { name: /Cosmic Hum/i });
    expect(card).toHaveAttribute('aria-checked', 'true');
  });

  it('loads a preset into the store on click and triggers toast callback', () => {
    render(<PresetsPanel showToast={showToast} />);

    const card = screen.getByRole('radio', { name: /Tibetan Bowls/i });
    fireEvent.click(card);

    // Verify toast was shown
    expect(showToast).toHaveBeenCalledWith('Loaded preset "Tibetan Bowls"');

    // Verify store has updated correctly
    const store = useParamStore.getState();
    expect(store.engineId).toBe('fm');
    expect(store.params.rootFreq).toBe(87);
    expect(store.params.spread).toBe(1.15);
    expect(store.params.brightness).toBe(0.6);
    expect(store.engineParams.fm?.modRatio).toBe(2.02);
    expect(store.engineParams.fm?.modIndex).toBe(3.5);
  });

  it('disables the preset cards when disabled is true', () => {
    render(<PresetsPanel showToast={showToast} disabled />);

    const cards = screen.getAllByRole('radio');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card).toBeDisabled();
    }
  });
});

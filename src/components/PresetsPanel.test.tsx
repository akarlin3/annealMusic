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

    // Click the Metallic & Bell tab first
    const tabBtn = screen.getByRole('button', { name: /Metallic & Bell/i });
    fireEvent.click(tabBtn);

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

  it('switches visible preset list when category tab is clicked', () => {
    render(<PresetsPanel showToast={showToast} />);

    // Under default 'Ambient & Space' tab, 'Cosmic Hum' is visible (display: flex)
    const cosmicHumCard = screen.getByText('Cosmic Hum').closest('button');
    expect(cosmicHumCard).toHaveStyle({ display: 'flex' });

    // Under 'Ambient & Space' tab, 'Tibetan Bowls' (which is in 'Metallic & Bell') is hidden (display: none)
    const tibetanBowlsCard = screen
      .getByText('Tibetan Bowls')
      .closest('button');
    expect(tibetanBowlsCard).toHaveStyle({ display: 'none' });

    // Click the Metallic & Bell tab
    const tabBtn = screen.getByRole('button', { name: /Metallic & Bell/i });
    fireEvent.click(tabBtn);

    // Now 'Tibetan Bowls' should be visible, and 'Cosmic Hum' should be hidden
    expect(tibetanBowlsCard).toHaveStyle({ display: 'flex' });
    expect(cosmicHumCard).toHaveStyle({ display: 'none' });
  });

  it('automatically switches the active tab when a preset is loaded externally', () => {
    // Configure store to match 'Tibetan Bowls' exactly (in category Metallic & Bell)
    const store = useParamStore.getState();
    store.setEngine('fm');
    store.setMany({
      rootFreq: 87,
      spread: 1.15,
      density: 5,
      coupling: 0.25,
      drift: 0.7,
      brightness: 0.6,
      space: 0.75,
    });
    store.setEngineParam('fm', 'modRatio', 2.02);
    store.setEngineParam('fm', 'modIndex', 3.5);
    store.setEngineParam('fm', 'feedback', 0.3);

    render(<PresetsPanel showToast={showToast} />);

    // Active status indicator should be rendered for Tibetan Bowls
    expect(screen.getByText('Active: Tibetan Bowls')).toBeInTheDocument();

    // The 'Tibetan Bowls' card should be visible, showing the tab automatically synchronized
    const card = screen.getByText('Tibetan Bowls').closest('button');
    expect(card).toHaveStyle({ display: 'flex' });
  });
});

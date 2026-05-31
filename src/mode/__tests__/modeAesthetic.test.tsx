import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ModeProvider } from '../ModeContext';
import { ModeAesthetic } from '@/design/ModeAesthetic';
import { useMode } from '../useMode';

function TestComponent({
  targetMode,
}: {
  targetMode: 'meditation' | 'musician' | 'researcher';
}) {
  const { setMode } = useMode();
  return (
    <button type="button" onClick={() => void setMode(targetMode)}>
      Switch to {targetMode}
    </button>
  );
}

describe('ModeAesthetic Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-mode');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-mode');
  });

  it('applies standard musician data-mode attribute on load if not set', async () => {
    render(
      <ModeProvider>
        <ModeAesthetic>
          <div>App content</div>
        </ModeAesthetic>
      </ModeProvider>,
    );

    // Default target mode should be applied once loading completes
    await waitFor(() => {
      const currentMode = document.documentElement.getAttribute('data-mode');
      expect(currentMode).toBe('musician');
    });
  });

  it('syncs data-mode attribute on mode updates', async () => {
    localStorage.setItem('am_app_mode', 'meditation');

    const { getByText } = render(
      <ModeProvider>
        <ModeAesthetic>
          <TestComponent targetMode="researcher" />
        </ModeAesthetic>
      </ModeProvider>,
    );

    // Initial loaded state from localStorage
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-mode')).toBe(
        'meditation',
      );
    });

    // Trigger action to update to researcher
    getByText('Switch to researcher').click();

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-mode')).toBe(
        'researcher',
      );
    });
  });
});

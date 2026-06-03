import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ModeProvider } from '../ModeContext';
import { useMode } from '../useMode';
import { ModeSwitcher } from '../ModeSwitcher';
import { FirstTimeModePicker } from '../FirstTimeModePicker';

function TestComponent() {
  const { mode, loading, showPicker } = useMode();
  return (
    <div>
      <span data-testid="mode">{mode || 'none'}</span>
      <span data-testid="loading">{loading ? 'yes' : 'no'}</span>
      <span data-testid="picker">{showPicker ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('Top-Level Modes Infrastructure', () => {
  const mockLocation = { href: '', pathname: '/' };

  beforeEach(() => {
    localStorage.clear();
    mockLocation.href = '';
    mockLocation.pathname = '/';
    vi.stubGlobal('location', mockLocation);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('defaults to showing picker on first-time launch', async () => {
    render(
      <ModeProvider>
        <TestComponent />
      </ModeProvider>,
    );

    // Initial state
    expect(screen.getByTestId('loading')).toHaveTextContent('yes');

    // Wait for load
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('no'),
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('none');
    expect(screen.getByTestId('picker')).toHaveTextContent('yes');
  });

  it('loads previously saved mode from storage', async () => {
    localStorage.setItem('am_app_mode', 'meditation');

    render(
      <ModeProvider>
        <TestComponent />
      </ModeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('no'),
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('meditation');
    expect(screen.getByTestId('picker')).toHaveTextContent('no');
  });

  it('selects mode via FirstTimeModePicker and redirects', async () => {
    render(
      <ModeProvider>
        <FirstTimeModePicker />
        <TestComponent />
      </ModeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('no'),
    );

    // Click meditation focus card
    const meditationBtn = screen.getByRole('button', {
      name: /meditation focus/i,
    });
    fireEvent.click(meditationBtn);

    await waitFor(() => {
      expect(localStorage.getItem('am_app_mode')).toBe('meditation');
      expect(mockLocation.href).toBe('/listen');
    });
  });

  it('skips to musician sandbox on picker skip click', async () => {
    render(
      <ModeProvider>
        <FirstTimeModePicker />
        <TestComponent />
      </ModeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('no'),
    );

    const skipBtn = screen.getByRole('button', { name: /skip to musician/i });
    fireEvent.click(skipBtn);

    await waitFor(() => {
      expect(localStorage.getItem('am_app_mode')).toBe('musician');
      expect(screen.getByTestId('picker')).toHaveTextContent('no');
    });
  });

  it('cycles modes using Shift+M keyboard shortcut', async () => {
    localStorage.setItem('am_app_mode', 'meditation');

    render(
      <ModeProvider>
        <ModeSwitcher />
        <TestComponent />
      </ModeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('no'),
    );

    // Trigger Shift+M
    fireEvent.keyDown(window, { key: 'm', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('mode')).toHaveTextContent('musician');
      expect(localStorage.getItem('am_app_mode')).toBe('musician');
      expect(mockLocation.href).toBe('/');
    });

    // Shift+M again -> researcher
    fireEvent.keyDown(window, { key: 'm', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('mode')).toHaveTextContent('researcher');
      expect(localStorage.getItem('am_app_mode')).toBe('researcher');
      expect(mockLocation.href).toBe('/research.html');
    });
  });
});

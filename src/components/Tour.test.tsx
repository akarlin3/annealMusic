import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import Tour from '@/components/Tour';
import { TOUR_STORAGE_KEY, useTour } from '@/hooks/useTour';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('useTour first-run behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  it('auto-starts on first visit (no dismissal flag stored)', () => {
    const { result } = renderHook(() => useTour());
    expect(result.current.active).toBe(false);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.active).toBe(true);
  });

  it('does not auto-start once dismissal is remembered', () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, '1');
    const { result } = renderHook(() => useTour());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.active).toBe(false);
  });

  it('dismiss persists the flag and closes the tour', () => {
    const { result } = renderHook(() => useTour());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.active).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.active).toBe(false);
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe('1');
  });
});

describe('Tour component', () => {
  const api = {
    active: true,
    step: 0,
    start: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    dismiss: vi.fn(),
  };

  it('renders the welcome step and Skip/Next controls when active', () => {
    render(<Tour tour={{ ...api }} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Welcome to AnnealMusic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('renders nothing when inactive', () => {
    const { container } = render(<Tour tour={{ ...api, active: false }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('advances on Next and dismisses on Skip', () => {
    const next = vi.fn();
    const dismiss = vi.fn();
    render(<Tour tour={{ ...api, next, dismiss }} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(next).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(dismiss).toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import CopyLinkButton from '@/components/CopyLinkButton';
import { DEFAULT_PARAMS } from '@/state/params';
import { buildShareUrl } from '@/share/url';

// jsdom does not implement execCommand; ensure it exists so we can spy on it.
if (typeof document.execCommand !== 'function') {
  (document as unknown as { execCommand: () => boolean }).execCommand = () =>
    false;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('CopyLinkButton', () => {
  it('copies the share URL and flips the label to Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onResult = vi.fn();

    render(<CopyLinkButton params={DEFAULT_PARAMS} onResult={onResult} />);
    expect(screen.getByText('Copy Link')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await vi.waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    expect(writeText).toHaveBeenCalledWith(buildShareUrl(DEFAULT_PARAMS));
    expect(onResult).toHaveBeenCalledWith('Link copied');
  });

  it('reverts the label after the timeout', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(<CopyLinkButton params={DEFAULT_PARAMS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await vi.waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    // Advance timers by 1500ms to trigger the label revert state update
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText('Copy Link')).toBeInTheDocument();
  });

  it('falls back to execCommand when clipboard write is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const execCommand = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const onResult = vi.fn();

    render(<CopyLinkButton params={DEFAULT_PARAMS} onResult={onResult} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await vi.waitFor(() => {
      expect(execCommand).toHaveBeenCalledWith('copy');
    });
    expect(onResult).toHaveBeenCalledWith('Link copied');
  });

  it('prompts manually when both clipboard paths fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.spyOn(document, 'execCommand').mockReturnValue(false);
    const prompt = vi.fn();
    vi.stubGlobal('prompt', prompt);
    const onResult = vi.fn();

    render(<CopyLinkButton params={DEFAULT_PARAMS} onResult={onResult} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await vi.waitFor(() => {
      expect(prompt).toHaveBeenCalled();
    });
    expect(onResult).toHaveBeenCalledWith(
      'Copy failed — select the link to copy manually',
    );
  });

  it('uses the legacy path when navigator.clipboard is absent', async () => {
    vi.stubGlobal('navigator', {});
    const execCommand = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const onResult = vi.fn();

    render(<CopyLinkButton params={DEFAULT_PARAMS} onResult={onResult} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await vi.waitFor(() => {
      expect(execCommand).toHaveBeenCalledWith('copy');
    });
    expect(onResult).toHaveBeenCalledWith('Link copied');
  });
});

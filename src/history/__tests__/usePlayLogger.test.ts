import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlayLogger } from '@/history/usePlayLogger';
import { api } from '@/api/client';

afterEach(() => vi.restoreAllMocks());

describe('usePlayLogger', () => {
  it('logs on start and finalizes once with the actual duration', async () => {
    vi.spyOn(api, 'isBackendConfigured').mockReturnValue(true);
    const logSpy = vi
      .spyOn(api, 'logSessionPlay')
      .mockResolvedValue({ id: 'play-1' } as never);
    const updSpy = vi
      .spyOn(api, 'updateSessionPlay')
      .mockResolvedValue({} as never);

    const { result } = renderHook(() => usePlayLogger('ls-1', true));

    await act(async () => {
      result.current.onStart();
    });
    await waitFor(() => expect(logSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.onEnd(45000);
      // A second end (e.g. unmount after completion) must be ignored.
      result.current.onEnd(45000);
    });

    expect(updSpy).toHaveBeenCalledTimes(1);
    expect(updSpy).toHaveBeenCalledWith(
      'play-1',
      expect.objectContaining({ duration_listened_ms: 45000 }),
    );
  });

  it('never logs for anonymous users but shows the gentle nudge', async () => {
    const logSpy = vi.spyOn(api, 'logSessionPlay');
    const { result } = renderHook(() => usePlayLogger('ls-1', false));

    act(() => {
      result.current.onStart();
      result.current.onEnd(30000);
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(result.current.showNudge).toBe(true);
  });

  it('does not nudge when nothing was listened', () => {
    const { result } = renderHook(() => usePlayLogger('ls-1', false));
    act(() => {
      result.current.onStart();
      result.current.onEnd(0);
    });
    expect(result.current.showNudge).toBe(false);
  });
});

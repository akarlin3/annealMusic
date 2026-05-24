import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GallerySearch from '@/gallery/GallerySearch';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GallerySearch', () => {
  it('debounces and emits the query', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<GallerySearch value="" onSearch={onSearch} debounceMs={200} />);

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'ocean' },
    });
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(onSearch).toHaveBeenCalledWith('ocean');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GalleryFilters, { type FilterState } from '@/gallery/GalleryFilters';

afterEach(cleanup);

const base: FilterState = {
  sort: 'newest',
  engine: '',
  mode: '',
  hasCaptures: false,
};

describe('GalleryFilters', () => {
  it('emits sort changes', () => {
    const onChange = vi.fn();
    render(<GalleryFilters value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Sort'), {
      target: { value: 'most_loaded' },
    });
    expect(onChange).toHaveBeenCalledWith({ ...base, sort: 'most_loaded' });
  });

  it('emits engine + captures filter changes', () => {
    const onChange = vi.fn();
    render(<GalleryFilters value={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Engine'), {
      target: { value: 'fm' },
    });
    expect(onChange).toHaveBeenCalledWith({ ...base, engine: 'fm' });

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith({ ...base, hasCaptures: true });
  });
});

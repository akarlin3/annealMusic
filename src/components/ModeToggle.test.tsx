import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ModeToggle from '@/components/ModeToggle';

afterEach(cleanup);

describe('ModeToggle', () => {
  it('marks the active mode and offers both options', () => {
    render(<ModeToggle mode="open" setMode={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Open' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Arc' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('selects a mode on click', () => {
    const setMode = vi.fn();
    render(<ModeToggle mode="open" setMode={setMode} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Arc' }));
    expect(setMode).toHaveBeenCalledWith('arc');
  });

  it('does not change mode while disabled', () => {
    const setMode = vi.fn();
    render(<ModeToggle mode="open" setMode={setMode} disabled />);
    fireEvent.click(screen.getByRole('radio', { name: 'Arc' }));
    expect(setMode).not.toHaveBeenCalled();
  });
});

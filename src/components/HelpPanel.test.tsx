import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HelpPanel from '@/components/HelpPanel';
import { ABOUT_INTRO } from '@/content/explanations';

afterEach(cleanup);

describe('HelpPanel', () => {
  it('renders as a labelled modal dialog with the intro pitch', () => {
    render(<HelpPanel onClose={() => {}} onReplayTour={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('What is AnnealMusic?')).toBeInTheDocument();
    expect(screen.getByText(ABOUT_INTRO)).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<HelpPanel onClose={onClose} onReplayTour={() => {}} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on backdrop click but not on content click', () => {
    const onClose = vi.fn();
    render(<HelpPanel onClose={onClose} onReplayTour={() => {}} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    // The backdrop is the dialog's parent overlay.
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps focus inside the dialog when tabbing past the last element', () => {
    render(<HelpPanel onClose={() => {}} onReplayTour={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const focusables = dialog.querySelectorAll<HTMLElement>('button');
    const last = focusables[focusables.length - 1]!;
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    // Wrapped back to the first focusable, still inside the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('invokes the replay-tour callback', () => {
    const onReplayTour = vi.fn();
    render(<HelpPanel onClose={() => {}} onReplayTour={onReplayTour} />);
    fireEvent.click(screen.getByRole('button', { name: /replay tour/i }));
    expect(onReplayTour).toHaveBeenCalled();
  });
});

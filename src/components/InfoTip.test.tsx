import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import InfoTip from '@/components/InfoTip';
import { getExplain } from '@/content/explanations';

afterEach(cleanup);

describe('InfoTip', () => {
  it('renders a real button with an accessible name', () => {
    render(<InfoTip id="rootFreq" />);
    const btn = screen.getByRole('button', { name: /what is root/i });
    expect(btn.tagName).toBe('BUTTON');
  });

  it('associates the button with its tooltip via aria-describedby', () => {
    render(<InfoTip id="rootFreq" />);
    const btn = screen.getByRole('button', { name: /what is root/i });
    const describedBy = btn.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const tip = document.getElementById(describedBy!);
    expect(tip).not.toBeNull();
    expect(tip?.textContent).toBe(getExplain('rootFreq')!.tooltip);
  });

  it('opens on keyboard focus and closes on blur', () => {
    render(<InfoTip id="spread" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.blur(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles open and closed on tap/click', () => {
    render(<InfoTip id="drift" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape', () => {
    render(<InfoTip id="density" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders nothing for an unknown id', () => {
    const { container } = render(<InfoTip id="nope.not.real" />);
    expect(container).toBeEmptyDOMElement();
  });
});

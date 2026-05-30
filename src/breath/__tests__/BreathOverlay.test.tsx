import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import BreathOverlay from '@/breath/BreathOverlay';

describe('BreathOverlay', () => {
  const getNow = () => 0;

  it('renders nothing when no pattern is attached', () => {
    const { container } = render(
      <BreathOverlay pattern={null} active getNow={getNow} />,
    );
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('renders nothing when inactive', () => {
    const { container } = render(
      <BreathOverlay pattern={{ pattern: 'box' }} active={false} getNow={getNow} />,
    );
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('mounts an aria-hidden overlay canvas when active with a pattern', () => {
    const { container } = render(
      <BreathOverlay pattern={{ pattern: 'box' }} active getNow={getNow} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
  });
});

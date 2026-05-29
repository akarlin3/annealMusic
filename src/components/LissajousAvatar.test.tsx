import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { LissajousAvatar } from '@/components/LissajousAvatar';

afterEach(() => {
  cleanup();
});

describe('LissajousAvatar', () => {
  it('renders correctly with given size', () => {
    const { container } = render(
      <LissajousAvatar seed="test-seed" size={48} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('generates deterministic wave path for the same seed', () => {
    const { container: container1 } = render(
      <LissajousAvatar seed="same-seed" />,
    );
    const path1 = container1.querySelector('path')?.getAttribute('d');

    cleanup();

    const { container: container2 } = render(
      <LissajousAvatar seed="same-seed" />,
    );
    const path2 = container2.querySelector('path')?.getAttribute('d');

    expect(path1).toBe(path2);
    expect(path1).toBeTruthy();
  });

  it('generates different wave paths for different seeds', () => {
    const { container: container1 } = render(
      <LissajousAvatar seed="seed-alpha" />,
    );
    const path1 = container1.querySelector('path')?.getAttribute('d');

    cleanup();

    const { container: container2 } = render(
      <LissajousAvatar seed="seed-beta" />,
    );
    const path2 = container2.querySelector('path')?.getAttribute('d');

    expect(path1).not.toBe(path2);
    expect(path1).toBeTruthy();
    expect(path2).toBeTruthy();
  });
});

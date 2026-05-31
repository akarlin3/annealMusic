import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import LessonHintLink from '@/components/LessonHintLink';
import { lessonHref, setShowLearningHints } from '@/components/lessonHints';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
  setShowLearningHints(true);
});

describe('LessonHintLink (v6.5 discoverability)', () => {
  it('builds a /learn deep link that opens in a new tab', () => {
    render(
      <LessonHintLink
        lessonPath="synthesis-fundamentals/fm-engine"
        label="Learn more about this engine"
      />,
    );
    const link = screen.getByRole('link', {
      name: 'Learn more about this engine',
    });
    expect(link).toHaveAttribute(
      'href',
      '/learn#lesson/synthesis-fundamentals/fm-engine',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders nothing when learning hints are hidden (opt-out)', () => {
    setShowLearningHints(false);
    render(
      <LessonHintLink
        lessonPath="synthesis-fundamentals/fm-engine"
        label="Learn more"
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders an accessible icon variant', () => {
    render(
      <LessonHintLink
        lessonPath="music-science-crossover/harmonic-series"
        label="Learn about harmonics"
        variant="icon"
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Learn about harmonics' }),
    ).toBeInTheDocument();
  });

  it('lessonHref formats the curriculum path', () => {
    expect(lessonHref('a/b')).toBe('/learn#lesson/a/b');
  });
});

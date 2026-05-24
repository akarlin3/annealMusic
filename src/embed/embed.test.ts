import { describe, expect, it, vi } from 'vitest';
import { resolveTheme, paletteFor } from '@/embed/theme';
import { configFromLocation, mountEmbed } from '@/embed/embedApp';

describe('embed theme', () => {
  it('defaults to dark and honors ?theme=light', () => {
    expect(resolveTheme(null)).toBe('dark');
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('garbage')).toBe('dark');
  });

  it('exposes distinct dark/light palettes', () => {
    expect(paletteFor('dark').bg).not.toBe(paletteFor('light').bg);
  });
});

describe('configFromLocation', () => {
  it('extracts the slug from the /embed/<slug> path and theme query', () => {
    const loc = {
      pathname: '/embed/abc123',
      search: '?theme=light',
      origin: 'https://annealmusic.app',
    } as Location;
    const cfg = configFromLocation(loc, 'https://api.example');
    expect(cfg.slug).toBe('abc123');
    expect(cfg.theme).toBe('light');
    expect(cfg.apiBase).toBe('https://api.example');
    expect(cfg.origin).toBe('https://annealmusic.app');
  });
});

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('mountEmbed', () => {
  it('renders the player for a public patch', async () => {
    const root = document.createElement('div');
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({ title: 'Dawn Field', visibility: 'public' }),
      ),
    ) as unknown as typeof fetch;

    await mountEmbed(root, {
      slug: 'abc',
      theme: 'dark',
      apiBase: '',
      origin: 'https://annealmusic.app',
      fetchImpl,
    });

    expect(root.textContent).toContain('Dawn Field');
    expect(root.querySelector('button[aria-label="Play"]')).not.toBeNull();
    const mark = root.querySelector('a');
    expect(mark?.getAttribute('href')).toBe('https://annealmusic.app/p/abc');
  });

  it('renders the gated state for a non-public patch', async () => {
    const root = document.createElement('div');
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({ title: 'Secret', visibility: 'unlisted' }),
      ),
    ) as unknown as typeof fetch;

    await mountEmbed(root, {
      slug: 'abc',
      theme: 'dark',
      apiBase: '',
      origin: 'https://annealmusic.app',
      fetchImpl,
    });

    expect(root.textContent).toContain('not public');
    expect(root.querySelector('button[aria-label="Play"]')).toBeNull();
  });

  it('renders the gated state when the patch is missing (404)', async () => {
    const root = document.createElement('div');
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse(null, false)),
    ) as unknown as typeof fetch;

    await mountEmbed(root, {
      slug: 'nope',
      theme: 'light',
      apiBase: '',
      origin: 'https://annealmusic.app',
      fetchImpl,
    });

    expect(root.textContent).toContain('not public');
  });
});

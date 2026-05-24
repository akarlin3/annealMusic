/** Embed theming. Pure (no DOM) so the palette choice is unit-testable. */
export type EmbedTheme = 'dark' | 'light';

export interface EmbedPalette {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  track: string;
}

const PALETTES: Record<EmbedTheme, EmbedPalette> = {
  dark: {
    bg: '#0c0a09',
    fg: '#f5f5f4',
    muted: '#78716c',
    accent: '#f59e0b',
    track: '#292524',
  },
  light: {
    bg: '#faf9f7',
    fg: '#1c1917',
    muted: '#78716c',
    accent: '#b45309',
    track: '#e7e5e4',
  },
};

/** Resolve a `?theme=` query value to a palette (default dark). */
export function resolveTheme(raw: string | null | undefined): EmbedTheme {
  return raw === 'light' ? 'light' : 'dark';
}

export function paletteFor(theme: EmbedTheme): EmbedPalette {
  return PALETTES[theme];
}

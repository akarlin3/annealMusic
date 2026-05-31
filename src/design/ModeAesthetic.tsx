import { useEffect, ReactNode } from 'react';
import { useMode } from '@/mode/useMode';
import { tokens } from './tokens';

interface ModeAestheticProps {
  children?: ReactNode;
}

export function ModeAesthetic({ children }: ModeAestheticProps) {
  const { mode } = useMode();

  // Resolved mode defaults to musician if null
  const activeMode = mode || 'musician';

  useEffect(() => {
    // 1. Sync data-mode attribute on HTML document element for CSS selectors
    document.documentElement.setAttribute('data-mode', activeMode);
  }, [activeMode]);

  // Generate dynamic CSS variables scoped by data-mode attribute
  const cssStyles = `
    /* --- SHARED STYLES --- */
    :root {
      --font-family-display: ${tokens.type.family.display};
      --font-family-body: ${tokens.type.family.body};
      --font-family-mono: ${tokens.type.family.mono};
      --spacing-scale-base: 4px;
      --color-rose: 248, 113, 113;
      --color-cyan: 125, 211, 252;
    }

    /* --- MEDITATION AESTHETICS --- */
    [data-mode="meditation"] {
      --bg-base: ${tokens.color.base.meditation};
      --color-text: ${tokens.color.text.meditation};
      --color-muted: ${tokens.color.muted.meditation};
      --color-accent: ${tokens.color.accent.meditation};
      --color-accent-rgb: ${tokens.color.accentRgb.meditation};
      --accent-glow: ${tokens.color.accentGlow.meditation};
      --color-surf: ${tokens.color.surface.meditation};
      --color-border: ${tokens.color.border.meditation};
      
      --spacing-multiplier: ${tokens.spacing.density.meditation};
      
      --font-weight-body: ${tokens.type.weight.meditation.body};
      --font-weight-head: ${tokens.type.weight.meditation.head};
      --line-height-body: ${tokens.type.lineHeight.meditation};
      
      --motion-duration-multiplier: ${tokens.motion.duration.meditation};
      --motion-easing: ${tokens.motion.easing.meditation};
      --ornament-opacity: ${tokens.ornament.opacity.meditation};
      --chrome-opacity: 0.15;
    }

    /* --- MUSICIAN AESTHETICS --- */
    [data-mode="musician"] {
      --bg-base: ${tokens.color.base.musician};
      --color-text: ${tokens.color.text.musician};
      --color-muted: ${tokens.color.muted.musician};
      --color-accent: ${tokens.color.accent.musician};
      --color-accent-rgb: ${tokens.color.accentRgb.musician};
      --accent-glow: ${tokens.color.accentGlow.musician};
      --color-surf: ${tokens.color.surface.musician};
      --color-border: ${tokens.color.border.musician};
      
      --spacing-multiplier: ${tokens.spacing.density.musician};
      
      --font-weight-body: ${tokens.type.weight.musician.body};
      --font-weight-head: ${tokens.type.weight.musician.head};
      --line-height-body: ${tokens.type.lineHeight.musician};
      
      --motion-duration-multiplier: ${tokens.motion.duration.musician};
      --motion-easing: ${tokens.motion.easing.musician};
      --ornament-opacity: ${tokens.ornament.opacity.musician};
      --chrome-opacity: 1.0;
    }

    /* --- RESEARCHER AESTHETICS --- */
    [data-mode="researcher"] {
      --bg-base: ${tokens.color.base.researcher};
      --color-text: ${tokens.color.text.researcher};
      --color-muted: ${tokens.color.muted.researcher};
      --color-accent: ${tokens.color.accent.researcher};
      --color-accent-rgb: ${tokens.color.accentRgb.researcher};
      --accent-glow: ${tokens.color.accentGlow.researcher};
      --color-surf: ${tokens.color.surface.researcher};
      --color-border: ${tokens.color.border.researcher};
      
      --spacing-multiplier: ${tokens.spacing.density.researcher};
      
      --font-weight-body: ${tokens.type.weight.researcher.body};
      --font-weight-head: ${tokens.type.weight.researcher.head};
      --line-height-body: ${tokens.type.lineHeight.researcher};
      
      --motion-duration-multiplier: ${tokens.motion.duration.researcher};
      --motion-easing: ${tokens.motion.easing.researcher};
      --ornament-opacity: ${tokens.ornament.opacity.researcher};
      --chrome-opacity: 1.0;
    }

    /* --- ACCESSIBILITY OVERRIDES --- */
    @media (prefers-reduced-motion: reduce) {
      [data-mode] {
        --motion-duration-multiplier: 0 !important;
        --motion-easing: linear !important;
      }
      * {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
      }
    }

    /* --- GLOBAL TOKEN BRIDGING --- */
    body {
      background-color: var(--bg-base);
      color: var(--color-text);
      font-family: var(--font-family-body);
      font-weight: var(--font-weight-body);
      line-height: var(--line-height-body);
      transition: background-color calc(200ms * var(--motion-duration-multiplier)) var(--motion-easing),
                  color calc(200ms * var(--motion-duration-multiplier)) var(--motion-easing);
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-family-display);
      font-weight: var(--font-weight-head);
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
      {children}
    </>
  );
}

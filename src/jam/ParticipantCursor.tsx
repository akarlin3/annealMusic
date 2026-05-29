import { useJam } from './JamProvider';

export default function ParticipantCursor() {
  const jam = useJam();
  if (!jam) return null;

  const { activeCursors } = jam;

  const activeEntries = Object.entries(activeCursors) as [
    string,
    { paramKey: string; color: string; name: string; ts: number },
  ][];
  if (activeEntries.length === 0) return null;

  // Generate dynamic CSS rules to glow the active remote cursor sliders
  const cssRules = activeEntries
    .map(([, cursor]) => {
      const sanitizedKey = cursor.paramKey.replace(/[^a-zA-Z0-9_-]/g, '');
      const glowColor = cursor.color;
      const userName = cursor.name.replace(/"/g, '\\"');

      return `
        div[data-tour="${sanitizedKey}"] {
          position: relative !important;
          box-shadow: 0 0 14px ${glowColor} !important;
          border-radius: 8px !important;
          transition: box-shadow 0.25s ease-out !important;
          padding: 6px !important;
          margin: -6px !important;
          border: 1px solid ${glowColor}55 !important;
        }
        div[data-tour="${sanitizedKey}"]::before {
          content: "${userName}" !important;
          position: absolute !important;
          right: 8px !important;
          top: -14px !important;
          background: ${glowColor} !important;
          color: #0c0a09 !important;
          font-family: monospace !important;
          font-size: 8px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.1em !important;
          padding: 1.5px 5px !important;
          border-radius: 3px !important;
          line-height: 1 !important;
          pointer-events: none !important;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5) !important;
          z-index: 10 !important;
        }
      `;
    })
    .join('\n');

  return <style dangerouslySetInnerHTML={{ __html: cssRules }} />;
}

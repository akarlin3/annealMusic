import { SineEngine } from '@/audio/engines/sine';

/**
 * The identical-ω **chimera voice** — a self-morphing timbre.
 *
 * Sound generation is the *same additive partial bank* as the sine engine (so
 * it reuses the production fusion-gain path verbatim). What makes it a chimera
 * is the orchestrator's control-rate driver: when this engine is active, the
 * drift loop runs the seeded two-population Sakaguchi integrator
 * (`src/audio/chimera.ts`) instead of the spread-ω Kuramoto step, and maps the
 * two populations' coherence through the existing `fusion.ts` `m_i` law to these
 * partials' gains. As the chimera breathes (and roles swap), the reinforced
 * band moves and the spectral centroid morphs on its own — an emergent,
 * self-morphing voice. A supervisor keeps it in the chimera basin over a long
 * session (see `ChimeraVoice`).
 *
 * Subclassing `SineEngine` keeps the spread-ω voices bit-identical: this only
 * changes the engine `id`; the bank, detune, and fusion-gain application are the
 * inherited, untouched sine implementation.
 */
export class ChimeraEngine extends SineEngine {
  constructor() {
    super('chimera');
  }
}

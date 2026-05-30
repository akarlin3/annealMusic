export type BellCategory =
  | 'Tibetan Bowl'
  | 'Crystal Bowl'
  | 'Zen Bell'
  | 'Temple Gong'
  | 'Carillon'
  | 'Synthesized';

export interface BellDef {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly license: string;
  readonly description: string;
  readonly category: BellCategory;
}

export const BELL_REGISTRY: readonly BellDef[] = [
  {
    id: 'tibetan_bowl_med',
    name: 'Tibetan Singing Bowl (Medium)',
    file: 'bells/tibetan_bowl_med.opus',
    license: 'CC0-1.0',
    description:
      'A traditional Tibetan singing bowl with a medium-pitch, rich harmonic resonance and slow amplitude beating.',
    category: 'Tibetan Bowl',
  },
  {
    id: 'tibetan_bowl_large',
    name: 'Tibetan Singing Bowl (Large)',
    file: 'bells/tibetan_bowl_large.opus',
    license: 'CC0-1.0',
    description:
      'A deep, low-frequency Tibetan singing bowl with a slow, soothing amplitude warble ideal for grounding.',
    category: 'Tibetan Bowl',
  },
  {
    id: 'tibetan_bowl_small',
    name: 'Tibetan Singing Bowl (Small)',
    file: 'bells/tibetan_bowl_small.opus',
    license: 'CC0-1.0',
    description:
      'A higher-pitched, bright Tibetan singing bowl. Delivers a clean, resonant warble that gently punctuates the air.',
    category: 'Tibetan Bowl',
  },
  {
    id: 'crystal_bowl_c',
    name: 'Crystal Singing Bowl (C)',
    file: 'bells/crystal_bowl_c.opus',
    license: 'CC0-1.0',
    description:
      'A pure quartz crystal singing bowl tuned to C (256 Hz). Glassy, continuous tone with a subtle, shimmering LFO vibrato.',
    category: 'Crystal Bowl',
  },
  {
    id: 'crystal_bowl_f',
    name: 'Crystal Singing Bowl (F)',
    file: 'bells/crystal_bowl_f.opus',
    license: 'CC0-1.0',
    description:
      'A quartz crystal singing bowl tuned to F (341.3 Hz). Beautiful, highly transparent tone that decays smoothly.',
    category: 'Crystal Bowl',
  },
  {
    id: 'zen_bell_rin',
    name: 'Zen Meditation Bell (Rin)',
    file: 'bells/zen_bell_rin.opus',
    license: 'CC0-1.0',
    description:
      'A traditional Japanese meditation rin. Produces a bright, wooden mallet strike followed by a deep, long-lasting harmonic resonance.',
    category: 'Zen Bell',
  },
  {
    id: 'temple_gong',
    name: 'Deep Temple Gong',
    file: 'bells/temple_gong.opus',
    license: 'CC0-1.0',
    description:
      'A large bronze temple gong. Characterized by a powerful, complex strike and a deep, dark, rumbling vibration.',
    category: 'Temple Gong',
  },
  {
    id: 'carillon_big',
    name: 'Carillon Bell (Big)',
    file: 'bells/carillon_big.opus',
    license: 'CC0-1.0',
    description:
      'A heavy cast-bronze carillon bell. Follows the classical Western bell harmonic profile with a minor-third hum.',
    category: 'Carillon',
  },
  {
    id: 'carillon_small',
    name: 'Carillon Bell (Small)',
    file: 'bells/carillon_small.opus',
    license: 'CC0-1.0',
    description:
      'A light cast-bronze carillon bell. Bright, cheerful chime with a clean strike and short, sparkling release.',
    category: 'Carillon',
  },
  {
    id: 'synth_fm_bell',
    name: 'FM Resonator (Synth)',
    file: 'bells/synth_fm_bell.opus',
    license: 'CC0-1.0',
    description:
      'A synthesized FM resonator preset. Non-acoustic option designed for a clean, futuristic chime with perfect harmonic control.',
    category: 'Synthesized',
  },
  {
    id: 'synth_pluck',
    name: 'Pluck Resonator (Synth)',
    file: 'bells/synth_pluck.opus',
    license: 'CC0-1.0',
    description:
      'A synthesized pluck resonator preset. Simulates a plucked metal bar strike with a warm, modern digital decay.',
    category: 'Synthesized',
  },
  {
    id: 'synth_hollow',
    name: 'Hollow Chime (Synth)',
    file: 'bells/synth_hollow.opus',
    license: 'CC0-1.0',
    description:
      'A synthesized hollow square-wave chime preset. Delivers a wooden, organic, but clearly digital tone.',
    category: 'Synthesized',
  },
];

export function getBellById(id: string): BellDef | undefined {
  return BELL_REGISTRY.find((b) => b.id === id);
}

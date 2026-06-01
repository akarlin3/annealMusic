import type { EngineId } from '@/audio/engines/types';
import type { AnnealMusicParams } from '@/state/params';

export interface MusicPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly engineId: EngineId;
  /** Presets exclude 'volume' to respect the user's personal listening level. */
  readonly params: Omit<AnnealMusicParams, 'volume'>;
  readonly engineParams?: Record<string, number>;
}

export interface PresetCategory {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly presets: readonly MusicPreset[];
}

export const PRESET_CATEGORIES: readonly PresetCategory[] = [
  {
    id: 'ambient-space',
    name: 'Ambient & Space',
    description:
      'Deep, airy, and expansive soundscapes for comfort, sleep, and star-gazing.',
    presets: [
      {
        id: 'cosmic-hum',
        name: 'Cosmic Hum',
        description:
          'Deep, slow-breathing waves of sound designed for comforting relaxation.',
        engineId: 'sine',
        params: {
          rootFreq: 55,
          spread: 0.75,
          density: 4,
          coupling: 0.8,
          drift: 0.3,
          brightness: 0.2,
          space: 0.6,
        },
      },
      {
        id: 'cosmic-cathedral',
        name: 'Cosmic Cathedral',
        description:
          'Vast, starry halls filled with shimmering glassy tones echoing infinitely.',
        engineId: 'sine',
        params: {
          rootFreq: 110,
          spread: 1.05,
          density: 7,
          coupling: 0.6,
          drift: 0.5,
          brightness: 0.45,
          space: 0.85,
        },
      },
      {
        id: 'stellar-nursery',
        name: 'Stellar Nursery',
        description:
          'Gentle, high-pitched newborn stars drifting in deep space.',
        engineId: 'sine',
        params: {
          rootFreq: 220,
          spread: 1.25,
          density: 5,
          coupling: 0.7,
          drift: 0.4,
          brightness: 0.6,
          space: 0.9,
        },
      },
      {
        id: 'andromeda-void',
        name: 'Andromeda Void',
        description:
          'Low, hollow sub-bass drone mirroring the cold, quiet expanse of a galaxy.',
        engineId: 'sine',
        params: {
          rootFreq: 40,
          spread: 0.5,
          density: 3,
          coupling: 0.9,
          drift: 0.2,
          brightness: 0.1,
          space: 0.7,
        },
      },
      {
        id: 'nebula-dust',
        name: 'Nebula Dust',
        description:
          'Soft, sparkling clouds of ambient dust slowly folding over each other.',
        engineId: 'sine',
        params: {
          rootFreq: 130,
          spread: 1.4,
          density: 6,
          coupling: 0.55,
          drift: 0.6,
          brightness: 0.5,
          space: 0.8,
        },
      },
      {
        id: 'aurora-glow',
        name: 'Aurora Glow',
        description:
          'Warm, sweeping waves of light that shift across the night sky.',
        engineId: 'sine',
        params: {
          rootFreq: 82,
          spread: 0.9,
          density: 5,
          coupling: 0.85,
          drift: 0.5,
          brightness: 0.35,
          space: 0.75,
        },
      },
      {
        id: 'lunar-cradle',
        name: 'Lunar Cradle',
        description:
          'A soft, protective ambient envelope that feels like weightless sleep.',
        engineId: 'granular',
        params: {
          rootFreq: 65,
          spread: 0.8,
          density: 4,
          coupling: 0.95,
          drift: 0.25,
          brightness: 0.25,
          space: 0.8,
        },
        engineParams: {
          source: 4, // Deep Drone
          size: 0.4,
          density: 40,
          posJitter: 0.2,
          pitchJitter: 0.01,
          posCenter: 0.5,
        },
      },
      {
        id: 'solar-flare-ambient',
        name: 'Solar Flare',
        description:
          'Gentle but energized solar winds swelling and glowing at high frequencies.',
        engineId: 'fm',
        params: {
          rootFreq: 196,
          spread: 1.1,
          density: 5,
          coupling: 0.75,
          drift: 0.6,
          brightness: 0.6,
          space: 0.7,
        },
        engineParams: {
          modRatio: 2.0,
          modIndex: 2.5,
          feedback: 0.1,
        },
      },
      {
        id: 'black-hole-horizon',
        name: 'Black Hole Horizon',
        description:
          'A heavy, gravity-warped bass soundscape that bends time and pitch.',
        engineId: 'sine',
        params: {
          rootFreq: 36,
          spread: 0.6,
          density: 4,
          coupling: 0.95,
          drift: 0.7,
          brightness: 0.15,
          space: 0.8,
        },
      },
      {
        id: 'zen-garden',
        name: 'Zen Garden',
        description:
          'Absolute simplicity, deep quiet breaths, and maximum mental clarity.',
        engineId: 'sine',
        params: {
          rootFreq: 98,
          spread: 1.0,
          density: 3,
          coupling: 0.5,
          drift: 0.2,
          brightness: 0.3,
          space: 0.65,
        },
      },
      {
        id: 'chimera-drift',
        name: 'Chimera Drift',
        description:
          'A self-morphing tone that breathes on its own — a seeded two-population chimera slowly reshapes the timbre. Gentle by default; raise Intensity for a deeper morph.',
        engineId: 'chimera',
        params: {
          rootFreq: 110,
          spread: 1.0,
          density: 6,
          coupling: 0.6,
          drift: 0.3,
          brightness: 0.3,
          space: 0.7,
        },
      },
    ],
  },
  {
    id: 'metallic-bell',
    name: 'Metallic & Bell',
    description:
      'Vibrant, metal-resonant, and bell-like vibrations that echo and chime.',
    presets: [
      {
        id: 'tibetan-bowls',
        name: 'Tibetan Bowls',
        description:
          'Rich, metallic vibrations simulating peaceful singing bowls in a quiet sanctuary.',
        engineId: 'fm',
        params: {
          rootFreq: 87,
          spread: 1.15,
          density: 5,
          coupling: 0.25,
          drift: 0.7,
          brightness: 0.6,
          space: 0.75,
        },
        engineParams: {
          modRatio: 2.02,
          modIndex: 3.5,
          feedback: 0.3,
        },
      },
      {
        id: 'sacred-temple-bell',
        name: 'Sacred Temple Bell',
        description:
          'A single deep strike that blooms into rich, harmonic metallic layers.',
        engineId: 'fm',
        params: {
          rootFreq: 60,
          spread: 1.5,
          density: 6,
          coupling: 0.3,
          drift: 0.4,
          brightness: 0.55,
          space: 0.85,
        },
        engineParams: {
          modRatio: 1.5,
          modIndex: 5.0,
          feedback: 0.45,
        },
      },
      {
        id: 'crystal-cascade',
        name: 'Crystal Cascade',
        description:
          'Tiny, delicate glass bells ringing together in a light wind.',
        engineId: 'fm',
        params: {
          rootFreq: 261,
          spread: 1.6,
          density: 7,
          coupling: 0.2,
          drift: 0.8,
          brightness: 0.8,
          space: 0.9,
        },
        engineParams: {
          modRatio: 4.01,
          modIndex: 8.0,
          feedback: 0.2,
        },
      },
      {
        id: 'wind-chimes',
        name: 'Wind Chimes',
        description:
          'Gentle metal tubes chiming randomly in a warm summer breeze.',
        engineId: 'physical',
        params: {
          rootFreq: 180,
          spread: 1.45,
          density: 6,
          coupling: 0.15,
          drift: 0.85,
          brightness: 0.75,
          space: 0.8,
        },
        engineParams: {
          model: 2, // Plate
          excitationLevel: 0.7,
          damping: 0.25,
          inharm: 0.6,
          brightness: 0.7,
        },
      },
      {
        id: 'clockwork-dream',
        name: 'Clockwork Dream',
        description:
          'Intricate, rhythmic-like metallic ticks and bell tones folding into each other.',
        engineId: 'fm',
        params: {
          rootFreq: 110,
          spread: 1.25,
          density: 6,
          coupling: 0.4,
          drift: 0.75,
          brightness: 0.65,
          space: 0.6,
        },
        engineParams: {
          modRatio: 3.14,
          modIndex: 6.0,
          feedback: 0.35,
        },
      },
      {
        id: 'ringing-gongs',
        name: 'Ringing Gongs',
        description:
          'Sparsely struck resonant plates generating a mysterious, cavernous metallic ring.',
        engineId: 'physical',
        params: {
          rootFreq: 65,
          spread: 1.3,
          density: 4,
          coupling: 0.15,
          drift: 0.9,
          brightness: 0.7,
          space: 0.9,
        },
        engineParams: {
          model: 2, // Plate
          excitationLevel: 0.9,
          damping: 0.15,
          inharm: 0.75,
          brightness: 0.65,
        },
      },
      {
        id: 'marimba-rain',
        name: 'Marimba Rain',
        description:
          'Dampened wooden and metal bars chiming gently in a rhythmic trickle.',
        engineId: 'physical',
        params: {
          rootFreq: 120,
          spread: 1.1,
          density: 5,
          coupling: 0.3,
          drift: 0.6,
          brightness: 0.5,
          space: 0.75,
        },
        engineParams: {
          model: 2, // Plate
          excitationLevel: 0.8,
          damping: 0.5,
          inharm: 0.3,
          brightness: 0.45,
        },
      },
      {
        id: 'cyber-glockenspiel',
        name: 'Cyber Glockenspiel',
        description:
          'Futuristic, pristine, synthesized metal chimes with a clean modern ring.',
        engineId: 'fm',
        params: {
          rootFreq: 320,
          spread: 1.35,
          density: 6,
          coupling: 0.25,
          drift: 0.65,
          brightness: 0.75,
          space: 0.85,
        },
        engineParams: {
          modRatio: 5.0,
          modIndex: 4.5,
          feedback: 0.1,
        },
      },
      {
        id: 'singing-iron',
        name: 'Singing Iron',
        description:
          'A continuous, bow-scraped iron wire humming with intense resonance.',
        engineId: 'fm',
        params: {
          rootFreq: 73,
          spread: 0.95,
          density: 4,
          coupling: 0.5,
          drift: 0.5,
          brightness: 0.7,
          space: 0.8,
        },
        engineParams: {
          modRatio: 1.01,
          modIndex: 9.0,
          feedback: 0.6,
        },
      },
      {
        id: 'frozen-spire',
        name: 'Frozen Spire',
        description:
          'A sharp, ice-cold chime reflecting bright light off a high peak.',
        engineId: 'physical',
        params: {
          rootFreq: 200,
          spread: 1.5,
          density: 5,
          coupling: 0.2,
          drift: 0.7,
          brightness: 0.8,
          space: 0.9,
        },
        engineParams: {
          model: 2, // Plate
          excitationLevel: 0.85,
          damping: 0.2,
          inharm: 0.8,
          brightness: 0.75,
        },
      },
    ],
  },
  {
    id: 'organic-textural',
    name: 'Organic & Textural',
    description:
      'Earthy, grainy, and textured sounds built from real-world acoustic grains.',
    presets: [
      {
        id: 'autumn-rain',
        name: 'Autumn Rain',
        description:
          'Organic clouds of gentle, sparse raindrops pattering on window glass.',
        engineId: 'granular',
        params: {
          rootFreq: 98,
          spread: 1.2,
          density: 5,
          coupling: 0.4,
          drift: 0.65,
          brightness: 0.5,
          space: 0.7,
        },
        engineParams: {
          source: 6, // Rain Glass
          size: 0.15,
          density: 60,
          posJitter: 0.8,
          pitchJitter: 0.05,
          posCenter: 0.4,
        },
      },
      {
        id: 'forest-whispers',
        name: 'Forest Whispers',
        description:
          'Rustling dry leaves and soft wind filtering through pine branches.',
        engineId: 'granular',
        params: {
          rootFreq: 110,
          spread: 1.3,
          density: 6,
          coupling: 0.5,
          drift: 0.7,
          brightness: 0.4,
          space: 0.65,
        },
        engineParams: {
          source: 3, // Pine Wind
          size: 0.25,
          density: 55,
          posJitter: 0.7,
          pitchJitter: 0.08,
          posCenter: 0.35,
        },
      },
      {
        id: 'warm-hearth',
        name: 'Warm Hearth',
        description:
          'Cozy, crackling fireplace embers glowing and sparking on a winter night.',
        engineId: 'granular',
        params: {
          rootFreq: 65,
          spread: 0.9,
          density: 5,
          coupling: 0.6,
          drift: 0.5,
          brightness: 0.45,
          space: 0.5,
        },
        engineParams: {
          source: 7, // Warm Tape
          size: 0.12,
          density: 70,
          posJitter: 0.9,
          pitchJitter: 0.15,
          posCenter: 0.2,
        },
      },
      {
        id: 'ocean-froth',
        name: 'Ocean Froth',
        description:
          'Gentle waves washing over pebbles on a shoreline, fading into white foam.',
        engineId: 'granular',
        params: {
          rootFreq: 73,
          spread: 1.15,
          density: 4,
          coupling: 0.8,
          drift: 0.8,
          brightness: 0.3,
          space: 0.8,
        },
        engineParams: {
          source: 1, // Bowed Metal
          size: 0.3,
          density: 45,
          posJitter: 0.65,
          pitchJitter: 0.04,
          posCenter: 0.6,
        },
      },
      {
        id: 'cicada-dusk',
        name: 'Cicada Dusk',
        description:
          'High, buzzing summer insect choir chanting in the twilight heat.',
        engineId: 'fm',
        params: {
          rootFreq: 300,
          spread: 1.4,
          density: 5,
          coupling: 0.6,
          drift: 0.7,
          brightness: 0.7,
          space: 0.6,
        },
        engineParams: {
          modRatio: 8.5,
          modIndex: 3.0,
          feedback: 0.5,
        },
      },
      {
        id: 'breathing-organ',
        name: 'Breathing Organ',
        description:
          'A warm, breathy, and vintage tape-saturated organ rising and falling like breath.',
        engineId: 'granular',
        params: {
          rootFreq: 110,
          spread: 0.95,
          density: 7,
          coupling: 0.75,
          drift: 0.45,
          brightness: 0.65,
          space: 0.6,
        },
        engineParams: {
          source: 2, // Tape Organ
          size: 0.28,
          density: 50,
          posJitter: 0.3,
          pitchJitter: 0.02,
          posCenter: 0.5,
        },
      },
      {
        id: 'ghostly-chorus',
        name: 'Ghostly Chorus',
        description:
          'Ethereal, ancient vocal whispers echoing from a long-lost cathedral.',
        engineId: 'granular',
        params: {
          rootFreq: 130,
          spread: 1.05,
          density: 5,
          coupling: 0.7,
          drift: 0.5,
          brightness: 0.5,
          space: 0.85,
        },
        engineParams: {
          source: 5, // Choir Air
          size: 0.35,
          density: 45,
          posJitter: 0.5,
          pitchJitter: 0.03,
          posCenter: 0.45,
        },
      },
      {
        id: 'windy-shore',
        name: 'Windy Shore',
        description:
          'Rushing air sweeps that swell and sigh over rolling sand dunes.',
        engineId: 'granular',
        params: {
          rootFreq: 55,
          spread: 1.25,
          density: 4,
          coupling: 0.75,
          drift: 0.75,
          brightness: 0.35,
          space: 0.75,
        },
        engineParams: {
          source: 3, // Pine Wind
          size: 0.35,
          density: 50,
          posJitter: 0.8,
          pitchJitter: 0.1,
          posCenter: 0.5,
        },
      },
      {
        id: 'subterranean-stream',
        name: 'Subterranean Stream',
        description:
          'Trickles of water dripping in a deep, damp limestone cave.',
        engineId: 'granular',
        params: {
          rootFreq: 87,
          spread: 1.35,
          density: 5,
          coupling: 0.35,
          drift: 0.6,
          brightness: 0.45,
          space: 0.8,
        },
        engineParams: {
          source: 0, // Glass Pad
          size: 0.18,
          density: 65,
          posJitter: 0.75,
          pitchJitter: 0.05,
          posCenter: 0.3,
        },
      },
      {
        id: 'vintage-vinyl',
        name: 'Vintage Vinyl',
        description:
          'A dusty, warm crackle overlaying a nostalgic, slow-moving melody.',
        engineId: 'granular',
        params: {
          rootFreq: 110,
          spread: 0.85,
          density: 6,
          coupling: 0.8,
          drift: 0.4,
          brightness: 0.4,
          space: 0.6,
        },
        engineParams: {
          source: 7, // Warm Tape
          size: 0.22,
          density: 55,
          posJitter: 0.4,
          pitchJitter: 0.04,
          posCenter: 0.5,
        },
      },
    ],
  },
  {
    id: 'cinematic-orchestral',
    name: 'Cinematic & Orchestral',
    description:
      'Expressive bowed strings, wind chambers, and deep cinematic instrumentation.',
    presets: [
      {
        id: 'string-quartet',
        name: 'String Quartet',
        description:
          'Rich, resonant bowed strings modeled after acoustic instruments playing in unison.',
        engineId: 'physical',
        params: {
          rootFreq: 73,
          spread: 0.92,
          density: 6,
          coupling: 0.65,
          drift: 0.5,
          brightness: 0.4,
          space: 0.8,
        },
        engineParams: {
          model: 0, // String
          excitationLevel: 0.85,
          damping: 0.35,
          brightness: 0.5,
        },
      },
      {
        id: 'cello-soliloquy',
        name: 'Cello Soliloquy',
        description:
          'A deep, warm, and expressive string solo crying in a dark hall.',
        engineId: 'physical',
        params: {
          rootFreq: 55,
          spread: 0.85,
          density: 4,
          coupling: 0.7,
          drift: 0.4,
          brightness: 0.3,
          space: 0.75,
        },
        engineParams: {
          model: 0, // String
          excitationLevel: 0.9,
          damping: 0.4,
          brightness: 0.45,
        },
      },
      {
        id: 'lost-cathedral-organ',
        name: 'Lost Cathedral Organ',
        description:
          'A majestic, ancient church organ breathing grand, dusty wind tones.',
        engineId: 'physical',
        params: {
          rootFreq: 82,
          spread: 0.95,
          density: 7,
          coupling: 0.8,
          drift: 0.35,
          brightness: 0.5,
          space: 0.85,
        },
        engineParams: {
          model: 1, // Tube
          excitationLevel: 0.8,
          damping: 0.3,
          reed: 0.6,
          brightness: 0.55,
        },
      },
      {
        id: 'elven-woodwinds',
        name: 'Elven Woodwinds',
        description:
          'Sweet, breathy wooden flutes singing soft melodies in a sunlit forest.',
        engineId: 'physical',
        params: {
          rootFreq: 220,
          spread: 1.05,
          density: 4,
          coupling: 0.6,
          drift: 0.6,
          brightness: 0.6,
          space: 0.7,
        },
        engineParams: {
          model: 1, // Tube
          excitationLevel: 0.75,
          damping: 0.45,
          reed: 0.3,
          brightness: 0.5,
        },
      },
      {
        id: 'brass-swell',
        name: 'Brass Swell',
        description:
          'Powerful, warm brassy fanfares that slowly peak and resolve.',
        engineId: 'fm',
        params: {
          rootFreq: 110,
          spread: 0.98,
          density: 5,
          coupling: 0.8,
          drift: 0.45,
          brightness: 0.55,
          space: 0.7,
        },
        engineParams: {
          modRatio: 1.0,
          modIndex: 4.5,
          feedback: 0.25,
        },
      },
      {
        id: 'symphonic-haze',
        name: 'Symphonic Haze',
        description:
          'A massive, blurred orchestral chord frozen in time and space.',
        engineId: 'granular',
        params: {
          rootFreq: 65,
          spread: 0.92,
          density: 7,
          coupling: 0.9,
          drift: 0.3,
          brightness: 0.5,
          space: 0.9,
        },
        engineParams: {
          source: 2, // Tape Organ
          size: 0.35,
          density: 60,
          posJitter: 0.5,
          pitchJitter: 0.03,
          posCenter: 0.4,
        },
      },
      {
        id: 'bowed-glass',
        name: 'Bowed Glass',
        description:
          'Ethereal friction sounds of glass rods played with a cello bow.',
        engineId: 'physical',
        params: {
          rootFreq: 147,
          spread: 1.2,
          density: 5,
          coupling: 0.5,
          drift: 0.6,
          brightness: 0.65,
          space: 0.85,
        },
        engineParams: {
          model: 0, // String
          excitationLevel: 0.75,
          damping: 0.2,
          brightness: 0.6,
        },
      },
      {
        id: 'monastery-drone',
        name: 'Monastery Drone',
        description:
          'Deep, resonant throat-singing-like wind pipes vibrating in unison.',
        engineId: 'physical',
        params: {
          rootFreq: 65,
          spread: 0.96,
          density: 6,
          coupling: 0.85,
          drift: 0.4,
          brightness: 0.4,
          space: 0.8,
        },
        engineParams: {
          model: 1, // Tube
          excitationLevel: 0.9,
          damping: 0.35,
          reed: 0.7,
          brightness: 0.45,
        },
      },
      {
        id: 'pizzicato-rain',
        name: 'Pizzicato Rain',
        description:
          'Light, plucked strings playing high-pitched staccato drops.',
        engineId: 'physical',
        params: {
          rootFreq: 130,
          spread: 1.3,
          density: 5,
          coupling: 0.25,
          drift: 0.7,
          brightness: 0.55,
          space: 0.65,
        },
        engineParams: {
          model: 0, // String
          excitationLevel: 0.8,
          damping: 0.75,
          brightness: 0.4,
        },
      },
      {
        id: 'cinematic-rise',
        name: 'Cinematic Rise',
        description:
          'A tense, building wave of string and brass harmonics rising to a grand climax.',
        engineId: 'fm',
        params: {
          rootFreq: 82,
          spread: 1.12,
          density: 6,
          coupling: 0.7,
          drift: 0.8,
          brightness: 0.7,
          space: 0.75,
        },
        engineParams: {
          modRatio: 2.5,
          modIndex: 8.0,
          feedback: 0.4,
        },
      },
    ],
  },
  {
    id: 'experimental-drone',
    name: 'Experimental & Drone',
    description:
      'Restless analog modulations, starship warp cores, and industrial mechanical hums.',
    presets: [
      {
        id: 'solar-wind',
        name: 'Solar Wind',
        description:
          'Active, crisp, and bright electronic waves that sweep together.',
        engineId: 'fm',
        params: {
          rootFreq: 130,
          spread: 0.88,
          density: 6,
          coupling: 0.9,
          drift: 0.8,
          brightness: 0.75,
          space: 0.5,
        },
        engineParams: {
          modRatio: 1.41,
          modIndex: 6.5,
          feedback: 0.5,
        },
      },
      {
        id: 'modular-chaos',
        name: 'Modular Chaos',
        description:
          'Unpredictable, self-modulating analog synth nodes bubbling and screaming.',
        engineId: 'fm',
        params: {
          rootFreq: 98,
          spread: 1.45,
          density: 5,
          coupling: 0.2,
          drift: 0.9,
          brightness: 0.7,
          space: 0.6,
        },
        engineParams: {
          modRatio: 3.73,
          modIndex: 12.0,
          feedback: 0.85,
        },
      },
      {
        id: 'industrial-pulse',
        name: 'Industrial Pulse',
        description:
          'Dark, heavy machine hums radiating low-frequency mechanical energy.',
        engineId: 'fm',
        params: {
          rootFreq: 48,
          spread: 0.7,
          density: 4,
          coupling: 0.8,
          drift: 0.5,
          brightness: 0.3,
          space: 0.65,
        },
        engineParams: {
          modRatio: 1.0,
          modIndex: 7.5,
          feedback: 0.7,
        },
      },
      {
        id: 'radio-static',
        name: 'Radio Static',
        description:
          'Shortwave signals drifting in and out of cosmic electromagnetic interference.',
        engineId: 'granular',
        params: {
          rootFreq: 87,
          spread: 1.5,
          density: 5,
          coupling: 0.3,
          drift: 0.85,
          brightness: 0.6,
          space: 0.7,
        },
        engineParams: {
          source: 7, // Warm Tape
          size: 0.08,
          density: 80,
          posJitter: 0.95,
          pitchJitter: 0.3,
          posCenter: 0.5,
        },
      },
      {
        id: 'pulsar-beacon',
        name: 'Pulsar Beacon',
        description:
          'A rhythmic, high-frequency radar sweep from a spinning neutron star.',
        engineId: 'fm',
        params: {
          rootFreq: 160,
          spread: 1.1,
          density: 4,
          coupling: 0.9,
          drift: 0.6,
          brightness: 0.65,
          space: 0.8,
        },
        engineParams: {
          modRatio: 6.0,
          modIndex: 5.5,
          feedback: 0.4,
        },
      },
      {
        id: 'submarine-ping',
        name: 'Submarine Ping',
        description:
          'A deep sonar sound traveling through miles of cold, black ocean water.',
        engineId: 'fm',
        params: {
          rootFreq: 220,
          spread: 1.8,
          density: 3,
          coupling: 0.1,
          drift: 0.4,
          brightness: 0.75,
          space: 0.95,
        },
        engineParams: {
          modRatio: 10.0,
          modIndex: 14.0,
          feedback: 0.1,
        },
      },
      {
        id: 'warp-engine',
        name: 'Warp Engine',
        description:
          'The deep, vibrating drone of a starship core running at maximum capacity.',
        engineId: 'fm',
        params: {
          rootFreq: 45,
          spread: 0.65,
          density: 5,
          coupling: 0.85,
          drift: 0.3,
          brightness: 0.25,
          space: 0.7,
        },
        engineParams: {
          modRatio: 1.5,
          modIndex: 8.0,
          feedback: 0.75,
        },
      },
      {
        id: 'lava-bubbles',
        name: 'Lava Bubbles',
        description: 'Thick, slow mud and volcanic gases boiling and popping.',
        engineId: 'granular',
        params: {
          rootFreq: 60,
          spread: 1.25,
          density: 4,
          coupling: 0.4,
          drift: 0.7,
          brightness: 0.35,
          space: 0.6,
        },
        engineParams: {
          source: 1, // Bowed Metal
          size: 0.15,
          density: 65,
          posJitter: 0.85,
          pitchJitter: 0.12,
          posCenter: 0.3,
        },
      },
      {
        id: 'alien-broadcast',
        name: 'Alien Broadcast',
        description:
          'Strange, sliding alien syllables picked up by a radio telescope.',
        engineId: 'fm',
        params: {
          rootFreq: 140,
          spread: 1.35,
          density: 5,
          coupling: 0.5,
          drift: 0.8,
          brightness: 0.6,
          space: 0.7,
        },
        engineParams: {
          modRatio: 2.71,
          modIndex: 10.5,
          feedback: 0.5,
        },
      },
      {
        id: 'neon-dystopia',
        name: 'Neon Dystopia',
        description:
          'A gritty, retro-futuristic synth wave singing in a rain-slicked city.',
        engineId: 'fm',
        params: {
          rootFreq: 65,
          spread: 0.9,
          density: 6,
          coupling: 0.75,
          drift: 0.6,
          brightness: 0.55,
          space: 0.65,
        },
        engineParams: {
          modRatio: 2.0,
          modIndex: 7.0,
          feedback: 0.5,
        },
      },
    ],
  },
];

export const PRESET_SOUNDS: readonly MusicPreset[] = PRESET_CATEGORIES.flatMap(
  (cat) => cat.presets,
);

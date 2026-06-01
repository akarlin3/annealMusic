// presets.jsx — the engine + patch bank (from src/content/presets.ts, docs/MODELS.md)
// The live prototype renders everything through the additive (sine) core; engine
// badges reflect each patch's intended synthesis model.

const ENGINES = {
  sine:     { id: 'sine',     label: 'Additive', blurb: 'Stacked sine partials over the harmonic lattice.' },
  fm:       { id: 'fm',       label: 'FM',       blurb: 'Frequency modulation — metallic, bell-like, vocal.' },
  granular: { id: 'granular', label: 'Granular', blurb: 'Clouds of grains from real-world recordings.' },
  physical: { id: 'physical', label: 'Physical', blurb: 'Continuously-excited string, tube & plate models.' },
};
const ENGINE_ORDER = ['sine', 'fm', 'granular', 'physical'];

const PRESET_CATEGORIES = [
  { id: 'ambient-space', name: 'Ambient & Space', description: 'Deep, airy, expansive soundscapes for comfort and sleep.', presets: [
    { id: 'cosmic-hum', name: 'Cosmic Hum', engineId: 'sine', description: 'Deep, slow-breathing waves of sound for comforting relaxation.', params: { rootFreq: 55, spread: 0.75, density: 4, coupling: 0.8, drift: 0.3, brightness: 0.2, space: 0.6 } },
    { id: 'cosmic-cathedral', name: 'Cosmic Cathedral', engineId: 'sine', description: 'Vast starry halls filled with shimmering glassy tones.', params: { rootFreq: 110, spread: 1.05, density: 7, coupling: 0.6, drift: 0.5, brightness: 0.45, space: 0.85 } },
    { id: 'stellar-nursery', name: 'Stellar Nursery', engineId: 'sine', description: 'Gentle high-pitched newborn stars drifting in deep space.', params: { rootFreq: 220, spread: 1.25, density: 5, coupling: 0.7, drift: 0.4, brightness: 0.6, space: 0.9 } },
    { id: 'nebula-dust', name: 'Nebula Dust', engineId: 'sine', description: 'Soft sparkling clouds of ambient dust slowly folding over.', params: { rootFreq: 130, spread: 1.4, density: 6, coupling: 0.55, drift: 0.6, brightness: 0.5, space: 0.8 } },
    { id: 'zen-garden', name: 'Zen Garden', engineId: 'sine', description: 'Absolute simplicity, deep quiet breaths, maximum clarity.', params: { rootFreq: 98, spread: 1.0, density: 3, coupling: 0.5, drift: 0.2, brightness: 0.3, space: 0.65 } },
  ]},
  { id: 'metallic-bell', name: 'Metallic & Bell', description: 'Vibrant, metal-resonant, bell-like vibrations that chime.', presets: [
    { id: 'tibetan-bowls', name: 'Tibetan Bowls', engineId: 'fm', description: 'Rich metallic vibrations of singing bowls in a sanctuary.', params: { rootFreq: 87, spread: 1.15, density: 5, coupling: 0.25, drift: 0.7, brightness: 0.6, space: 0.75 } },
    { id: 'sacred-temple-bell', name: 'Sacred Temple Bell', engineId: 'fm', description: 'A single deep strike blooming into harmonic metallic layers.', params: { rootFreq: 60, spread: 1.5, density: 6, coupling: 0.3, drift: 0.4, brightness: 0.55, space: 0.85 } },
    { id: 'crystal-cascade', name: 'Crystal Cascade', engineId: 'fm', description: 'Tiny delicate glass bells ringing together in a light wind.', params: { rootFreq: 261, spread: 1.6, density: 7, coupling: 0.2, drift: 0.8, brightness: 0.8, space: 0.9 } },
    { id: 'wind-chimes', name: 'Wind Chimes', engineId: 'physical', description: 'Gentle metal tubes chiming randomly in a summer breeze.', params: { rootFreq: 180, spread: 1.45, density: 6, coupling: 0.15, drift: 0.85, brightness: 0.75, space: 0.8 } },
    { id: 'ringing-gongs', name: 'Ringing Gongs', engineId: 'physical', description: 'Sparsely struck plates with a mysterious cavernous ring.', params: { rootFreq: 65, spread: 1.3, density: 4, coupling: 0.15, drift: 0.9, brightness: 0.7, space: 0.9 } },
  ]},
  { id: 'organic-textural', name: 'Organic & Textural', description: 'Earthy, grainy sounds built from real-world acoustic grains.', presets: [
    { id: 'autumn-rain', name: 'Autumn Rain', engineId: 'granular', description: 'Organic clouds of gentle raindrops pattering on glass.', params: { rootFreq: 98, spread: 1.2, density: 5, coupling: 0.4, drift: 0.65, brightness: 0.5, space: 0.7 } },
    { id: 'forest-whispers', name: 'Forest Whispers', engineId: 'granular', description: 'Rustling dry leaves and soft wind through pine branches.', params: { rootFreq: 110, spread: 1.3, density: 6, coupling: 0.5, drift: 0.7, brightness: 0.4, space: 0.65 } },
    { id: 'warm-hearth', name: 'Warm Hearth', engineId: 'granular', description: 'Cozy crackling fireplace embers on a winter night.', params: { rootFreq: 65, spread: 0.9, density: 5, coupling: 0.6, drift: 0.5, brightness: 0.45, space: 0.5 } },
    { id: 'ocean-froth', name: 'Ocean Froth', engineId: 'granular', description: 'Gentle waves washing over pebbles, fading into foam.', params: { rootFreq: 73, spread: 1.15, density: 4, coupling: 0.8, drift: 0.8, brightness: 0.3, space: 0.8 } },
    { id: 'ghostly-chorus', name: 'Ghostly Chorus', engineId: 'granular', description: 'Ethereal ancient vocal whispers from a lost cathedral.', params: { rootFreq: 130, spread: 1.05, density: 5, coupling: 0.7, drift: 0.5, brightness: 0.5, space: 0.85 } },
  ]},
  { id: 'cinematic-orchestral', name: 'Cinematic & Orchestral', description: 'Bowed strings, wind chambers, and deep instrumentation.', presets: [
    { id: 'string-quartet', name: 'String Quartet', engineId: 'physical', description: 'Rich resonant bowed strings playing in unison.', params: { rootFreq: 73, spread: 0.92, density: 6, coupling: 0.65, drift: 0.5, brightness: 0.4, space: 0.8 } },
    { id: 'cello-soliloquy', name: 'Cello Soliloquy', engineId: 'physical', description: 'A deep warm expressive string solo crying in a dark hall.', params: { rootFreq: 55, spread: 0.85, density: 4, coupling: 0.7, drift: 0.4, brightness: 0.3, space: 0.75 } },
    { id: 'lost-cathedral-organ', name: 'Lost Cathedral Organ', engineId: 'physical', description: 'A majestic ancient church organ breathing grand wind tones.', params: { rootFreq: 82, spread: 0.95, density: 7, coupling: 0.8, drift: 0.35, brightness: 0.5, space: 0.85 } },
    { id: 'brass-swell', name: 'Brass Swell', engineId: 'fm', description: 'Powerful warm brassy fanfares that slowly peak and resolve.', params: { rootFreq: 110, spread: 0.98, density: 5, coupling: 0.8, drift: 0.45, brightness: 0.55, space: 0.7 } },
    { id: 'bowed-glass', name: 'Bowed Glass', engineId: 'physical', description: 'Ethereal friction of glass rods played with a cello bow.', params: { rootFreq: 147, spread: 1.2, density: 5, coupling: 0.5, drift: 0.6, brightness: 0.65, space: 0.85 } },
  ]},
  { id: 'experimental-drone', name: 'Experimental & Drone', description: 'Restless analog modulations, warp cores, industrial hums.', presets: [
    { id: 'solar-wind', name: 'Solar Wind', engineId: 'fm', description: 'Active crisp bright electronic waves that sweep together.', params: { rootFreq: 130, spread: 0.88, density: 6, coupling: 0.9, drift: 0.8, brightness: 0.75, space: 0.5 } },
    { id: 'modular-chaos', name: 'Modular Chaos', engineId: 'fm', description: 'Unpredictable self-modulating analog nodes bubbling.', params: { rootFreq: 98, spread: 1.45, density: 5, coupling: 0.2, drift: 0.9, brightness: 0.7, space: 0.6 } },
    { id: 'industrial-pulse', name: 'Industrial Pulse', engineId: 'fm', description: 'Dark heavy machine hums radiating mechanical energy.', params: { rootFreq: 48, spread: 0.7, density: 4, coupling: 0.8, drift: 0.5, brightness: 0.3, space: 0.65 } },
    { id: 'warp-engine', name: 'Warp Engine', engineId: 'fm', description: 'The deep vibrating drone of a starship core at maximum.', params: { rootFreq: 45, spread: 0.65, density: 5, coupling: 0.85, drift: 0.3, brightness: 0.25, space: 0.7 } },
    { id: 'neon-dystopia', name: 'Neon Dystopia', engineId: 'fm', description: 'Gritty retro-futuristic synth wave in a rain-slicked city.', params: { rootFreq: 65, spread: 0.9, density: 6, coupling: 0.75, drift: 0.6, brightness: 0.55, space: 0.65 } },
  ]},
];

Object.assign(window, { ENGINES, ENGINE_ORDER, PRESET_CATEGORIES });

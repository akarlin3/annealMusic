/**
 * Single source of truth for every piece of newcomer-facing explanatory copy.
 *
 * Tooltips, always-visible captions, the Help panel, and the first-run tour all
 * read from this registry — no explanatory string is duplicated across surfaces.
 * If a control's caption and its tooltip ever disagree, that is a bug: they come
 * from the same entry here.
 *
 * Voice: a total first-timer with zero synthesis vocabulary. We describe what
 * you hear or do, never the underlying audio machinery. Banned words (oscillator,
 * partial, harmonic, granular, drift field jargon, etc.) never appear in any
 * field below.
 *
 * IDs are stable and composite:
 *   - shared sound controls .... their param key ('rootFreq', 'spread', …)
 *   - the engine switcher ....... 'engine'
 *   - per-engine identities ..... 'engine.<id>' ('engine.sine', …)
 *   - per-engine params ......... '<engineId>.<key>' ('fm.modRatio', …)
 *   - features & sub-controls ... see FEATURE_IDS below
 *
 * A Vitest (`explanations.test.ts`) derives the required control/engine ids from
 * the live schema and fails loudly if any lacks copy — adding a new control or
 * engine param is therefore a forcing function to write its explanation here.
 */

export type ExplainGroup =
  | 'sound'
  | 'engines'
  | 'arcs'
  | 'input'
  | 'loop'
  | 'record'
  | 'embed'
  | 'gallery'
  | 'share';

export interface Explain {
  /** Matches a control-schema key, engine id, or feature id. */
  id: string;
  /** Short UI label. */
  label: string;
  /** One line, always visible under a control. */
  caption: string;
  /** 1–3 sentences shown on the (?) hover/tap. */
  tooltip: string;
  /** Longer help-panel body — still in the newcomer voice. */
  help: string;
  group: ExplainGroup;
}

/** Build the composite id for an engine-specific param. */
export function engineParamId(engineId: string, key: string): string {
  return `${engineId}.${key}`;
}

/**
 * Feature- and sub-control ids that have no entry in the control schema and so
 * must be listed explicitly. The completeness test iterates this list too.
 */
export const FEATURE_IDS = [
  // Engines (the four characters + the switcher lives under 'engine')
  'engine.sine',
  'engine.fm',
  'engine.granular',
  'engine.physical',
  // Arcs / sessions
  'mode',
  'arc.preset',
  'arc.duration',
  // Live input
  'input.connect',
  'input.device',
  'input.level',
  'input.monitoring',
  'input.latency',
  // Loop pedal
  'loop.slot',
  'loop.freeze',
  'loop.grainSize',
  'loop.grainDensity',
  'loop.posJitter',
  'loop.pitchJitter',
  'loop.driftCoupled',
  // Recording
  'record.button',
  'record.format',
  'record.save',
  // Embed
  'embed.code',
  // Gallery & sharing
  'feature.gallery',
  'feature.share',
  // Presets
  'presets',
] as const;

/** The one-sentence pitch, mirrored by the README and the Help panel intro. */
export const ABOUT_INTRO =
  'AnnealMusic is a browser instrument that makes endless, slowly-shifting ambient soundscapes. Set a few sliders, press play, and let it drift — good for focus, sleep, or background calm.';

const ENTRIES: Explain[] = [
  // ── Core sound controls ────────────────────────────────────────────────
  {
    id: 'rootFreq',
    label: 'Root',
    group: 'sound',
    caption: 'The base note everything is tuned to.',
    tooltip:
      'The base note everything is tuned to. Slide it to move the whole sound higher or lower.',
    help: 'This is the home note the whole soundscape is built around. Slide it down for a deep, weighty hum or up for a lighter, airier tone. Everything else you hear is pitched in relation to this note.',
  },
  {
    id: 'spread',
    label: 'Spread',
    group: 'sound',
    caption: 'How far the extra tones fan out above the base.',
    tooltip:
      'How far the extra tones fan out above the base. Low = tight and pure; high = wide and shimmery.',
    help: 'Beyond the base note, a few extra tones stack on top. Spread sets how far apart they sit. Keep it low for a clean, pure sound, or push it up for a wide, glassy shimmer that feels less anchored.',
  },
  {
    id: 'density',
    label: 'Density',
    group: 'sound',
    caption: 'How many tones sound at once.',
    tooltip:
      'How many tones sound at once. More = a thicker, fuller texture. (Locked while playing.)',
    help: 'How many tones are layered together at once. Fewer tones give a sparse, open feel; more tones build a thick, full wash of sound. This one is locked once playback starts, so set it before you press play.',
  },
  {
    id: 'coupling',
    label: 'Coupling',
    group: 'sound',
    caption: 'How much the tones pull on each other as they move.',
    tooltip:
      'How much the tones pull on each other as they move. High = they drift together; low = each wanders alone.',
    help: 'As the sound slowly evolves, this sets how much the tones influence one another. Turn it up and they sway together as one body; turn it down and each tone wanders off on its own, for a looser, more scattered feel.',
  },
  {
    id: 'drift',
    label: 'Drift',
    group: 'sound',
    caption: 'How much the sound evolves on its own over time.',
    tooltip:
      'How much the sound evolves on its own over time. Zero = frozen and still; high = always shifting.',
    help: 'How restless the sound is. At zero it holds almost perfectly still. Turn it up and the soundscape keeps gently reshaping itself with no input from you — the heart of the "set it and let it go" feel.',
  },
  {
    id: 'brightness',
    label: 'Brightness',
    group: 'sound',
    caption: 'How light or dark the overall tone feels.',
    tooltip:
      'How light or dark the overall tone feels. Low = warm and muffled; high = crisp and airy.',
    help: 'A single knob for the overall color of the sound. Low is warm, soft and muffled, like sound heard through a wall. High is crisp and airy, with more sparkle on top.',
  },
  {
    id: 'space',
    label: 'Space',
    group: 'sound',
    caption: 'How much echo and roominess surrounds the sound.',
    tooltip:
      'How much echo and roominess surrounds the sound. Low = close and dry; high = vast and cathedral-like.',
    help: 'Adds a sense of room around the sound. Low keeps it close and dry, right next to you. High opens up a vast, echoing space, like a huge empty hall.',
  },
  {
    id: 'volume',
    label: 'Volume',
    group: 'sound',
    caption: 'How loud everything plays.',
    tooltip: 'How loud everything plays. This is just for your ears.',
    help: 'Overall loudness. This is a personal listening setting — it is not part of a shared link, so a link you send always opens at the listener’s own comfortable level.',
  },

  // ── Engine switcher + the four engine characters ───────────────────────
  {
    id: 'engine',
    label: 'Sound',
    group: 'engines',
    caption:
      'The method used to make the raw sound. Each has its own character.',
    tooltip:
      'The method used to make the raw sound. Each has its own character — switch and listen.',
    help: 'There are four different ways to generate the raw sound, each with its own personality. Switching between them while playing crossfades smoothly, so try each and keep the one that fits your mood.',
  },
  {
    id: 'engine.sine',
    label: 'Sine',
    group: 'engines',
    caption: 'Pure, smooth, glassy tones.',
    tooltip:
      'The cleanest, smoothest option — pure rounded tones with no edge.',
    help: 'The purest, smoothest sound — clean rounded tones with no grit. A calm, glassy starting point and a good default.',
  },
  {
    id: 'engine.fm',
    label: 'FM',
    group: 'engines',
    caption: 'Metallic, bell-like, or reedy tones.',
    tooltip:
      'A richer, more metallic character — think bells, glass, and reedy edges.',
    help: 'A richer, more complex character that can sound bell-like, metallic, or reedy. Its extra sliders (below the picker) let you dial in how much edge and shimmer it has.',
  },
  {
    id: 'engine.granular',
    label: 'Granular',
    group: 'engines',
    caption: 'Built from tiny snippets of a real recording.',
    tooltip:
      'Builds sound from thousands of tiny snippets of a real recording you pick from a list.',
    help: 'This one builds the sound out of countless tiny fragments of a real recording (you choose the source from a list). The result is textured and organic — clouds of sound rather than a single steady tone.',
  },
  {
    id: 'engine.physical',
    label: 'Physical',
    group: 'engines',
    caption: 'Models real instruments — strings, pipes, metal plates.',
    tooltip:
      'Imitates how real objects make sound — a bowed string, a blown pipe, or a struck metal plate.',
    help: 'This imitates how real, physical objects make sound: a bowed string, a blown pipe, or a ringing metal plate. Pick which one with the model buttons, then shape it with the sliders. (Needs a modern browser; older devices may not support it.)',
  },

  // ── FM engine params ───────────────────────────────────────────────────
  {
    id: 'fm.modRatio',
    label: 'Ratio',
    group: 'engines',
    caption: 'Sets the flavor — smooth and musical, or clangy and metallic.',
    tooltip:
      'Shifts the tone between smooth and musical or clangy and bell-like. Whole numbers sound more in-tune; in-between values get metallic.',
    help: 'Changes the basic flavor of the FM sound. Round numbers tend to sound clear and in-tune; values in between turn metallic and bell-like. Sweep it slowly to find a color you like.',
  },
  {
    id: 'fm.modIndex',
    label: 'Index',
    group: 'engines',
    caption: 'How much edge and brightness gets added.',
    tooltip:
      'How much extra brightness and bite to add. Low = soft and pure; high = buzzy and intense.',
    help: 'How much grit and brightness is layered onto the tone. Keep it low for a soft, near-pure sound, or raise it for a buzzy, intense, more electric character.',
  },
  {
    id: 'fm.feedback',
    label: 'Feedback',
    group: 'engines',
    caption: 'Pushes the tone toward a rough, noisy edge.',
    tooltip:
      'Folds the sound back on itself for a rougher, noisier edge. Zero is clean; high gets gritty.',
    help: 'Adds roughness by folding the sound back into itself. At zero it stays clean; turn it up for a grittier, more chaotic texture right at the edge of noise.',
  },

  // ── Granular engine params ─────────────────────────────────────────────
  {
    id: 'granular.source',
    label: 'Source',
    group: 'engines',
    caption: 'The recording the sound is built from.',
    tooltip:
      'The recording the tiny sound fragments are taken from. Pick one and listen.',
    help: 'Chooses which recording the sound is sculpted out of. Each option has its own raw material — pick one and the whole texture changes character.',
  },
  {
    id: 'granular.size',
    label: 'Grain',
    group: 'engines',
    caption: 'The length of each tiny snippet.',
    tooltip:
      'How long each tiny snippet is. Short = fluttery and textural; long = smooth and pad-like.',
    help: 'The length of each little fragment of sound. Short snippets flutter and shimmer; long ones smooth out into a steady pad. A small change here transforms the feel.',
  },
  {
    id: 'granular.density',
    label: 'Density',
    group: 'engines',
    caption: 'How many snippets play per second.',
    tooltip: 'How many snippets play each second. More = thicker and busier.',
    help: 'How thickly the fragments are packed together. Fewer makes a sparse, pointillist texture; more fills it in to a dense, continuous wash.',
  },
  {
    id: 'granular.posJitter',
    label: 'Jitter',
    group: 'engines',
    caption: 'How much the snippets wander through the recording.',
    tooltip:
      'How much the snippets roam around the recording. Low = focused; high = scattered and unpredictable.',
    help: 'How far each fragment strays from the current spot in the recording. Low keeps the texture focused on one moment; high scatters it for a more random, restless feel.',
  },
  {
    id: 'granular.pitchJitter',
    label: 'Pitch Jit',
    group: 'engines',
    caption: 'Random pitch wobble between snippets.',
    tooltip:
      'Adds random pitch wobble between snippets. Zero is steady; raise it for a chorused shimmer.',
    help: 'Randomly nudges the pitch of each fragment. Leave it at zero for a stable pitch, or raise it for a shimmering, chorus-like wobble.',
  },
  {
    id: 'granular.posCenter',
    label: 'Center',
    group: 'engines',
    caption: 'Which part of the recording to draw from.',
    tooltip:
      'Where in the recording the snippets cluster — the beginning, middle, or end.',
    help: 'Points to the spot in the recording the fragments gather around — start, middle, or end. It also slowly moves on its own, so even a still setting keeps subtly changing.',
  },

  // ── Physical engine params ─────────────────────────────────────────────
  {
    id: 'physical.model',
    label: 'Model',
    group: 'engines',
    caption: 'Which real object to imitate: string, pipe, or plate.',
    tooltip:
      'Pick the kind of object making the sound: a bowed string, a blown pipe, or a struck metal plate.',
    help: 'Chooses what real object the sound imitates — a bowed string, a blown pipe, or a ringing metal plate. Each reacts differently to the sliders below.',
  },
  {
    id: 'physical.excitationLevel',
    label: 'Excite',
    group: 'engines',
    caption: 'How hard the instrument is "played".',
    tooltip:
      'How hard the imaginary instrument is bowed, blown, or struck. Low = gentle; high = forceful.',
    help: 'How forcefully the instrument is driven — like bowing harder, blowing stronger, or striking firmer. Gentle settings whisper; strong ones push the sound to its fullest.',
  },
  {
    id: 'physical.damping',
    label: 'Damping',
    group: 'engines',
    caption: 'How quickly the sound dies away.',
    tooltip:
      'How fast the tone fades. Low = it rings on and on; high = it gets soft and short.',
    help: 'How much the sound is muted, like resting a finger on a ringing string. Low lets it sing and ring; high dampens it into something softer and shorter.',
  },
  {
    id: 'physical.brightness',
    label: 'Brightness',
    group: 'engines',
    caption: 'How light or dark this instrument sounds.',
    tooltip:
      'The tone color of the modeled instrument. Low = warm and round; high = sharp and present.',
    help: 'The color of this particular instrument — separate from the main Brightness control. Low is warm and round; high is sharper and more present.',
  },
  {
    id: 'physical.reed',
    label: 'Reed',
    group: 'engines',
    caption: 'For the pipe: how stiff the mouthpiece is.',
    tooltip:
      'Only affects the pipe model — how stiff its reed is, from breathy and loose to focused and tight.',
    help: 'Shapes the blown-pipe model only. Lower settings sound breathy and loose; higher ones tighten into a more focused, reedy tone. (Has no effect on the string or plate.)',
  },
  {
    id: 'physical.inharm',
    label: 'Inharm',
    group: 'engines',
    caption: 'For the plate: how clangy versus tuned it sounds.',
    tooltip:
      'Only affects the plate model — how bell-like and clangy it gets, versus clean and tuned.',
    help: 'Shapes the metal-plate model only. Low keeps it clean and tuned; high pushes it toward a clangy, gong-like ring. (Has no effect on the string or pipe.)',
  },

  // ── Sessions / arcs ────────────────────────────────────────────────────
  {
    id: 'mode',
    label: 'Mode',
    group: 'arcs',
    caption: 'Play freely forever, or follow a timed journey.',
    tooltip:
      'Open lets you tweak everything for as long as you like. Arc plays a hands-off, timed journey that shapes itself and ends on its own.',
    help: 'Two ways to listen. Open mode runs forever while you tweak the sliders freely. Arc mode plays a fixed-length journey that shapes the sound for you from start to finish — pick one when you want to press play and do nothing.',
  },
  {
    id: 'arc.preset',
    label: 'Journey',
    group: 'arcs',
    caption: 'A preset shape for how the sound changes over time.',
    tooltip:
      'A ready-made arc for the session: how it opens, builds, and resolves over the chosen time.',
    help: 'A ready-made shape for the whole session — how it opens, deepens, and resolves. Each preset is a different mood; your starting sliders are the canvas it paints over.',
  },
  {
    id: 'arc.duration',
    label: 'Duration',
    group: 'arcs',
    caption: 'How long the timed journey lasts.',
    tooltip: 'How many minutes the arc takes from start to gentle finish.',
    help: 'How long the timed journey runs before it gently fades out and stops on its own — handy for a focus block or a wind-down before sleep.',
  },

  // ── Live input ─────────────────────────────────────────────────────────
  {
    id: 'input.connect',
    label: 'Connect input',
    group: 'input',
    caption: 'Bring a live instrument or mic into the sound.',
    tooltip:
      'Lets you play a real instrument or sing into the soundscape through your mic or audio gear. Your audio never leaves your device.',
    help: 'Adds your own live playing — guitar, voice, anything with a mic — right into the soundscape. Your browser will ask permission to use the microphone. The audio is processed on your device only and is never uploaded or shared.',
  },
  {
    id: 'input.device',
    label: 'Device',
    group: 'input',
    caption: 'Which microphone or audio input to listen to.',
    tooltip: 'Choose which microphone or audio interface to use.',
    help: 'Picks which microphone or audio input the app listens to — your built-in mic, a USB mic, or an audio interface with an instrument plugged in.',
  },
  {
    id: 'input.level',
    label: 'Input Level',
    group: 'input',
    caption: 'How loud your live playing comes in.',
    tooltip:
      'How loud your live sound is brought in. Watch the meter and back off if the red clip mark flashes.',
    help: 'Controls how loud your live playing sits in the mix. Keep an eye on the meter above it — aim for the upper-middle, and turn this down if the red "clip" marker flashes.',
  },
  {
    id: 'input.monitoring',
    label: 'Monitoring',
    group: 'input',
    caption: 'Hear yourself through the app (use headphones!).',
    tooltip:
      'Plays your own live sound back through the app. Use headphones, or it can screech with feedback. Off by default.',
    help: 'When on, you hear your own playing back through the app. Only turn this on with headphones — through speakers, the mic hears the speakers and you get a feedback screech. It is off by default for safety.',
  },
  {
    id: 'input.latency',
    label: 'Latency',
    group: 'input',
    caption: 'A rough estimate of the slight delay you may hear.',
    tooltip:
      'An estimate of the tiny delay between playing and hearing it. If you play along, nudge your timing a hair early.',
    help: 'A rough estimate of the small delay between playing and hearing the result. It is an estimate, not an exact measurement. If you play along to the soundscape, lead the beat by a touch to compensate.',
  },

  // ── Loop pedal ─────────────────────────────────────────────────────────
  {
    id: 'loop.slot',
    label: 'Loop slot',
    group: 'loop',
    caption: 'Record a phrase and let it repeat under everything.',
    tooltip:
      'Records a phrase from your live input and loops it seamlessly. Three slots (A/B/C) let you stack layers.',
    help: 'A loop slot records a phrase from your live input and repeats it smoothly underneath the soundscape. There are three (A, B, C) so you can layer parts on top of each other. Recording starts on your first note and stops when you tell it to (or after a minute). Re-recording replaces what was there — there is no undo.',
  },
  {
    id: 'loop.freeze',
    label: 'Freeze',
    group: 'loop',
    caption: 'Stretch a loop into an endless, evolving drone.',
    tooltip:
      'Turns a recorded loop into a smooth, never-ending wash of sound instead of a plain repeat.',
    help: 'Freezing takes a recorded loop and smears it into an endless, gently shifting drone, rather than repeating it plainly — a single chord becomes a constant atmosphere. Freezing reveals extra sliders to shape that drone.',
  },
  {
    id: 'loop.grainSize',
    label: 'Grain size',
    group: 'loop',
    caption: 'Texture of a frozen loop: fluttery or smooth.',
    tooltip:
      'For a frozen loop: short = shimmery and textural, long = smooth and pad-like.',
    help: 'When a loop is frozen, this sets how chopped-up or smooth the drone feels — short for a shimmery, fluttering texture, long for a seamless pad.',
  },
  {
    id: 'loop.grainDensity',
    label: 'Grain density',
    group: 'loop',
    caption: 'How thick a frozen loop sounds.',
    tooltip:
      'For a frozen loop: how densely packed the sound is. Higher = thicker.',
    help: 'When a loop is frozen, this controls how full and thick the resulting drone is — sparse and breathy, or dense and solid.',
  },
  {
    id: 'loop.posJitter',
    label: 'Position jitter',
    group: 'loop',
    caption: 'How much a frozen loop wanders through itself.',
    tooltip:
      'For a frozen loop: how much it roams around the recording instead of holding one spot.',
    help: 'When a loop is frozen, this sets how much the drone roams through the recording versus hovering on one moment — more wander gives a more restless, evolving feel.',
  },
  {
    id: 'loop.pitchJitter',
    label: 'Pitch jitter',
    group: 'loop',
    caption: 'Adds a shimmering pitch wobble to a frozen loop.',
    tooltip:
      'For a frozen loop: zero stays in tune; raise it for a chorused shimmer.',
    help: 'When a loop is frozen, this adds a gentle, random pitch shimmer. Leave it at zero to stay in tune, or raise it for a richer, chorused haze.',
  },
  {
    id: 'loop.driftCoupled',
    label: 'Drift-coupled',
    group: 'loop',
    caption: 'Let a frozen loop breathe along with the main sound.',
    tooltip:
      'Ties a frozen loop’s motion to the same slow evolution as the rest of the sound, so it keeps breathing.',
    help: 'When on, a frozen loop drifts and breathes in step with the main soundscape’s own slow evolution, so it never sits perfectly still — it keeps living alongside everything else.',
  },

  // ── Recording ──────────────────────────────────────────────────────────
  {
    id: 'record.button',
    label: 'Record',
    group: 'record',
    caption: 'Capture what you’re hearing to a file.',
    tooltip:
      'Records exactly what you hear — sound, live input, and loops — into a file you can save and share.',
    help: 'Captures exactly what is playing — the soundscape, your live input, and any loops — to an audio file. Press to start, press again to stop, then a dialog lets you name it and save it. Sessions can run up to an hour.',
  },
  {
    id: 'record.format',
    label: 'Format',
    group: 'record',
    caption: 'Smaller file, or perfect quality.',
    tooltip:
      'Pick before recording: the compact option saves space; the lossless one keeps full quality but is larger.',
    help: 'Choose how the recording is saved before you start. One option makes a small, compact file that is easy to share; the other keeps perfect, lossless quality but takes more space.',
  },
  {
    id: 'record.save',
    label: 'Save recording',
    group: 'record',
    caption: 'Name it, choose who can see it, and keep it.',
    tooltip:
      'Give the recording a title and decide whether it stays private or can be shared with a link.',
    help: 'After recording, give it a title and pick whether it is private or shareable. Saved recordings live in your "My Recordings" list, where you can play, download, or share each one with its own link.',
  },

  // ── Embed ──────────────────────────────────────────────────────────────
  {
    id: 'embed.code',
    label: 'Embed code',
    group: 'embed',
    caption: 'Drop a little player onto your own website.',
    tooltip:
      'Copies a snippet of code you can paste into a blog or website to show a small play-only version of a shared sound.',
    help: 'For any sound you have made public, this gives you a snippet of code to paste into your own blog or website. It shows a tiny play-only player — listeners can press play, but cannot change anything. Pick a size and a light or dark look to match your page.',
  },

  // ── Gallery & sharing ──────────────────────────────────────────────────
  {
    id: 'feature.gallery',
    label: 'Gallery',
    group: 'gallery',
    caption: 'Browse and play sounds other people made.',
    tooltip:
      'A page of soundscapes people have shared. Preview any one, then load it in to keep tweaking.',
    help: 'A browsable collection of soundscapes people have chosen to share. Preview any of them, then load one into the app with a click and keep shaping it yourself. Search and sort to find something that fits your mood.',
  },
  {
    id: 'feature.share',
    label: 'Copy link',
    group: 'share',
    caption: 'Copy a link that reopens your exact sound.',
    tooltip:
      'Copies a link holding all your current settings. Anyone who opens it hears the same soundscape.',
    help: 'Copies a link that captures all your current settings. Send it to a friend and it opens to the exact same soundscape you built — no account or download needed. (Your live recording is not included, just the settings.)',
  },
  {
    id: 'presets',
    label: 'Presets',
    group: 'sound',
    caption: 'Ready-made sound settings to instantly change the vibe.',
    tooltip:
      'Curated sound profiles that set the core note, synthesis parameters, and active engine.',
    help: 'Saves you time by instantly loading a complete soundscape. Click any preset to change the active engine, core frequency, and slider settings at once.',
  },
];

const BY_ID: ReadonlyMap<string, Explain> = new Map(
  ENTRIES.map((e) => [e.id, e]),
);

/** Look up the explanation for an id, or `undefined` if none exists. */
export function getExplain(id: string): Explain | undefined {
  return BY_ID.get(id);
}

/** All explanations belonging to a group, in registry order. */
export function explainByGroup(group: ExplainGroup): Explain[] {
  return ENTRIES.filter((e) => e.group === group);
}

/** Ordered list of every group that has at least one entry. */
export const EXPLAIN_GROUP_ORDER: readonly ExplainGroup[] = [
  'sound',
  'engines',
  'arcs',
  'input',
  'loop',
  'record',
  'embed',
  'gallery',
  'share',
];

/** Human labels for each group heading in the Help panel. */
export const EXPLAIN_GROUP_LABELS: Record<ExplainGroup, string> = {
  sound: 'Shaping the sound',
  engines: 'The sound itself',
  arcs: 'Sessions & journeys',
  input: 'Playing along live',
  loop: 'Looping',
  record: 'Recording',
  embed: 'Embedding',
  gallery: 'Gallery',
  share: 'Sharing',
};

/** Every id currently in the registry (for tests / introspection). */
export const ALL_EXPLAIN_IDS: readonly string[] = ENTRIES.map((e) => e.id);

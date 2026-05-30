// v4.5 editorial taxonomy — the client mirror of api/app/library_taxonomy.py.
// A drift test (src/library/__tests__/taxonomy.test.ts) keeps the value sets in
// sync with the server. Calm-by-design: no label implies ranking or difficulty.

export interface TaxonomyItem {
  id: string;
  label: string;
  description: string;
}

export const LENGTH_CATEGORIES: TaxonomyItem[] = [
  { id: 'short', label: 'Short', description: '10 minutes or less' },
  { id: 'medium', label: 'Medium', description: '10–25 minutes' },
  { id: 'long', label: 'Long', description: '25–45 minutes' },
  { id: 'extended', label: 'Extended', description: '45 minutes or more' },
];

export const INTENTIONS: TaxonomyItem[] = [
  { id: 'morning', label: 'Morning', description: 'Begin the day gently' },
  { id: 'evening', label: 'Evening', description: 'Wind down' },
  { id: 'sleep', label: 'Sleep', description: 'Drift toward rest' },
  {
    id: 'difficult_day',
    label: 'Difficult day',
    description: 'A place to settle',
  },
  { id: 'focus', label: 'Focus', description: 'Quiet attention' },
  {
    id: 'open_practice',
    label: 'Open practice',
    description: 'No fixed shape',
  },
  {
    id: 'closing_the_week',
    label: 'Closing the week',
    description: 'Release and reflect',
  },
];

export const CHARACTER_TAGS: TaxonomyItem[] = [
  { id: 'drone', label: 'Drone', description: 'Sustained, evolving tone' },
  { id: 'composed', label: 'Composed', description: 'A structured Piece' },
  {
    id: 'spoken_word_free',
    label: 'No spoken word',
    description: 'Sound only — no narration',
  },
  { id: 'with_bells', label: 'With bells', description: 'Punctuated by bells' },
  {
    id: 'with_tunings',
    label: 'With tunings',
    description: 'Alternate tuning systems',
  },
];

export const LENGTH_IDS = LENGTH_CATEGORIES.map((t) => t.id);
export const INTENTION_IDS = INTENTIONS.map((t) => t.id);
export const CHARACTER_IDS = CHARACTER_TAGS.map((t) => t.id);

const _byId = (items: TaxonomyItem[]) =>
  Object.fromEntries(items.map((t) => [t.id, t]));

const LENGTH_BY_ID = _byId(LENGTH_CATEGORIES);
const INTENTION_BY_ID = _byId(INTENTIONS);
const CHARACTER_BY_ID = _byId(CHARACTER_TAGS);

export const labelForLength = (id: string | null) =>
  (id && LENGTH_BY_ID[id]?.label) || id || '';
export const labelForIntention = (id: string | null) =>
  (id && INTENTION_BY_ID[id]?.label) || id || '';
export const labelForCharacter = (id: string) =>
  CHARACTER_BY_ID[id]?.label || id;

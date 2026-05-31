// v7.0: APA 7th citation module. The canonical project-level APA renderer lives
// in bibtex-generator.ts (kept there for back-compat with v5.7); this module is
// the stable import path named in docs/v7.0-PLAN.md §9, alongside
// chicago-generator.ts. Per-study / per-version DOI citations are rendered
// server-side in api/app/services/citation.py.
export { getAPACitation } from './bibtex-generator.js';

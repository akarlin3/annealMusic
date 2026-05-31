// v7.0: Chicago (author-date) citation, parallel to bibtex-generator.ts. Study
// /version DOIs are rendered server-side (api/app/services/citation.py); this
// is the project-level citation surfaced by the CLI.
export function getChicagoCitation(version: string = '5.7.0'): string {
  return `Karlin, Avery. 2026. "AnnealMusic: A generative ambient meditation sandbox." Version v${version}. Zenodo. https://doi.org/10.5281/zenodo.10729482.`;
}

export function getBibTeX(version: string = '5.7.0'): string {
  return `@software{karlin2026annealmusic,
  author       = {Karlin, Avery},
  title        = {AnnealMusic: A generative ambient meditation sandbox},
  month        = may,
  year         = 2026,
  publisher    = {Zenodo},
  version      = {v${version}},
  doi          = {10.5281/zenodo.10729482},
  url          = {https://anneal.averykarlin.org}
}`;
}

export function getAPACitation(version: string = '5.7.0'): string {
  return `Karlin, A. (2026). AnnealMusic: A generative ambient meditation sandbox (v${version}) [Software]. https://anneal.averykarlin.org. https://doi.org/10.5281/zenodo.10729482`;
}

export function getCitationBlock(version: string = '5.7.0'): string {
  return `=========================================
      ANNEALMUSIC CITATION GUIDE
=========================================

To cite AnnealMusic in your academic publications, please use the following reference:

APA Format:
${getAPACitation(version)}

BibTeX:
${getBibTeX(version)}

-----------------------------------------
Zenodo persistent DOI: 10.5281/zenodo.10729482
ORCID: 0000-0002-3904-7128
ROR: https://ror.org/03t748b94
=========================================`;
}

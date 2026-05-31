# Citation Guide: Citing Studies, Versions, & Sonifications

> [!IMPORTANT]
> **Disclaimer**: Templates require legal and Institutional Review Board (IRB) review at your institution. AnnealMusic provides drafts as starting points, not legal advice.

---

Academic integrity requires precise citation of the software, specific study configurations, and sonification mapping specifications to support reproducibility and scientific peer review.

---

## 1. Citing the Core AnnealMusic Software

### APA Format

> Karlin, A., & AnnealMusic Contributors. (2026). _AnnealMusic: High-Fidelity Generative Synthesis & Sonification Platform for Scientific Research_ (Version 7.7.0). https://doi.org/10.5281/zenodo.123456

### Chicago Format

> Karlin, Avery, and AnnealMusic Contributors. _AnnealMusic: High-Fidelity Generative Synthesis & Sonification Platform for Scientific Research_. Version 7.7.0. Zenodo, 2026. https://doi.org/10.5281/zenodo.123456.

### BibTeX Format

```bibtex
@software{karlin_annealmusic_2026,
  author       = {Karlin, Avery and {AnnealMusic Contributors}},
  title        = {AnnealMusic: High-Fidelity Generative Synthesis \& Sonification Platform for Scientific Research},
  version      = {7.7.0},
  year         = {2026},
  publisher    = {Zenodo},
  doi          = {10.5281/zenodo.123456},
  url          = {https://github.com/akarlin3/annealMusic}
}
```

---

## 2. Citing a Specific Study Version / Zenodo DOI

When publishing research that utilizes a registered study, cite the specific version-locked DOI minted during the publish flow:

### APA Format

> Investigator, K. (2026). _Auditory Fatigue and Cognitive Latency Study_ (Version 7.7.0) [Data set]. Zenodo. https://doi.org/10.5281/zenodo.987654

### BibTeX Format

```bibtex
@dataset{investigator_auditory_fatigue_2026,
  author       = {Investigator, K.},
  title        = {Auditory Fatigue and Cognitive Latency Study},
  year         = {2026},
  version      = {7.7.0},
  publisher    = {Zenodo},
  doi          = {10.5281/zenodo.987654},
  url          = {https://annealmusic.app/s/auditory-fatigue}
}
```

---

## 3. Citing a Sonification Mapping Specification

When discussing a specific sonification configuration, document the parameter mappings in the supplementary materials and cite the mapping hash:

> _"The planetary magnetosphere data was sonified using the FM Synthesis Engine in AnnealMusic v7.7.0, configured according to Mapping Spec `#sha256:d83d1c8f...` (detailed in Supplementary File 1). The active mapping can be re-rendered at `https://annealmusic.app/p/d83d1c8f`."_

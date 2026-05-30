# Academic Citation Guide

If you utilize AnnealMusic in your psychoacoustic experiments, music cognition studies, MIR data pipelines, or computational simulations, please cite the software version using the guidelines below.

---

## 1. Recommended Citation Formats

### APA Style

> Karlin, A. (2026). _AnnealMusic: A generative ambient meditation sandbox_ (v5.7.0) [Software]. https://anneal.averykarlin.org. https://doi.org/10.5281/zenodo.10729482

### BibTeX

```bibtex
@software{karlin2026annealmusic,
  author       = {Karlin, Avery},
  title        = {AnnealMusic: A generative ambient meditation sandbox},
  month        = may,
  year         = 2026,
  publisher    = {Zenodo},
  version      = {v5.7.0},
  doi          = {10.5281/zenodo.10729482},
  url          = {https://anneal.averykarlin.org}
}
```

---

## 2. Programmatic Citation Print Tools

To make extracting reference metadata simple during writing phases, AnnealMusic embeds native print tools directly into the interfaces:

### From the Command Line Interface (CLI):

Execute the standard `cite` command to print formatted BibTeX and APA structures directly to stdout:

```bash
annealmusic cite
```

### From the Python Scripting Panel:

Invoke the synchronous `cite()` function inside `/research` to retrieve the reference string in print blocks:

```python
import anneal
print(anneal.cite())
```

---

## 3. GitHub & Zenodo Automatic DOI Minting

Every tagged semantic release on the GitHub repository automatically registers a persistent Digital Object Identifier (DOI) via the integrated **Zenodo GitHub Action Hook**:

1. **`.zenodo.json` Registry:** Outlines metadata, author associations, ORCID identifiers (`0000-0002-3904-7128`), and university/laboratory affiliations (ROR alignment).
2. **Release Hook:** When the release tag `v5.7.0` is published to main, Zenodo automatically mirrors the repository tag, mints the new versioned DOI, and schedules archiving backups.

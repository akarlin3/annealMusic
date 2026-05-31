# Citation & DOIs

AnnealMusic is citable at two levels: the **project** as a whole (the v5.7
release-DOI tooling) and, as of **v7.0**, each individual **Study** and each of
its versions.

---

## Citing the project

The software itself has a persistent Zenodo DOI and a canonical citation. Print
it from the CLI:

```bash
annealmusic cite                 # full block (BibTeX + APA)
annealmusic cite --format bibtex
annealmusic cite --format apa
annealmusic cite --format chicago
```

…or from the Python sandbox (`anneal.cite()`). The generators live in
`tools/cite/` (`bibtex-generator.ts`, `apa-generator.ts`, `chicago-generator.ts`).

```bibtex
@software{karlin2026annealmusic,
  author    = {Karlin, Avery},
  title     = {AnnealMusic: A generative ambient meditation sandbox},
  year      = 2026,
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.10729482},
  url       = {https://anneal.averykarlin.org}
}
```

ORCID `0000-0002-3904-7128` · ROR `https://ror.org/03t748b94`.

---

## Citing a Study (v7.0)

Each [Study](STUDIES.md) is independently citable, and each **version** of a
study is citable on its own. Citations are generated server-side and exposed at:

```
GET /api/v1/studies/:idOrSlug/citation?format=bibtex|apa|chicago
```

(`bibtex` is the default; `format` must be one of the three.) Public studies can
be cited anonymously; private studies require an investigator.

### Author attribution

- **Authors are the investigators**, ordered **PIs first**, then by join time.
- Each author's **ORCID** (set on `PATCH /api/v1/account/me`) is included —
  inline in APA/Chicago and as a `note` in BibTeX.
- Affiliations use **ROR** identifiers and flow into Zenodo deposition metadata.

### Formats

All three are produced from the same context (title, ordered authors, year,
DOI-or-URL, version label):

- **BibTeX** — `@misc{…}` with `author`, `title`, `year`, `publisher`, `version`,
  `doi`, `url`.
- **APA 7th** — `Authors (Year). Title (Version) [Study]. Publisher. <locator>`.
- **Chicago (author-date)** — `Authors. Year. "Title." Version. Publisher. <locator>.`

An **unpublished** study (no DOI yet) is still citable: the locator is its
canonical `/s/<slug>` URL and the publisher reads "AnnealMusic (unpublished)".

---

## Study DOIs (Zenodo)

Publishing a study (PI-only) mints DOIs via Zenodo, mirroring the v5.7
release-DOI pattern but at runtime via the Zenodo API. Zenodo's two-tier model
is preserved:

- **Concept DOI** — one per study, stored on `studies.concept_doi`; always
  resolves to the latest published version.
- **Version DOI** — one per published `study_versions` row, stored on
  `study_versions.doi`. Each published snapshot is independently citable.

### Pre-flight checklist

`POST /api/v1/studies/:id/publish` validates, and the UI mirrors, before minting:

1. Abstract is present.
2. Ethics statement is present.
3. At least one PI.
4. **Every** investigator has linked an ORCID.

A failure returns `422 preflight_failed` with the list of missing items.

### Robustness & configuration

- The Zenodo client (`api/app/services/zenodo.py`) retries on transient errors
  (5xx / 429 / network) with bounded exponential backoff, honoring `Retry-After`,
  and does **not** retry 4xx. A publish failure leaves the study **unpublished**
  (no partial state).
- It defaults to the **Zenodo sandbox** (`ZENODO_API_URL`). Set `ZENODO_TOKEN`
  to mint for real. With **no token configured**, it runs a deterministic
  **stub** that returns reproducible fake DOIs and never touches the network —
  so tests and CI exercise the full publish flow offline.

### Setting your researcher identity

```http
PATCH /api/v1/account/me
{ "orcid": "0000-0002-1825-0097", "affiliation_ror": "https://ror.org/03t748b94" }
```

ORCID is format-validated (`0000-0000-0000-000X`); ROR must be a
`https://ror.org/<id>` URL. Both appear in study citations and Zenodo metadata.

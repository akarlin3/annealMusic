# Studies — Multi-Investigator Research Collaboration (v7.0)

A **Study** is the unit of scientific work in AnnealMusic: a versioned, citable
bundle that organizes resources (stimuli, protocols, datasets, analysis scripts)
into a reproducible package, edited by multiple authenticated investigators with
full provenance. Studies are the shared substrate that the clinical-research
(v7.2 / v7.4 / v7.5) and sonification (v7.1) tracks build on.

This guide covers the multi-investigator workflow. For citation formats and DOIs,
see [CITATION.md](CITATION.md). For the full design, see [v7.0-PLAN.md](v7.0-PLAN.md).

---

## Where to find it

The **Studies** panel lives in the `/research` console (a tab alongside
Telemetry, OSC, Datalogger, Scripting, and Experiments). Studies require an
AnnealMusic account (magic-link / Google / GitHub). Anyone — signed in or not —
can browse and cite a study that an investigator has marked **public**.

## The shape of a study

| Field                        | Notes                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title, description, abstract | Free text; abstract is required to publish.                                                                                                                                   |
| Status                       | `planning` → `pre-registered` → `active` → `data-collection` → `analysis` → `published` → `archived`. `published` is set only by the publish flow; `archived` only by delete. |
| Visibility                   | `private` (default) or `public`. Public studies + their citations are readable anonymously.                                                                                   |
| Pre-registration URL         | Optional OSF / AsPredicted / institutional link.                                                                                                                              |
| Ethics statement             | Required to publish.                                                                                                                                                          |
| Funding sources              | `[{ source, grant_number, role }]`; flow into Zenodo metadata.                                                                                                                |
| Investigators                | Authenticated accounts with roles (below).                                                                                                                                    |
| Linked resources             | Patches, pieces, listening sessions, experiments, scripts (+ future datasets/sonifications).                                                                                  |
| Versions                     | Immutable snapshots; published versions carry a DOI.                                                                                                                          |

## Roles & permissions

Every investigator holds exactly one role per study:

| Capability                                                               | pi  | co-investigator |     analyst     | viewer |
| ------------------------------------------------------------------------ | :-: | :-------------: | :-------------: | :----: |
| Read study / resources / versions / citation / audit                     |  ✓  |        ✓        |        ✓        |   ✓    |
| Edit study fields (title, abstract, status, visibility, funding, ethics) |  ✓  |        ✓        |        —        |   —    |
| Link / unlink resources                                                  |  ✓  |        ✓        | analysis only\* |   —    |
| Create snapshots                                                         |  ✓  |        ✓        |        —        |   —    |
| Add / remove / re-role investigators                                     |  ✓  |        —        |        —        |   —    |
| Publish (mint DOI)                                                       |  ✓  |        —        |        —        |   —    |
| Archive (delete)                                                         |  ✓  |        —        |        —        |   —    |

\* An **analyst** may only add resources tagged with role `analysis` (their
lane), and cannot unlink. This lets analysts contribute analyses without
touching the protocol or stimuli.

**Invariants:** the study creator becomes the first PI; a study always keeps at
least one PI (the last PI cannot be removed or downgraded — the API returns
`409 last_pi`).

### The accounts ↔ resources bridge

Studies are owned by authenticated **accounts**, but the resources you link
(patches, experiments, …) are owned by anonymous device **users** that an
account has claimed. When you link a resource, the server verifies it is owned
by _some_ investigator on the study (the union of every investigator's claimed
devices). So a co-investigator can legitimately link the PI's patch.

## Typical workflow

1. **Create** a study (you become PI).
2. **Add investigators** by email and assign roles.
3. **Link resources** — pick a kind (patch / piece / experiment / script /
   listening session) and a role (stimulus / protocol / data / analysis).
4. **Snapshot** at meaningful milestones (e.g. label `preregistered`). A
   snapshot freezes the study + investigators + resolved resource metadata and
   content hashes into an **immutable** version. Snapshots are never edited or
   deleted, and capture only metadata + hashes (never binary audio), so they
   stay small and survive later deletion of a source resource.
5. **Publish** when ready — a PI runs the pre-flight checklist (abstract,
   ethics statement, ≥1 PI, every investigator has an ORCID) and mints a Zenodo
   DOI. See [CITATION.md](CITATION.md).

## Provenance (audit log)

Every mutation — study edits, investigator changes, resource link/unlink,
snapshots, publish — is recorded to an immutable audit log as
`(timestamp, account_id, action, before, after)`, through a single write-path so
nothing slips by. The per-study **audit sidebar** shows the full trail. Reads
are never logged.

## IRB-friendly defaults

v7.0 establishes the framework; clinical instantiation lands later in v7. The
posture carried forward from v5.6:

- **Anonymous-first.** Studies require auth, but public studies stay browsable
  and citable by anyone. Private studies return `404` (not `403`) to
  non-investigators so their existence is never leaked.
- **Not a data processor by default.** No subject data flows through
  AnnealMusic in v7.0. When subject-facing features arrive (v7.2/v7.4/v7.5),
  consent is mandatory, withdraw is always available, only declared data is
  collected, and the canonical flow remains POST-to-PI-endpoint.

## API quick reference

```
POST   /api/v1/studies                      create (creator → PI)
GET    /api/v1/studies/me                    studies I'm an investigator on
GET    /api/v1/studies/:idOrSlug             read (public if visibility=public)
PATCH  /api/v1/studies/:id                   edit fields            [pi|co-investigator]
DELETE /api/v1/studies/:id                   archive                [pi]

POST   /api/v1/studies/:id/investigators     add                    [pi]
PATCH  /api/v1/studies/:id/investigators/:acct  change role         [pi]
DELETE /api/v1/studies/:id/investigators/:acct  remove              [pi]

GET    /api/v1/studies/:id/resources         list
POST   /api/v1/studies/:id/resources         link        [pi|co-investigator|analyst*]
DELETE /api/v1/studies/:id/resources/:linkId unlink      [pi|co-investigator]

POST   /api/v1/studies/:id/snapshot          freeze a version       [pi|co-investigator]
GET    /api/v1/studies/:id/versions          list versions
GET    /api/v1/studies/:id/versions/:vid     retrieve a snapshot
POST   /api/v1/studies/:id/publish           mint DOI               [pi]

GET    /api/v1/studies/:id/audit             provenance trail       [investigators]
GET    /api/v1/studies/:idOrSlug/citation?format=bibtex|apa|chicago

PATCH  /api/v1/account/me                     set orcid, affiliation_ror
```

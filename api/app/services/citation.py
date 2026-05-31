"""v7.0 study citations — pure BibTeX / APA / Chicago generators.

Driven by ``GET /api/v1/studies/:id/citation?format=…``. The router builds a
plain ``CitationContext`` from the study + investigators (+ optional published
version) and these pure functions render it — so they unit-test trivially with
no DB. Extends the v5.7 project-level citation tooling (``tools/cite/``) to the
per-study / per-version DOI model.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

MONTHS = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
]


@dataclass
class Author:
    name: str
    orcid: str | None = None
    affiliation_ror: str | None = None


@dataclass
class CitationContext:
    title: str
    authors: list[Author] = field(default_factory=list)
    year: int = 2026
    month: int | None = None  # 1-12
    doi: str | None = None
    url: str = ""
    version_label: str | None = None
    publisher: str = "Zenodo"


def _safe_authors(ctx: CitationContext) -> list[Author]:
    return ctx.authors or [Author(name="AnnealMusic Contributors")]


def _bibtex_key(ctx: CitationContext) -> str:
    authors = _safe_authors(ctx)
    last = authors[0].name.split(",")[0].split()[-1] if authors[0].name else "anon"
    first_title_word = re.sub(r"[^a-z0-9]", "", (ctx.title or "study").split(" ")[0].lower())
    return f"{re.sub(r'[^a-z0-9]', '', last.lower())}{ctx.year}{first_title_word}"


def bibtex(ctx: CitationContext) -> str:
    authors = " and ".join(a.name for a in _safe_authors(ctx))
    lines = [
        f"@misc{{{_bibtex_key(ctx)},",
        f"  author       = {{{authors}}},",
        f"  title        = {{{ctx.title}}},",
        f"  year         = {ctx.year},",
    ]
    if ctx.month is not None:
        lines.append(f"  month        = {MONTHS[ctx.month - 1]},")
    lines.append(f"  publisher    = {{{ctx.publisher}}},")
    if ctx.version_label:
        lines.append(f"  version      = {{{ctx.version_label}}},")
    if ctx.doi:
        lines.append(f"  doi          = {{{ctx.doi}}},")
    lines.append(f"  url          = {{{ctx.url}}},")
    orcids = [a.orcid for a in _safe_authors(ctx) if a.orcid]
    if orcids:
        lines.append(f"  note         = {{ORCID: {', '.join(orcids)}}},")
    lines.append("}")
    return "\n".join(lines)


def _author_with_orcid(a: Author) -> str:
    if a.orcid:
        return f"{a.name} (ORCID: {a.orcid})"
    return a.name


def apa(ctx: CitationContext) -> str:
    authors = [_author_with_orcid(a) for a in _safe_authors(ctx)]
    if len(authors) == 1:
        author_str = authors[0]
    else:
        author_str = ", ".join(authors[:-1]) + ", & " + authors[-1]
    version = f" (Version {ctx.version_label})" if ctx.version_label else ""
    locator = f"https://doi.org/{ctx.doi}" if ctx.doi else ctx.url
    return f"{author_str} ({ctx.year}). {ctx.title}{version} [Study]. {ctx.publisher}. {locator}"


def chicago(ctx: CitationContext) -> str:
    authors = [_author_with_orcid(a) for a in _safe_authors(ctx)]
    if len(authors) == 1:
        author_str = authors[0]
    elif len(authors) == 2:
        author_str = f"{authors[0]}, and {authors[1]}"
    else:
        author_str = ", ".join(authors[:-1]) + ", and " + authors[-1]
    version = f" Version {ctx.version_label}." if ctx.version_label else ""
    locator = f"https://doi.org/{ctx.doi}" if ctx.doi else ctx.url
    return f'{author_str}. {ctx.year}. "{ctx.title}."{version} {ctx.publisher}. {locator}.'


GENERATORS = {"bibtex": bibtex, "apa": apa, "chicago": chicago}


def render(ctx: CitationContext, fmt: str) -> str:
    gen = GENERATORS.get(fmt)
    if gen is None:
        raise ValueError(f"unknown citation format: {fmt}")
    return gen(ctx)

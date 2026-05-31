"""v7.0 Zenodo DOI minting for study versions.

Parallels the v5.7 release-DOI pattern but is runtime / API-driven. Zenodo's
native two-tier model is preserved: a per-study **concept DOI** (resolves to the
latest version) plus a per-version **version DOI**.

Robustness (the "Anthropic-recommended robust HTTP client"): a lazy ``httpx``
client with bounded exponential backoff on 5xx / 429 / network errors and no
retry on 4xx. Test isolation: defaults to the Zenodo **sandbox**, and when no
token is configured runs in deterministic **stub mode** (no network) so publish
flows are exercisable offline / in CI. See docs/v7.0-PLAN.md §7.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import get_settings


class ZenodoError(RuntimeError):
    pass


@dataclass
class MintResult:
    doi: str
    concept_doi: str
    deposition_id: str
    stub: bool = False


# Status codes worth retrying (transient). 4xx (except 429) are caller errors.
_RETRY_STATUS = {429, 500, 502, 503, 504}


class ZenodoService:
    def __init__(self, *, api_url: str | None = None, token: str | None = None) -> None:
        settings = get_settings()
        self.api_url = (api_url or settings.zenodo_api_url).rstrip("/")
        self.token = token if token is not None else settings.zenodo_token
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    @property
    def enabled(self) -> bool:
        """Real minting only when a token is configured; otherwise stub mode."""
        return bool(self.token)

    async def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """One request with bounded exponential backoff on transient failures."""
        delays = [0.5, 1.0, 2.0, 4.0]
        last_exc: Exception | None = None
        for attempt in range(len(delays) + 1):
            try:
                resp = await self.client.request(method, url, **kwargs)
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                last_exc = exc
            else:
                if resp.status_code not in _RETRY_STATUS:
                    return resp
                last_exc = ZenodoError(f"Zenodo {resp.status_code}: {resp.text[:200]}")
                # Honor Retry-After when present.
                retry_after = resp.headers.get("Retry-After")
                if retry_after and retry_after.isdigit() and attempt < len(delays):
                    await asyncio.sleep(min(float(retry_after), 30.0))
                    continue
            if attempt < len(delays):
                await asyncio.sleep(delays[attempt])
        raise ZenodoError(f"Zenodo request failed after retries: {last_exc}")

    def _stub_mint(self, snapshot_json: dict[str, Any]) -> MintResult:
        """Deterministic fake DOIs derived from the study id — no network."""
        study_id = str(snapshot_json.get("study", {}).get("id", "unknown"))
        label = str(snapshot_json.get("snapshot_label", "v1"))
        concept = "10.5281/zenodo." + hashlib.sha256(study_id.encode()).hexdigest()[:8]
        version = (
            "10.5281/zenodo."
            + hashlib.sha256(f"{study_id}:{label}".encode()).hexdigest()[:8]
        )
        return MintResult(
            doi=version,
            concept_doi=concept,
            deposition_id="stub-" + version.rsplit(".", 1)[-1],
            stub=True,
        )

    def _metadata(self, snapshot_json: dict[str, Any]) -> dict[str, Any]:
        study = snapshot_json.get("study", {})
        creators = []
        for inv in snapshot_json.get("investigators", []):
            creator: dict[str, Any] = {"name": inv.get("display_name") or "Anonymous"}
            if inv.get("orcid"):
                creator["orcid"] = inv["orcid"]
            if inv.get("affiliation_ror"):
                creator["affiliation"] = inv["affiliation_ror"]
            creators.append(creator)
        if not creators:
            creators = [{"name": "AnnealMusic Contributors"}]
        meta: dict[str, Any] = {
            "title": study.get("title") or "Untitled study",
            "upload_type": "dataset",
            "description": study.get("abstract") or study.get("description") or study.get("title"),
            "creators": creators,
            "version": snapshot_json.get("snapshot_label"),
            "license": "AGPL-3.0-or-later",
            "access_right": "open",
        }
        grants = [
            {"id": fs["grant_number"]}
            for fs in study.get("funding_sources", [])
            if isinstance(fs, dict) and fs.get("grant_number")
        ]
        if grants:
            meta["grants"] = grants
        return meta

    async def mint(self, snapshot_json: dict[str, Any]) -> MintResult:
        """Create + publish a Zenodo deposition for a study version snapshot."""
        if not self.enabled:
            return self._stub_mint(snapshot_json)

        params = {"access_token": self.token}
        headers = {"Content-Type": "application/json"}
        meta = self._metadata(snapshot_json)

        # 1. Create deposition.
        create = await self._request(
            "POST",
            f"{self.api_url}/deposit/depositions",
            params=params,
            headers=headers,
            content=json.dumps({"metadata": meta}),
        )
        if create.status_code >= 400:
            raise ZenodoError(f"create deposition failed: {create.status_code} {create.text[:200]}")
        dep = create.json()
        deposition_id = str(dep["id"])

        # 2. Upload the snapshot as the artifact (bucket API).
        bucket_url = dep.get("links", {}).get("bucket")
        payload = json.dumps(snapshot_json, indent=2).encode()
        if bucket_url:
            up = await self._request(
                "PUT",
                f"{bucket_url}/snapshot.json",
                params=params,
                content=payload,
            )
            if up.status_code >= 400:
                raise ZenodoError(f"upload failed: {up.status_code} {up.text[:200]}")

        # 3. Publish.
        pub = await self._request(
            "POST",
            f"{self.api_url}/deposit/depositions/{deposition_id}/actions/publish",
            params=params,
        )
        if pub.status_code >= 400:
            raise ZenodoError(f"publish failed: {pub.status_code} {pub.text[:200]}")
        published = pub.json()
        doi = published.get("doi") or published.get("metadata", {}).get("doi", "")
        concept = (
            published.get("conceptdoi")
            or published.get("metadata", {}).get("conceptdoi")
            or doi
        )
        return MintResult(doi=doi, concept_doi=concept, deposition_id=deposition_id)


_zenodo_service: ZenodoService | None = None


def get_zenodo_service() -> ZenodoService:
    global _zenodo_service
    if _zenodo_service is None:
        _zenodo_service = ZenodoService()
    return _zenodo_service


def set_zenodo_service(service: ZenodoService | None) -> None:
    """Test injector — pass a fake/recording service, or ``None`` to reset."""
    global _zenodo_service
    _zenodo_service = service

from __future__ import annotations

import uuid
import pytest
from sqlalchemy import select
from tests.conftest import VALID_PAYLOAD

def _hdr() -> dict[str, str]:
    return {"x-anon-id": str(uuid.uuid4())}

def _admin_hdr(admin_key: str) -> dict[str, str]:
    return {
        "x-anon-id": str(uuid.uuid4()),
        "x-admin-key": admin_key
    }

@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"

async def test_mapping_templates_crud(client, admin_key):
    h = _hdr()
    admin_h = _admin_hdr(admin_key)

    # 1. Non-admin should be blocked from creating template
    payload = {
        "slug": "single-scalar-drift",
        "title": "Single Scalar Drift",
        "description": "Continuous parameter drift",
        "domain_family": "time-series",
        "source_schema": {"columns": ["temperature"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["temperature"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "temperature",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {
                        "type": "linear",
                        "rawMin": 0,
                        "rawMax": 100,
                        "outMin": 0.1,
                        "outMax": 0.9
                    }
                }
            ]
        },
        "recipe_content": "### Recipe content here",
        "citation": "Hermann et al. (2011)"
    }

    r = await client.post("/api/v1/admin/mapping-templates", headers=h, json=payload)
    assert r.status_code == 401

    # 2. Admin creates template
    r = await client.post("/api/v1/admin/mapping-templates", headers=admin_h, json=payload)
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["slug"] == "single-scalar-drift"
    assert created["title"] == "Single Scalar Drift"

    # 3. List templates (anonymous / regular user)
    r = await client.get("/api/v1/mapping-templates", headers=h)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert items[0]["slug"] == "single-scalar-drift"

    # 4. Get template details
    r = await client.get("/api/v1/mapping-templates/single-scalar-drift", headers=h)
    assert r.status_code == 200
    fetched = r.json()
    assert fetched["recipe_content"] == "### Recipe content here"

    # 5. Admin updates template
    r = await client.patch(
        f"/api/v1/admin/mapping-templates/{created['id']}",
        headers=admin_h,
        json={"title": "Updated Title"}
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated Title"

    # 6. Admin deletes template
    r = await client.delete(f"/api/v1/admin/mapping-templates/{created['id']}", headers=admin_h)
    assert r.status_code == 204

    # 7. Should be gone from active list
    r = await client.get("/api/v1/mapping-templates", headers=h)
    assert r.status_code == 200
    assert len(r.json()["items"]) == 0


async def test_instantiate_sonification_from_template(client, admin_key):
    h = _hdr()
    admin_h = _admin_hdr(admin_key)

    # Create active template
    payload = {
        "slug": "anomaly-punctuation",
        "title": "Anomaly Punctuation",
        "description": "Triggered punctuation sounds",
        "domain_family": "time-series",
        "source_schema": {"columns": ["anomaly_score"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["anomaly_score"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "anomaly_score",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {
                        "type": "linear",
                        "rawMin": 0,
                        "rawMax": 1,
                        "outMin": 0.1,
                        "outMax": 0.9
                    }
                }
            ]
        },
        "recipe_content": "### Anomaly Recipe",
    }
    r = await client.post("/api/v1/admin/mapping-templates", headers=admin_h, json=payload)
    assert r.status_code == 201

    # Instantiate from template with custom rows (calibration test)
    data_rows = [
        {"anomaly_score": 10.0},
        {"anomaly_score": 50.0},
        {"anomaly_score": 100.0},
    ]
    inst_payload = {
        "template_slug": "anomaly-punctuation",
        "title": "My Custom Anomaly Sonification",
        "data_rows": data_rows,
        "duration_ms": 30000
    }
    r = await client.post("/api/v1/sonifications/from-template", headers=h, json=inst_payload)
    assert r.status_code == 201, r.text
    instantiated = r.json()
    assert instantiated["title"] == "My Custom Anomaly Sonification"
    assert instantiated["duration_ms"] == 30000

    # Verify auto-calibration set the correct bounds
    mapping_spec = instantiated["mapping_spec"]
    rules = mapping_spec["rules"]
    assert len(rules) == 1
    transform = rules[0]["transform"]
    assert transform["rawMin"] == 10.0
    assert transform["rawMax"] == 100.0
    assert rules[0]["calibrated"] is True
    assert rules[0]["calibrationBounds"] == {"min": 10.0, "max": 100.0}

    # Verify inline data got packed into the mapping source
    assert mapping_spec["sources"][0]["data"] == data_rows

from __future__ import annotations

import uuid
import pytest
from sqlalchemy import select
from tests.conftest import VALID_PAYLOAD


def _hdr() -> dict[str, str]:
    return {"x-anon-id": str(uuid.uuid4())}


async def test_create_and_get_sonification(client):
    h = _hdr()
    
    # 1. Create a sonification
    base_state = {"payload": VALID_PAYLOAD, "v": 20}
    mapping_spec = {
        "mappings": [
            {
                "source_channel": "temperature",
                "target_param": "brightness",
                "transform": {
                    "type": "linear",
                    "domain": [0, 100],
                    "range": [0, 1]
                }
            }
        ]
    }
    
    payload = {
        "schema_ver": 21,
        "title": "Weather Sonification",
        "description": "Sonifying climate data",
        "base_state": base_state,
        "mapping_spec": mapping_spec,
        "visibility": "unlisted",
        "duration_ms": 60000,
    }
    
    r = await client.post("/api/v1/sonifications", headers=h, json=payload)
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["title"] == "Weather Sonification"
    assert created["short_slug"] is not None
    assert created["visibility"] == "unlisted"
    
    # 2. Get the sonification by ID
    r = await client.get(f"/api/v1/sonifications/{created['id']}", headers=h)
    assert r.status_code == 200
    fetched = r.json()
    assert fetched["title"] == "Weather Sonification"
    assert fetched["mapping_spec"] == mapping_spec

    # 3. Get the sonification by short slug
    r = await client.get(f"/api/v1/sonifications/{created['short_slug']}", headers=h)
    assert r.status_code == 200
    assert r.json()["id"] == created["id"]


async def test_update_sonification(client):
    h = _hdr()
    base_state = {"payload": VALID_PAYLOAD, "v": 20}
    mapping_spec = {"mappings": []}
    
    r = await client.post(
        "/api/v1/sonifications",
        headers=h,
        json={
            "schema_ver": 21,
            "title": "Original",
            "base_state": base_state,
            "mapping_spec": mapping_spec,
        }
    )
    assert r.status_code == 201
    created = r.json()
    
    # Update title and mapping_spec
    new_spec = {
        "mappings": [{"source_channel": "x", "target_param": "drift", "transform": {"type": "log"}}]
    }
    r = await client.patch(
        f"/api/v1/sonifications/{created['id']}",
        headers=h,
        json={
            "title": "Updated Title",
            "mapping_spec": new_spec,
        }
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["title"] == "Updated Title"
    assert updated["mapping_spec"] == new_spec


async def test_list_my_sonifications(client):
    h = _hdr()
    base_state = {"payload": VALID_PAYLOAD, "v": 20}
    mapping_spec = {"mappings": []}
    
    # Create two sonifications for the same user
    await client.post(
        "/api/v1/sonifications",
        headers=h,
        json={
            "schema_ver": 21,
            "title": "First",
            "base_state": base_state,
            "mapping_spec": mapping_spec,
        }
    )
    await client.post(
        "/api/v1/sonifications",
        headers=h,
        json={
            "schema_ver": 21,
            "title": "Second",
            "base_state": base_state,
            "mapping_spec": mapping_spec,
        }
    )
    
    r = await client.get("/api/v1/sonifications/me", headers=h)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 2
    assert {i["title"] for i in items} == {"First", "Second"}


async def test_upload_and_delete_source_file(client):
    h = _hdr()
    base_state = {"payload": VALID_PAYLOAD, "v": 20}
    mapping_spec = {"mappings": []}
    
    created = (await client.post(
        "/api/v1/sonifications",
        headers=h,
        json={
            "schema_ver": 21,
            "title": "File Test",
            "base_state": base_state,
            "mapping_spec": mapping_spec,
        }
    )).json()
    
    csv_data = "timestamp,temperature\n0.0,22.5\n0.5,23.1\n1.0,24.0\n"
    r = await client.post(
        f"/api/v1/sonifications/{created['id']}/source-file",
        headers=h,
        files={"file": ("data.csv", csv_data, "text/csv")}
    )
    assert r.status_code == 200
    ref = r.json()
    assert ref["filename"] == "data.csv"
    assert ref["columns"] == ["timestamp", "temperature"]
    assert ref["row_count"] == 3
    assert len(ref["sample"]) == 3
    
    # Confirm it cascadingly updated the sonification row
    fetched = (await client.get(f"/api/v1/sonifications/{created['id']}", headers=h)).json()
    assert len(fetched["source_files"]) == 1
    assert fetched["source_files"][0]["filename"] == "data.csv"

    # Delete the source file
    r = await client.delete(
        f"/api/v1/sonifications/{created['id']}/source-file/{ref['storage_key']}",
        headers=h
    )
    assert r.status_code == 200
    
    # Confirm deletion from sonification source_files
    fetched = (await client.get(f"/api/v1/sonifications/{created['id']}", headers=h)).json()
    assert len(fetched["source_files"]) == 0


async def test_render_sonification_job(client):
    h = _hdr()
    base_state = {"payload": VALID_PAYLOAD, "v": 20}
    mapping_spec = {"mappings": []}
    
    created = (await client.post(
        "/api/v1/sonifications",
        headers=h,
        json={
            "schema_ver": 21,
            "title": "Render Test",
            "base_state": base_state,
            "mapping_spec": mapping_spec,
        }
    )).json()
    
    # Request rendering
    r = await client.post(
        f"/api/v1/sonifications/{created['id']}/render?duration_sec=2",
        headers=h
    )
    assert r.status_code == 200
    job = r.json()
    assert job["job_id"] is not None
    assert job["status"] == "rendering"
    
    # Wait / poll for status (mock in-memory render finishes immediately in background)
    import asyncio
    await asyncio.sleep(0.5)
    
    r = await client.get(f"/api/v1/sonifications/{created['id']}/render/{job['job_id']}", headers=h)
    assert r.status_code == 200
    status = r.json()
    assert status["status"] == "completed"
    assert status["url"].startswith("memory://sonification_renders/")

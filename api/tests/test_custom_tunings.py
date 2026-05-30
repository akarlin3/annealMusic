from __future__ import annotations

import uuid
import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.event import listens_for

@pytest.fixture(autouse=True)
def enable_sqlite_fk():
    @listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        except Exception:
            pass
        finally:
            cursor.close()
            
    yield
    
    from sqlalchemy.event import remove
    try:
        remove(Engine, "connect", set_sqlite_pragma)
    except Exception:
        pass

def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


async def test_custom_tuning_lifecycle(client):
    h = _hdr()
    
    # 1. Create a custom tuning
    tuning_data = {
        "name": "Werckmeister V Test",
        "scl_text": "! test.scl\nDescription\n5\n1.0\n1.2\n1.4\n1.6\n2.0",
        "parsed_scale": [1.0, 1.2, 1.4, 1.6, 2.0],
        "reference_a4_hz": 432.0,
    }
    create_res = await client.post(
        "/api/v1/custom_tunings",
        headers=h,
        json=tuning_data,
    )
    assert create_res.status_code == 201, create_res.text
    tuning = create_res.json()
    assert tuning["name"] == "Werckmeister V Test"
    assert tuning["reference_a4_hz"] == 432.0
    assert tuning["parsed_scale"] == [1.0, 1.2, 1.4, 1.6, 2.0]
    assert tuning["id"]
    
    # 2. List custom tunings
    list_res = await client.get("/api/v1/custom_tunings", headers=h)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == tuning["id"]
    
    # 3. Delete custom tuning
    delete_res = await client.delete(f"/api/v1/custom_tunings/{tuning['id']}", headers=h)
    assert delete_res.status_code == 204
    
    # 4. Verify deleted (listing is empty)
    list_res2 = await client.get("/api/v1/custom_tunings", headers=h)
    assert list_res2.status_code == 200
    assert len(list_res2.json()["items"]) == 0


async def test_custom_tuning_security_constraints(client):
    owner_h = _hdr()
    other_h = _hdr()
    
    # 1. Create custom tuning as Owner
    tuning_data = {
        "name": "Owner Tuning",
        "scl_text": "description\n1\n2.0",
        "parsed_scale": [1.0, 2.0],
    }
    create_res = await client.post(
        "/api/v1/custom_tunings",
        headers=owner_h,
        json=tuning_data,
    )
    assert create_res.status_code == 201
    tuning = create_res.json()
    
    # 2. Other user tries to delete Owner's tuning -> Should fail (403)
    delete_res = await client.delete(f"/api/v1/custom_tunings/{tuning['id']}", headers=other_h)
    assert delete_res.status_code == 403
    
    # 3. Other user lists -> Should NOT see Owner's tuning
    list_res = await client.get("/api/v1/custom_tunings", headers=other_h)
    assert list_res.status_code == 200
    assert len(list_res.json()["items"]) == 0

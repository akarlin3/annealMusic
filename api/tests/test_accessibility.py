import uuid
import pytest

from app.models import AccessibilityDescription, Sonification, User
from app.db import get_sessionmaker


@pytest.fixture
async def sample_sonification(app):
    sm = get_sessionmaker()
    async with sm() as s:
        user = User(id=uuid.uuid4())
        s.add(user)
        son = Sonification(
            id=uuid.uuid4(),
            user_id=user.id,
            schema_ver=1,
            title="Heart Sync",
            description="Continuous ECG sonification.",
            base_state={},
            mapping_spec={
                "domain": "ECG Physiology",
                "mappings": {
                    "heart_rate": {"field": "HR", "target": "pitch"},
                    "respiration": {"field": "RESP", "target": "orbit_speed"},
                }
            },
            source_files=[],
            duration_ms=30000,
            visibility="public",
            short_slug="heart1",
        )
        s.add(son)
        await s.commit()
        return son


@pytest.mark.asyncio
async def test_create_and_update_accessibility_descriptions(client, sample_sonification):
    """Test manual curation/CRUD updates of accessibility descriptions."""
    # 1. Create a fresh manual transcript
    response = await client.post(
        "/api/v1/accessibility-descriptions",
        json={
            "artifact_kind": "sonification",
            "artifact_id": str(sample_sonification.id),
            "description": "Curated description for blind researchers.",
            "language": "en",
            "source": "manual",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "Curated description for blind researchers."
    assert data["source"] == "manual"

    # 2. Update/override the transcript
    update_response = await client.post(
        "/api/v1/accessibility-descriptions",
        json={
            "artifact_kind": "sonification",
            "artifact_id": str(sample_sonification.id),
            "description": "Reviewed manual transcript override.",
            "language": "en",
            "source": "reviewed",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["description"] == "Reviewed manual transcript override."
    assert update_response.json()["source"] == "reviewed"


@pytest.mark.asyncio
async def test_get_description_auto_generation(client, sample_sonification):
    """Test standard fetch which auto-generates description from spec if not yet manually created."""
    response = await client.get(f"/api/v1/accessibility-descriptions/sonification/{sample_sonification.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "auto"
    assert "ECG Physiology" in data["description"]
    assert "HR mapped to pitch" in data["description"]
    assert "RESP mapped to orbit_speed" in data["description"]

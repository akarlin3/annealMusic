import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models import RenderedArtifact, Patch, User
from app.db import get_sessionmaker
from app.services.citation import CitationContext, Author, bibtex


@pytest.fixture
async def sample_patch(app):
    sm = get_sessionmaker()
    async with sm() as s:
        user = User(id=uuid.uuid4())
        s.add(user)
        patch = Patch(
            id=uuid.uuid4(),
            user_id=user.id,
            schema_ver=4,
            state={"v": 4, "payload": "kind=patch&tuning=equal"},
            short_slug="pat123",
            visibility="public",
            engine="sine",
            mode="open",
            capture_refs=[],
        )
        s.add(patch)
        await s.commit()
        return patch


@pytest.mark.asyncio
async def test_render_image_endpoint(client, sample_patch):
    """Test standard synchronous still image render."""
    mock_artifact = RenderedArtifact(
        id=uuid.uuid4(),
        user_id=sample_patch.user_id,
        source_kind="patch",
        source_id=sample_patch.id,
        render_kind="image",
        storage_key=f"renders/test.png",
        bytes=12345,
        resolution="1920x1080",
        duration_ms=0,
        citation_bibtex="BibTeX citation",
        created_at=datetime.now(timezone.utc),
    )

    with patch("app.routers.renders.VideoRenderService.render_still_image", new_callable=AsyncMock) as mock_render:
        mock_render.return_value = mock_artifact

        response = await client.post(
            "/api/v1/renders/image",
            json={
                "source_kind": "patch",
                "source_id": str(sample_patch.id),
                "render_kind": "image",
                "resolution": "1920x1080",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["render_kind"] == "image"
        assert data["resolution"] == "1920x1080"
        assert data["bytes"] == 12345


@pytest.mark.asyncio
async def test_queue_video_endpoint(client, sample_patch):
    """Test queuing a visualizer video in the background."""
    response = await client.post(
        "/api/v1/renders/video",
        json={
            "source_kind": "patch",
            "source_id": str(sample_patch.id),
            "render_kind": "video",
            "resolution": "1920x1080",
            "duration_ms": 15000,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["render_kind"] == "video"
    assert data["bytes"] is None  # None marks background render in-progress


@pytest.mark.asyncio
async def test_outreach_card_endpoint(client, sample_patch):
    """Test generating a packaged outreach card."""
    mock_artifact = RenderedArtifact(
        id=uuid.uuid4(),
        user_id=sample_patch.user_id,
        source_kind="patch",
        source_id=sample_patch.id,
        render_kind="outreach-card",
        storage_key="renders/outreach.mp4",
        bytes=54321,
        resolution="1280x720",
        duration_ms=15000,
        citation_bibtex="Outreach BibTeX citation",
        created_at=datetime.now(timezone.utc),
    )

    with patch("app.routers.renders.VideoRenderService.render_video", new_callable=AsyncMock) as mock_render:
        mock_render.return_value = mock_artifact

        response = await client.post(
            "/api/v1/renders/outreach-card",
            json={
                "source_kind": "patch",
                "source_id": str(sample_patch.id),
                "render_kind": "outreach-card",
                "resolution": "1280x720",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["render_kind"] == "outreach-card"
        assert data["bytes"] == 54321


@pytest.mark.asyncio
async def test_get_status_and_download(client, sample_patch):
    """Test status polling and download redirection endpoints."""
    # First, let's create a ready artifact row
    sm = get_sessionmaker()
    artifact_id = uuid.uuid4()
    async with sm() as s:
        artifact = RenderedArtifact(
            id=artifact_id,
            user_id=sample_patch.user_id,
            source_kind="patch",
            source_id=sample_patch.id,
            render_kind="image",
            storage_key="renders/ready.png",
            bytes=123,
            resolution="1920x1080",
            duration_ms=0,
            created_at=datetime.now(timezone.utc),
        )
        s.add(artifact)
        await s.commit()

    # Query status
    status_resp = await client.get(f"/api/v1/renders/{artifact_id}")
    assert status_resp.status_code == 200
    assert status_resp.json()["bytes"] == 123

    # Query download redirection
    with patch("app.storage.MemoryStorage.presigned_get_url", new_callable=AsyncMock) as mock_presigned:
        mock_presigned.return_value = "http://storage.local/renders/ready.png"
        dl_resp = await client.get(f"/api/v1/renders/{artifact_id}/download", follow_redirects=False)
        assert dl_resp.status_code == 307
        assert dl_resp.headers["location"] == "http://storage.local/renders/ready.png"

from __future__ import annotations

import time
import uuid
import pytest
from app.services.observability.metrics import tracker, SLO_TARGETS
from app.services.observability.alerting import check_slos_and_alert


@pytest.mark.asyncio
async def test_metrics_tracker_latency_and_breach():
    tracker.reset()
    
    # 1. Record a non-breaching latency
    is_breach = tracker.record_latency("patch_save", 200.0)
    assert not is_breach
    assert tracker.get_p99("patch_save") == 200.0
    assert tracker.get_breach_duration("patch_save") == 0.0

    # 2. Record a breaching latency
    is_breach = tracker.record_latency("patch_save", 600.0)
    assert is_breach
    assert tracker.get_p99("patch_save") == 600.0
    assert tracker.get_breach_duration("patch_save") > 0.0


@pytest.mark.asyncio
async def test_websocket_metrics():
    tracker.reset()
    tracker.record_websocket_connection(True)
    tracker.record_websocket_connection(True)
    tracker.record_websocket_connection(False)

    # 2 out of 3 connections succeeded = 66.6% success rate (< 95% target)
    assert round(tracker.get_websocket_success_rate(), 2) == 0.67
    assert tracker.get_breach_duration("websocket_signal") > 0.0


@pytest.mark.asyncio
async def test_alerting_consecutive_breaches(monkeypatch):
    tracker.reset()
    
    # Simulate a breach that has been active for more than 5 minutes
    now = time.time()
    monkeypatch.setitem(tracker._breach_start_time, "patch_save", now - 350.0)

    triggered = await check_slos_and_alert()
    assert "patch_save" in triggered


@pytest.mark.asyncio
async def test_crash_report_ingest_route(client):
    h = {"x-anon-id": str(uuid.uuid4())}
    payload = {
        "message": "Uncaught TypeError: Cannot read properties of null (reading 'state')",
        "stack": "TypeError: Cannot read properties of null...\n  at App.tsx:12:3",
        "version": "8.3.0",
        "buildSha": "test_sha_123",
        "browserOS": "Chrome/macOS",
        "sanitizedUrl": "/p/:slug",
        "context": "uncaught-runtime-error",
        "timestamp": "2026-05-30T12:00:00Z"
    }

    res = await client.post("/api/v1/observability/crash-reports", json=payload, headers=h)
    assert res.status_code == 204


@pytest.mark.asyncio
async def test_crash_report_rate_limit(client, monkeypatch):
    from app import rate_limit
    
    monkeypatch.setattr(rate_limit, "ANON_LIMITS", {**rate_limit.ANON_LIMITS, "crash_reports": 1})
    
    h = {"x-anon-id": str(uuid.uuid4())}
    payload = {
        "message": "Crash 1",
        "version": "8.3.0",
        "buildSha": "test_sha_123",
        "browserOS": "Chrome/macOS",
        "sanitizedUrl": "/p/:slug",
        "timestamp": "2026-05-30T12:00:00Z"
    }

    # First request passes
    res1 = await client.post("/api/v1/observability/crash-reports", json=payload, headers=h)
    assert res1.status_code == 204

    # Second request hits 429
    res2 = await client.post("/api/v1/observability/crash-reports", json=payload, headers=h)
    assert res2.status_code == 429


@pytest.mark.asyncio
async def test_orcid_verify_rate_limit(client, monkeypatch):
    from app import rate_limit
    
    monkeypatch.setattr(rate_limit, "ANON_LIMITS", {**rate_limit.ANON_LIMITS, "orcid_verify": 1})
    
    h = {"x-anon-id": str(uuid.uuid4())}
    payload = {"orcid": "0000-0002-1825-0097"}

    res1 = await client.post("/api/v1/studies/orcid-verify", json=payload, headers=h)
    assert res1.status_code == 200
    assert res1.json()["valid"] is True

    res2 = await client.post("/api/v1/studies/orcid-verify", json=payload, headers=h)
    assert res2.status_code == 429


@pytest.mark.asyncio
async def test_gallery_search_rate_limit(client, monkeypatch):
    from app import rate_limit
    
    monkeypatch.setattr(rate_limit, "ANON_LIMITS", {**rate_limit.ANON_LIMITS, "gallery_search": 1})
    
    h = {"x-anon-id": str(uuid.uuid4())}
    
    res1 = await client.get("/api/v1/gallery?q=drift", headers=h)
    assert res1.status_code == 200

    res2 = await client.get("/api/v1/gallery?q=drift", headers=h)
    assert res2.status_code == 429


def test_script_memory_limit_enforced():
    import resource
    import pytest
    try:
        # Check if RLIMIT_AS setrlimit is supported on this machine
        max_bytes = 4 * 1024 * 1024 * 1024
        # Just a dry run to check support, we can restore it afterward
        soft, hard = resource.getrlimit(resource.RLIMIT_AS)
        try:
            resource.setrlimit(resource.RLIMIT_AS, (max_bytes, hard))
            # Restore
            resource.setrlimit(resource.RLIMIT_AS, (soft, hard))
        except Exception:
            pytest.skip("System does not support setting RLIMIT_AS memory limits.")
    except Exception:
        pytest.skip("resource module or RLIMIT_AS not available on this platform.")

    import zipfile
    import io
    import json
    from app.services.study_validation import run_bundle_analysis_scripts
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        manifest = {
            "manifest_version": "1.0",
            "study_id": str(uuid.uuid4()),
            "version_id": str(uuid.uuid4()),
            "reproducibility_level": "runnable",
            "files": [
                {"path": "scripts/leak.py", "sha256": "dummy", "kind": "user_script"}
            ]
        }
        zf.writestr("manifest.json", json.dumps(manifest))
        
        # leak.py - attempts to allocate 800 MB (which exceeds the 512MB limit)
        leak_code = """
import sys
try:
    # Attempt to allocate 800MB
    data = bytearray(800 * 1024 * 1024)
    print("Success allocation")
except Exception as e:
    print(f"Error: {e}")
"""
        zf.writestr("scripts/leak.py", leak_code)
        
    zip_bytes = zip_buffer.getvalue()
    report = run_bundle_analysis_scripts(zip_bytes)
    
    assert not report["valid"]
    # Verify execution is blocked or crashed due to memory bounds (output is empty or contains allocation/exit errors)
    assert "exited with code" in report["errors"][0] or "MemoryError" in report["analysis_script_errors"] or report["analysis_script_output"] == ""


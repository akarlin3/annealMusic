from __future__ import annotations

import pytest

from app.validation import validate_payload


def test_valid_payload_passes():
    assert validate_payload("m=open&e=fm&rootFreq=110&fm.modIndex=2.00", 4) == []


def test_full_v4_payload_passes():
    payload = (
        "m=arc&arc=bell&dur=600&e=fm&rootFreq=110&spread=1.05&"
        "fm.modRatio=1.00&fm.feedback=0.50&LA.f=1&LA.gs=120&LA.gd=12&LB.m=1"
    )
    assert validate_payload(payload, 4) == []


def test_granular_v5_payload_passes():
    payload = (
        "m=open&e=granular&rootFreq=110&spread=1.00&"
        "gr.source=2&gr.size=120&gr.density=14&gr.posJitter=0.30&"
        "gr.pitchJitter=0&gr.posCenter=0.50"
    )
    assert validate_payload(payload, 5) == []


@pytest.mark.parametrize(
    "payload,needle",
    [
        ("e=granular&gr.source=99", "out of range"),
        ("e=granular&gr.nope=1", "unknown engine param"),
        ("e=granular&gr.size=9", "out of range"),
    ],
)
def test_invalid_granular_payloads_rejected(payload, needle):
    errors = validate_payload(payload, 5)
    assert any(needle in e for e in errors), errors


@pytest.mark.parametrize(
    "payload,needle",
    [
        ("rootFreq=9999", "out of range"),
        ("rootFreq=abc", "non-numeric"),
        ("bogusKey=1", "unknown key"),
        ("e=banana", "unknown engine"),
        ("m=sideways", "unknown mode"),
        ("arc=nope", "unknown arc"),
        ("dur=10", "out of range"),
        ("fm.modIndex=99", "out of range"),
        ("fm.nope=1", "unknown engine param"),
        ("LZ.f=1", "unknown loop slot"),
        ("LA.zz=1", "unknown loop field"),
        ("LA.f=2", "flag must be 0 or 1"),
        ("LA.gs=9999", "out of range"),
        ("rootFreq=110&rootFreq=120", "duplicate key"),
    ],
)
def test_invalid_payloads_rejected(payload, needle):
    errors = validate_payload(payload, 4)
    assert any(needle in e for e in errors), errors


def test_unsupported_version_rejected():
    assert validate_payload("rootFreq=110", 99) != []


def test_oversized_payload_rejected():
    assert validate_payload("rootFreq=110&" * 1000, 4) != []

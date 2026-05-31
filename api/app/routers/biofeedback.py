from __future__ import annotations

from fastapi import APIRouter, Depends
from app.deps import rate_limit

router = APIRouter(prefix="/api/v1/biofeedback", tags=["biofeedback"])

@router.get("/devices", dependencies=[Depends(rate_limit("get"))])
async def list_devices():
    return [
        {"id": "polar-h10", "name": "Polar H10", "capabilities": ["hrv", "heart_rate"], "transports": ["webbluetooth"]},
        {"id": "polar-verity", "name": "Polar Verity Sense", "capabilities": ["hrv", "heart_rate"], "transports": ["webbluetooth"]},
        {"id": "openbci-cyton", "name": "OpenBCI Cyton", "capabilities": ["eeg", "accelerometer"], "transports": ["webserial"]},
        {"id": "muse", "name": "Muse 2 / S", "capabilities": ["eeg"], "transports": ["webbluetooth"]},
        {"id": "empatica", "name": "Empatica E4 / EmbracePlus", "capabilities": ["hrv", "gsr", "accelerometer"], "transports": []}
    ]

@router.get("/connections", dependencies=[Depends(rate_limit("get"))])
async def current_connections():
    # Session-scoped connected devices. Returns mock connected device status.
    return []

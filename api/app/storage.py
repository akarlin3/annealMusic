"""Object-storage abstraction.

Two implementations: an S3-compatible client (Cloudflare R2 in prod, MinIO
locally) and an in-memory client for tests. Audio bytes are served via presigned
GET URLs so they never transit the API process (see ``GET /captures/:id``).
"""

from __future__ import annotations

import abc
import asyncio
import io
import wave
from dataclasses import dataclass

from app.config import Settings


@dataclass
class WavInfo:
    duration_ms: int
    sample_rate: int
    channels: int


def inspect_wav(data: bytes) -> WavInfo | None:
    """Parse a PCM WAV header; ``None`` if the bytes are not a valid WAV."""
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            frames = w.getnframes()
            rate = w.getframerate()
            channels = w.getnchannels()
            if rate <= 0 or frames <= 0:
                return None
            duration_ms = round(frames / rate * 1000)
            return WavInfo(duration_ms=duration_ms, sample_rate=rate, channels=channels)
    except (wave.Error, EOFError, ValueError):
        return None


class StorageClient(abc.ABC):
    @abc.abstractmethod
    async def put(self, key: str, data: bytes, content_type: str) -> None: ...

    @abc.abstractmethod
    async def delete(self, key: str) -> None: ...

    @abc.abstractmethod
    async def presigned_get_url(self, key: str) -> str: ...

    @abc.abstractmethod
    async def get(self, key: str) -> bytes | None: ...


class MemoryStorage(StorageClient):
    """In-process storage for tests and local-without-S3 runs."""

    def __init__(self) -> None:
        self._objects: dict[str, bytes] = {}

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self._objects[key] = data

    async def delete(self, key: str) -> None:
        self._objects.pop(key, None)

    async def presigned_get_url(self, key: str) -> str:
        # A stable, fake URL — fine for local/tests where bytes are also in-process.
        return f"memory://{key}"

    async def get(self, key: str) -> bytes | None:
        return self._objects.get(key)


class S3Storage(StorageClient):
    def __init__(self, settings: Settings) -> None:
        import boto3

        self._bucket = settings.s3_bucket
        self._ttl = settings.s3_presign_ttl_seconds
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(
            self._client.delete_object, Bucket=self._bucket, Key=key
        )

    async def presigned_get_url(self, key: str) -> str:
        return await asyncio.to_thread(
            self._client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=self._ttl,
        )

    async def get(self, key: str) -> bytes | None:
        def _get() -> bytes | None:
            try:
                resp = self._client.get_object(Bucket=self._bucket, Key=key)
                return resp["Body"].read()
            except self._client.exceptions.NoSuchKey:
                return None

        return await asyncio.to_thread(_get)


def make_storage(settings: Settings) -> StorageClient:
    if settings.storage_backend == "s3":
        return S3Storage(settings)
    return MemoryStorage()


async def _ffmpeg(args: list[str], data: bytes) -> bytes:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-hide_banner", "-loglevel", "error", *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate(input=data)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {err.decode(errors='replace')}")
    return out


async def transcode_to_opus(wav: bytes, bitrate_kbps: int) -> bytes:
    """Transcode PCM WAV to Opus via ffmpeg (stdin->stdout)."""
    return await _ffmpeg(
        ["-i", "pipe:0", "-c:a", "libopus", "-b:a", f"{bitrate_kbps}k",
         "-f", "ogg", "pipe:1"],
        wav,
    )


async def encode_preview_opus(raw: bytes, bitrate_kbps: int) -> bytes:
    """Repackage a browser-rendered audio blob (WebM/Opus) into a small
    Ogg/Opus preview: mono, fixed bitrate. Decodes whatever ffmpeg can read."""
    return await _ffmpeg(
        ["-i", "pipe:0", "-ac", "1", "-c:a", "libopus", "-b:a", f"{bitrate_kbps}k",
         "-f", "ogg", "pipe:1"],
        raw,
    )


async def decode_any_to_wav(data: bytes) -> bytes:
    """Decode any ffmpeg-supported audio format to signed 16-bit PCM WAV."""
    return await _ffmpeg(
        ["-i", "pipe:0", "-acodec", "pcm_s16le", "-f", "wav", "pipe:1"],
        data,
    )


async def transcode_to_mono_opus(wav_bytes: bytes, bitrate_kbps: int) -> bytes:
    """Transcode a PCM WAV to mono Opus at a fixed bitrate (stdin->stdout)."""
    return await _ffmpeg(
        ["-i", "pipe:0", "-ac", "1", "-c:a", "libopus", "-b:a", f"{bitrate_kbps}k",
         "-f", "ogg", "pipe:1"],
        wav_bytes,
    )


def validate_audio_safety(wav_bytes: bytes) -> None:
    """Analyze PCM samples for silence, DC offset, NaN/Infinity, or excessive noise."""
    import wave
    import struct

    try:
        with wave.open(io.BytesIO(wav_bytes), "rb") as w:
            params = w.getparams()
            sample_width = params.sampwidth
            n_frames = params.nframes

            if sample_width != 2:
                raise ValueError("unsupported sample width: must be 16-bit PCM")

            frames = w.readframes(n_frames)
    except Exception as exc:
        raise ValueError(f"failed to parse decoded audio: {str(exc)}")

    num_samples = len(frames) // 2
    if num_samples == 0:
        raise ValueError("decoded audio contains zero samples")

    try:
        samples = struct.unpack(f"<{num_samples}h", frames)
    except Exception:
        raise ValueError("corrupt audio sample data")

    # 1. Peak amplitude check (silence / near-silence)
    # Peak amplitude in signed 16-bit is in range [0, 32768].
    # Threshold: peak must be >= 327 (0.01 of 32768, -40dB).
    peak = max(abs(s) for s in samples)
    if peak < 327:
        raise ValueError("upload is silent or near-silent (peak under -40dB)")

    # 2. DC offset check
    # Average sample value should be close to 0.
    # Threshold: abs(mean) < 3276 (10% of full-scale).
    mean_val = sum(samples) / num_samples
    if abs(mean_val) > 3276:
        raise ValueError("invalid DC offset (exceeds 10% of full-scale)")

    # 3. Pure noise check (Zero Crossing Rate)
    # ZCR = number of zero crossings divided by (num_samples - 1).
    # White noise has ZCR close to 0.5. We reject if ZCR > 0.45.
    crossings = 0
    last_sign = samples[0] >= 0
    for s in samples[1:]:
        sign = s >= 0
        if sign != last_sign:
            crossings += 1
            last_sign = sign

    zcr = crossings / (num_samples - 1) if num_samples > 1 else 0
    if zcr > 0.45:
        raise ValueError("excessive high-frequency noise (ZCR > 45%)")


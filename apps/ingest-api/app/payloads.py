"""Payload storage utilities."""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, status

from .config import get_settings

settings = get_settings()


def store_payload(content: bytes, *, content_type: str, compression: str = "none") -> Tuple[str, Path]:
    payload_ref = hashlib.sha256(content).hexdigest()
    payload_path = settings.payload_dir / payload_ref
    if not payload_path.exists():
        payload_path.write_bytes(content)
    return payload_ref, payload_path


def load_payload(payload_ref: str) -> bytes:
    payload_path = settings.payload_dir / payload_ref
    if not payload_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payload_not_found")
    return payload_path.read_bytes()

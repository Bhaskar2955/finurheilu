"""Save audio/video files. Supabase Storage when configured, local disk otherwise."""
from __future__ import annotations

import os

import httpx

from . import config


def save(path: str, data: bytes, content_type: str) -> str:
    """Store a file and return its public URL."""
    if config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY:
        url = f"{config.SUPABASE_URL}/storage/v1/object/{config.MEDIA_BUCKET}/{path}"
        r = httpx.post(url, content=data, timeout=120, headers={
            "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": content_type,
            "x-upsert": "true",
            "cache-control": "3600",
        })
        r.raise_for_status()
        return f"{config.SUPABASE_URL}/storage/v1/object/public/{config.MEDIA_BUCKET}/{path}"
    full = os.path.join(config.MEDIA_DIR, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as f:
        f.write(data)
    return f"{config.PUBLIC_BASE_URL}/media/{path}"

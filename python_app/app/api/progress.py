"""Progress sync API routes — port of src/app/api/progress/route.ts."""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_session_payload
from app.lib.data_keys import DATA_KEYS
from app import models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/progress", tags=["progress"])

VALID_KEYS = set(DATA_KEYS)


def _is_empty_payload(value: object) -> bool:
    if isinstance(value, list):
        return len(value) == 0
    if isinstance(value, dict):
        return len(value) == 0
    return False


@router.get("")
def get_progress(request: Request, db: Session = Depends(get_db)) -> dict:
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")

    rows = (
        db.query(models.UserData)
        .filter(models.UserData.student_id == payload["sub"])
        .all()
    )

    progress: dict = {}
    timestamps: dict = {}
    for row in rows:
        try:
            progress[row.key] = json.loads(row.value)
        except (json.JSONDecodeError, ValueError):
            progress[row.key] = row.value
        timestamps[row.key] = row.updated_at.isoformat()

    return {"progress": progress, "timestamps": timestamps}


@router.post("")
def sync_progress(body: dict, request: Request, db: Session = Depends(get_db)) -> dict:
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")

    raw_progress = body.get("progress")
    if not isinstance(raw_progress, dict):
        raise HTTPException(400, "progress must be an object")

    client_timestamps: dict[str, str] = body.get("timestamps") or {}

    # Filter to valid keys only
    entries = [
        (k, v) for k, v in raw_progress.items()
        if k in VALID_KEYS and v is not None
    ]

    if not entries:
        return {"success": True, "keys_updated": 0, "keys_skipped": 0}

    # Fetch existing rows for comparison
    keys_to_check = [k for k, _ in entries]
    existing_rows = (
        db.query(models.UserData)
        .filter(
            models.UserData.student_id == payload["sub"],
            models.UserData.key.in_(keys_to_check),
        )
        .all()
    )
    existing_map = {r.key: r for r in existing_rows}

    keys_updated = 0
    keys_skipped = 0

    for key, value in entries:
        existing = existing_map.get(key)

        # C1: Timestamp guard
        client_ts_str = client_timestamps.get(key)
        if client_ts_str and existing:
            try:
                client_dt = datetime.fromisoformat(client_ts_str.replace("Z", "+00:00"))
                server_dt = existing.updated_at
                if client_dt.replace(tzinfo=None) < server_dt.replace(tzinfo=None) if server_dt.tzinfo else server_dt:
                    keys_skipped += 1
                    continue
            except (ValueError, TypeError):
                pass

        # C2: Empty-payload guard
        if _is_empty_payload(value) and existing:
            stored = existing.value.strip()
            if stored not in ("[]", "{}"):
                keys_skipped += 1
                continue

        value_json = json.dumps(value)
        if existing:
            existing.value = value_json
            from datetime import UTC
            existing.updated_at = datetime.now(UTC).replace(tzinfo=None)
        else:
            new_row = models.UserData(
                student_id=payload["sub"],
                key=key,
                value=value_json,
            )
            db.add(new_row)
        keys_updated += 1

    db.commit()
    return {"success": True, "keys_updated": keys_updated, "keys_skipped": keys_skipped}

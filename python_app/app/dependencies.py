from typing import Optional
from fastapi import Request, HTTPException, Cookie, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import verify_session_token, JWT_COOKIE_NAME
from app import models

def get_session_payload(request: Request) -> Optional[dict]:
    """Extract and verify JWT from cookie."""
    cookie = request.cookies.get(JWT_COOKIE_NAME)
    if not cookie:
        return None
    return verify_session_token(cookie)

def require_auth(
    request: Request,
    db: Session = Depends(get_db),
) -> models.Student:
    """Dependency that requires authentication, returns current Student."""
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    student = db.query(models.Student).filter(models.Student.id == payload["sub"]).first()
    if not student:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return student

def optional_auth(request: Request) -> Optional[dict]:
    """Dependency that optionally returns the session payload."""
    return get_session_payload(request)

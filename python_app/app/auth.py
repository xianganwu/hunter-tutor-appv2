import hashlib
import hmac
import os
import secrets
import bcrypt
import jwt
from datetime import datetime, timedelta, UTC
from typing import Optional
from app.config import get_settings

settings = get_settings()

JWT_COOKIE_NAME = "hunter-tutor-session"
TOKEN_EXPIRY_DAYS = 30

# ─── Password Hashing (bcrypt) ────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        return False

# ─── JWT ─────────────────────────────────────────────────────────────

def create_session_token(student_id: str, name: str, email: str) -> str:
    """Create a JWT session token."""
    payload = {
        "sub": student_id,
        "name": name,
        "email": email,
        "iat": datetime.now(UTC),
        "exp": datetime.now(UTC) + timedelta(days=TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

def verify_session_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token. Returns payload dict or None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if not payload.get("sub"):
            return None
        return {"sub": payload["sub"], "name": payload.get("name", ""), "email": payload.get("email", "")}
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

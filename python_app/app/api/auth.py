"""Authentication API routes — port of src/app/api/auth/route.ts."""
import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import hash_password, verify_password, create_session_token, JWT_COOKIE_NAME, TOKEN_EXPIRY_DAYS
from app.dependencies import require_auth, get_session_payload
from app import models, schemas

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_MAX_AGE = TOKEN_EXPIRY_DAYS * 24 * 60 * 60


def _student_out(student: models.Student) -> dict:
    return {
        "id": student.id,
        "name": student.name,
        "email": student.email,
        "mascot_type": student.mascot_type,
        "mascot_name": student.mascot_name,
        "onboarding_complete": student.onboarding_complete,
    }


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=JWT_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


@router.get("")
def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    payload = get_session_payload(request)
    if not payload:
        return {"user": None}
    student = db.query(models.Student).filter(models.Student.id == payload["sub"]).first()
    if not student:
        return {"user": None}
    return {"user": _student_out(student)}


@router.post("")
def auth_action(
    body: dict,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Any:
    action = body.get("action")
    if action == "signup":
        return _handle_signup(body, response, db)
    elif action == "login":
        return _handle_login(body, response, db)
    elif action == "logout":
        return _handle_logout(response)
    elif action == "set_pin":
        return _handle_set_pin(body, request, db)
    elif action == "reset_password":
        return _handle_reset_password(body, response, db)
    elif action == "complete_onboarding":
        return _handle_complete_onboarding(request, db)
    elif action == "update_mascot":
        return _handle_update_mascot(body, request, db)
    elif action == "update_mascot_name":
        return _handle_update_mascot_name(body, request, db)
    else:
        raise HTTPException(status_code=400, detail="Unknown action")


def _handle_signup(body: dict, response: Response, db: Session) -> dict:
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    parent_pin = body.get("parent_pin") or body.get("parentPin")
    mascot_type = body.get("mascot_type") or body.get("mascotType") or "penguin"

    if not name or len(name) > 20:
        raise HTTPException(400, "Name must be 1-20 characters")
    if not email:
        raise HTTPException(400, "Email is required")
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if mascot_type not in ("penguin", "monkey", "phoenix", "dragon"):
        mascot_type = "penguin"

    existing = db.query(models.Student).filter(models.Student.email == email).first()
    if existing:
        raise HTTPException(409, "An account with this email already exists.")

    pw_hash = hash_password(password)
    pin_hash = hash_password(parent_pin) if parent_pin else None

    student = models.Student(
        name=name,
        email=email,
        password_hash=pw_hash,
        parent_pin_hash=pin_hash,
        mascot_type=mascot_type,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    token = create_session_token(student.id, student.name, student.email)
    _set_session_cookie(response, token)
    return {"user": _student_out(student)}


def _handle_login(body: dict, response: Response, db: Session) -> dict:
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    student = db.query(models.Student).filter(models.Student.email == email).first()
    if not student or not verify_password(password, student.password_hash):
        raise HTTPException(401, "Invalid email or password.")

    token = create_session_token(student.id, student.name, student.email)
    _set_session_cookie(response, token)
    return {"user": _student_out(student)}


def _handle_logout(response: Response) -> dict:
    response.delete_cookie(JWT_COOKIE_NAME, path="/")
    return {"success": True}


def _handle_set_pin(body: dict, request: Request, db: Session) -> dict:
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")
    parent_pin = body.get("parent_pin") or body.get("parentPin") or ""
    if not parent_pin:
        raise HTTPException(400, "parent_pin is required")

    pin_hash = hash_password(parent_pin)
    db.query(models.Student).filter(models.Student.id == payload["sub"]).update(
        {"parent_pin_hash": pin_hash}
    )
    db.commit()
    return {"success": True}


def _handle_reset_password(body: dict, response: Response, db: Session) -> dict:
    email = (body.get("email") or "").strip().lower()
    parent_pin = body.get("parent_pin") or body.get("parentPin") or ""
    new_password = body.get("new_password") or body.get("newPassword") or ""

    if len(new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")

    student = db.query(models.Student).filter(models.Student.email == email).first()
    if not student or not student.parent_pin_hash:
        raise HTTPException(401, "Invalid email or parent PIN.")

    if not verify_password(parent_pin, student.parent_pin_hash):
        raise HTTPException(401, "Invalid email or parent PIN.")

    new_hash = hash_password(new_password)
    db.query(models.Student).filter(models.Student.id == student.id).update(
        {"password_hash": new_hash}
    )
    db.commit()
    db.refresh(student)

    token = create_session_token(student.id, student.name, student.email)
    _set_session_cookie(response, token)
    return {"user": _student_out(student)}


def _handle_complete_onboarding(request: Request, db: Session) -> dict:
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")
    db.query(models.Student).filter(models.Student.id == payload["sub"]).update(
        {"onboarding_complete": True}
    )
    db.commit()
    return {"success": True}


def _handle_update_mascot(body: dict, request: Request, db: Session) -> dict:
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")
    mascot_type = body.get("mascot_type") or body.get("mascotType") or ""
    if mascot_type not in ("penguin", "monkey", "phoenix", "dragon"):
        raise HTTPException(400, "Invalid mascot type")
    db.query(models.Student).filter(models.Student.id == payload["sub"]).update(
        {"mascot_type": mascot_type}
    )
    db.commit()
    student = db.query(models.Student).filter(models.Student.id == payload["sub"]).first()
    return {"user": _student_out(student)}


def _handle_update_mascot_name(body: dict, request: Request, db: Session) -> dict:
    payload = get_session_payload(request)
    if not payload:
        raise HTTPException(401, "Not authenticated")
    mascot_name = (body.get("mascot_name") or body.get("mascotName") or "").strip()
    if not mascot_name or len(mascot_name) > 20:
        raise HTTPException(400, "mascot_name must be 1-20 characters")
    import re
    if not re.match(r"^[a-zA-Z0-9 ]+$", mascot_name):
        raise HTTPException(400, "mascot_name must be alphanumeric")
    db.query(models.Student).filter(models.Student.id == payload["sub"]).update(
        {"mascot_name": mascot_name}
    )
    db.commit()
    student = db.query(models.Student).filter(models.Student.id == payload["sub"]).first()
    return {"user": _student_out(student)}

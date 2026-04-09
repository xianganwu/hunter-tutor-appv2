"""
Hunter Tutor App — Python/FastAPI port.

Entry point: uvicorn main:app --reload
"""
import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path

from app.config import get_settings
from app.database import create_tables

# ─── Logging ─────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

# ─── Lifespan ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting Hunter Tutor Python App...")
    create_tables()
    logger.info("Database tables created/verified.")
    yield
    logger.info("Shutting down Hunter Tutor Python App.")


# ─── App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Hunter Tutor",
    description="Adaptive tutoring app for the Hunter College High School entrance exam.",
    version="2.0.0-python",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.app_url, "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Rate Limiting ─────────────────────────────────────────────────────

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_REQUESTS = 60
RATE_LIMIT_WINDOW = 60  # seconds


def clear_rate_limit_store() -> None:
    """Clear all rate-limit entries. Used in tests."""
    _rate_limit_store.clear()


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Only rate limit API routes; skip in test environment
    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    # testclient always uses "testclient" host — skip rate limiting for tests
    if client_ip == "testclient":
        return await call_next(request)

    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    # Clean old requests
    _rate_limit_store[client_ip] = [
        t for t in _rate_limit_store[client_ip] if t > window_start
    ]

    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"error": "Too many requests. Please slow down."},
            headers={"Retry-After": "60"},
        )

    _rate_limit_store[client_ip].append(now)
    return await call_next(request)


# ─── Security headers ─────────────────────────────────────────────────

@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if not settings.debug:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


# ─── API Routers ──────────────────────────────────────────────────────

from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.session import router as session_router
from app.api.progress import router as progress_router
from app.api.writing import router as writing_router
from app.api.mistakes import router as mistakes_router
from app.api.vocab import router as vocab_router
from app.api.reading import router as reading_router
from app.api.simulate import router as simulate_router
from app.api.parent import router as parent_router

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(session_router)
app.include_router(progress_router)
app.include_router(writing_router)
app.include_router(mistakes_router)
app.include_router(vocab_router)
app.include_router(reading_router)
app.include_router(simulate_router)
app.include_router(parent_router)

# ─── Static files + Templates ─────────────────────────────────────────

BASE_DIR = Path(__file__).parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# ─── Frontend routes ──────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def landing(request: Request):
    return templates.TemplateResponse(request, "landing.html", {"app_name": settings.app_name})


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse(request, "dashboard.html", {"app_name": settings.app_name})


@app.get("/tutor/{subject}", response_class=HTMLResponse)
async def tutor(request: Request, subject: str):
    valid_subjects = {"math", "reading", "writing", "math_achievement", "math_quantitative_reasoning", "reading_comprehension"}
    if subject not in valid_subjects:
        return HTMLResponse("<h1>Not Found</h1>", status_code=404)
    return templates.TemplateResponse(request, "tutor.html", {"subject": subject, "app_name": settings.app_name})


@app.get("/progress", response_class=HTMLResponse)
async def progress(request: Request):
    return templates.TemplateResponse(request, "progress.html", {"app_name": settings.app_name})


@app.get("/writing", response_class=HTMLResponse)
async def writing(request: Request):
    return templates.TemplateResponse(request, "writing.html", {"app_name": settings.app_name})


@app.get("/mistakes", response_class=HTMLResponse)
async def mistakes(request: Request):
    return templates.TemplateResponse(request, "mistakes.html", {"app_name": settings.app_name})


@app.get("/onboarding", response_class=HTMLResponse)
async def onboarding(request: Request):
    return templates.TemplateResponse(request, "onboarding.html", {"app_name": settings.app_name})


# ─── Health check ─────────────────────────────────────────────────────

@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "version": "2.0.0-python"}


# ─── Error handlers ───────────────────────────────────────────────────

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=404, content={"error": "Not found"})
    return HTMLResponse("<h1>Page not found</h1>", status_code=404)


@app.exception_handler(500)
async def server_error_handler(request: Request, exc):
    logger.error("Unhandled 500 error on %s: %s", request.url.path, exc)
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
    return HTMLResponse("<h1>Server error</h1>", status_code=500)

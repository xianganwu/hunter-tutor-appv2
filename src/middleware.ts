import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// ─── Rate limiting ────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const LIMIT = 60;
const WINDOW_MS = 60_000;
const JWT_COOKIE = "hunter-tutor-session";

const store = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < WINDOW_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "anonymous";
}

// ─── Auth check ───────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "hunter-tutor-default-jwt-secret-key-min-32-chars";
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(JWT_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return !!payload.sub;
  } catch {
    return false;
  }
}

/** Routes that require authentication (redirects to / if no session). */
const PROTECTED_PATHS = [
  "/dashboard",
  "/tutor",
  "/progress",
  "/simulate",
  "/mistakes",
  "/parent",
  "/onboarding",
  "/diagnostic",
  "/vocab",
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// ─── Middleware ────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth guard for protected pages
  if (isProtectedRoute(pathname)) {
    const valid = await hasValidSession(request);
    if (!valid) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const now = Date.now();
    cleanup(now);

    const ip = getClientIp(request);
    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      return NextResponse.next();
    }

    entry.count++;

    if (entry.count > LIMIT) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(LIMIT),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
          },
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/tutor/:path*",
    "/progress/:path*",
    "/simulate/:path*",
    "/mistakes/:path*",
    "/parent/:path*",
    "/onboarding/:path*",
    "/diagnostic/:path*",
    "/vocab/:path*",
  ],
};

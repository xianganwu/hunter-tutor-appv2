import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromCookie,
} from "@/lib/auth";

// ─── Schemas ──────────────────────────────────────────────────────────

const signupSchema = z.object({
  action: z.literal("signup"),
  name: z.string().min(1).max(20),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  action: z.literal("login"),
  email: z.string().email(),
  password: z.string().min(1),
});

const logoutSchema = z.object({
  action: z.literal("logout"),
});

const requestSchema = z.discriminatedUnion("action", [
  signupSchema,
  loginSchema,
  logoutSchema,
]);

// ─── GET /api/auth — get current user ─────────────────────────────────

export async function GET() {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({
      user: { id: session.sub, name: session.name, email: session.email },
    });
  } catch (err) {
    console.error("[auth] GET error:", err);
    return NextResponse.json({ user: null });
  }
}

// ─── POST /api/auth — signup / login / logout ─────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.action === "signup") {
      return await handleSignup(data);
    } else if (data.action === "login") {
      return await handleLogin(data);
    } else {
      return await handleLogout();
    }
  } catch (err) {
    console.error("[auth] POST error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────

async function handleSignup(data: z.infer<typeof signupSchema>) {
  const existing = await prisma.student.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(data.password);
  const student = await prisma.student.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
    },
  });

  const token = await createSessionToken({
    sub: student.id,
    name: student.name,
    email: student.email,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: student.id, name: student.name, email: student.email },
  });
}

async function handleLogin(data: z.infer<typeof loginSchema>) {
  const student = await prisma.student.findUnique({
    where: { email: data.email },
  });
  if (!student) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(data.password, student.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    sub: student.id,
    name: student.name,
    email: student.email,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: student.id, name: student.name, email: student.email },
  });
}

async function handleLogout() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}

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
  parentPin: z.string().regex(/^\d{4,6}$/).optional(),
  mascotType: z.enum(["penguin", "monkey", "phoenix", "dragon"]).default("penguin"),
});

const loginSchema = z.object({
  action: z.literal("login"),
  email: z.string().email(),
  password: z.string().min(1),
});

const logoutSchema = z.object({
  action: z.literal("logout"),
});

const setPinSchema = z.object({
  action: z.literal("set_pin"),
  parentPin: z.string().regex(/^\d{4,6}$/),
});

const resetPasswordSchema = z.object({
  action: z.literal("reset_password"),
  email: z.string().email(),
  parentPin: z.string().regex(/^\d{4,6}$/),
  newPassword: z.string().min(6).max(100),
});

const completeOnboardingSchema = z.object({
  action: z.literal("complete_onboarding"),
});

const updateMascotSchema = z.object({
  action: z.literal("update_mascot"),
  mascotType: z.enum(["penguin", "monkey", "phoenix", "dragon"]),
});

const requestSchema = z.discriminatedUnion("action", [
  signupSchema,
  loginSchema,
  logoutSchema,
  setPinSchema,
  resetPasswordSchema,
  completeOnboardingSchema,
  updateMascotSchema,
]);

// ─── GET /api/auth — get current user ─────────────────────────────────

export async function GET() {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ user: null });
    }
    const student = await prisma.student.findUnique({ where: { id: session.sub } });
    if (!student) {
      // JWT is valid but student was deleted — treat as unauthenticated
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        mascotType: student.mascotType ?? "penguin",
        onboardingComplete: student.onboardingComplete,
      },
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
    } else if (data.action === "set_pin") {
      return await handleSetPin(data);
    } else if (data.action === "reset_password") {
      return await handleResetPassword(data);
    } else if (data.action === "complete_onboarding") {
      return await handleCompleteOnboarding();
    } else if (data.action === "update_mascot") {
      return await handleUpdateMascot(data);
    } else {
      return await handleLogout();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth] POST error:", message, err);
    return NextResponse.json(
      {
        error: "Something went wrong. Please try again.",
        ...(process.env.NODE_ENV !== "production" ? { debug: message } : {}),
      },
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
  const parentPinHash = data.parentPin
    ? await hashPassword(data.parentPin)
    : null;
  const student = await prisma.student.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      parentPinHash,
      mascotType: data.mascotType,
    },
  });

  const token = await createSessionToken({
    sub: student.id,
    name: student.name,
    email: student.email,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: student.id, name: student.name, email: student.email, mascotType: student.mascotType, onboardingComplete: student.onboardingComplete },
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
    user: { id: student.id, name: student.name, email: student.email, mascotType: student.mascotType, onboardingComplete: student.onboardingComplete },
  });
}

async function handleSetPin(data: z.infer<typeof setPinSchema>) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parentPinHash = await hashPassword(data.parentPin);
  await prisma.student.update({
    where: { id: session.sub },
    data: { parentPinHash },
  });

  return NextResponse.json({ success: true });
}

async function handleResetPassword(data: z.infer<typeof resetPasswordSchema>) {
  const student = await prisma.student.findUnique({
    where: { email: data.email },
  });
  if (!student || !student.parentPinHash) {
    // Generic error to avoid email enumeration
    return NextResponse.json(
      { error: "Invalid email or parent PIN." },
      { status: 401 }
    );
  }

  const pinValid = await verifyPassword(data.parentPin, student.parentPinHash);
  if (!pinValid) {
    return NextResponse.json(
      { error: "Invalid email or parent PIN." },
      { status: 401 }
    );
  }

  const newPasswordHash = await hashPassword(data.newPassword);
  await prisma.student.update({
    where: { id: student.id },
    data: { passwordHash: newPasswordHash },
  });

  // Re-fetch to get updated student (and mascotType)
  const updated = await prisma.student.findUnique({ where: { id: student.id } });

  // Log the user in after reset
  const token = await createSessionToken({
    sub: student.id,
    name: student.name,
    email: student.email,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: student.id, name: student.name, email: student.email, mascotType: updated?.mascotType ?? "penguin", onboardingComplete: updated?.onboardingComplete ?? false },
  });
}

async function handleCompleteOnboarding() {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await prisma.student.update({
    where: { id: session.sub },
    data: { onboardingComplete: true },
  });

  return NextResponse.json({ success: true });
}

async function handleUpdateMascot(data: z.infer<typeof updateMascotSchema>) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const student = await prisma.student.update({
    where: { id: session.sub },
    data: { mascotType: data.mascotType },
  });

  return NextResponse.json({
    user: {
      id: student.id,
      name: student.name,
      email: student.email,
      mascotType: student.mascotType,
      onboardingComplete: student.onboardingComplete,
    },
  });
}

async function handleLogout() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getActiveUser,
  setActiveUser,
  addUser,
  setStoredAuthUser,
  getStoredAuthUser,
} from "@/lib/user-profile";
import {
  authLogin,
  authSignup,
  authGetUser,
  authResetPassword,
  initializeFromServer,
  syncProgressToServer,
  type MascotType,
} from "@/lib/auth-client";
type Mode = "login" | "signup" | "reset";

const MASCOT_TYPES: MascotType[] = ["penguin", "monkey", "phoenix", "dragon"];

export default function ProfilePicker() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [parentPin, setParentPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check if already logged in (cookie-based)
    async function checkSession() {
      const active = getActiveUser();
      const authUser = getStoredAuthUser();

      if (active && authUser) {
        // Verify the server session is still valid
        const serverUser = await authGetUser();
        if (serverUser) {
          router.replace("/dashboard");
          return;
        }
        // Server session expired — stay on login page
      }
      setReady(true);
    }
    checkSession();
  }, [router]);

  function clearForm() {
    setError("");
    setSuccess("");
  }

  async function handleLogin() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await authLogin(trimmedEmail, password);
      if (result.error) {
        setError(result.error);
        return;
      }

      const user = result.user!;
      setStoredAuthUser(user);
      addUser(user.name);
      setActiveUser(user.name);

      await initializeFromServer(user.name);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (trimmedName.length > 20) {
      setError("Name must be 20 characters or less.");
      return;
    }
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const trimmedPin = parentPin.trim();
      const mascot = MASCOT_TYPES[Math.floor(Math.random() * MASCOT_TYPES.length)];
      const result = await authSignup(trimmedName, trimmedEmail, password, trimmedPin || undefined, mascot);
      if (result.error) {
        setError(result.error);
        return;
      }

      const user = result.user!;
      setStoredAuthUser(user);
      addUser(user.name);
      setActiveUser(user.name);

      await syncProgressToServer(user.name);
      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    const trimmedEmail = email.trim();
    const trimmedPin = parentPin.trim();

    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (!trimmedPin || !/^\d{4,6}$/.test(trimmedPin)) {
      setError("Please enter your 4-6 digit parent PIN.");
      return;
    }
    if (password.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await authResetPassword(trimmedEmail, trimmedPin, password);
      if (result.error) {
        setError(result.error);
        return;
      }

      const user = result.user!;
      setStoredAuthUser(user);
      addUser(user.name);
      setActiveUser(user.name);

      setSuccess("Password reset successfully! Signing you in...");
      await initializeFromServer(user.name);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (mode === "login") {
      handleLogin();
    } else if (mode === "signup") {
      handleSignup();
    } else {
      handleReset();
    }
  }

  if (!ready) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-surface-50 px-4 dark:from-surface-950 dark:to-surface-900">
      <div className="w-full max-w-md text-center animate-fade-in">
        <h1 className="mb-2 text-3xl font-bold text-surface-900 dark:text-surface-100">
          Hunter Tutor
        </h1>
        <p className="mb-1 text-sm font-medium text-brand-600 dark:text-brand-400">
          Build Your Path to Any School You Want
        </p>
        <p className="mb-8 text-lg text-surface-500 dark:text-surface-400">
          {mode === "login"
            ? "Welcome back! Sign in to continue."
            : mode === "signup"
              ? "Create an account to get started."
              : "Reset your password using your parent PIN."}
        </p>

        <div className="space-y-4 animate-slide-up">
          {/* Name field — signup only */}
          {mode === "signup" && (
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearForm();
              }}
              placeholder="Your name"
              maxLength={20}
              autoFocus
              className="w-full rounded-2xl border border-surface-300 bg-white px-5 py-3.5 text-lg text-black placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-surface-600 dark:bg-surface-900 dark:text-white dark:placeholder:text-surface-500 dark:focus:border-brand-400 dark:focus:ring-brand-600/30"
            />
          )}

          {/* Email */}
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearForm();
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Email address"
            autoFocus={mode === "login"}
            className="w-full rounded-2xl border border-surface-300 bg-white px-5 py-3.5 text-lg text-black placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-surface-600 dark:bg-surface-900 dark:text-white dark:placeholder:text-surface-500 dark:focus:border-brand-400 dark:focus:ring-brand-600/30"
          />

          {/* Parent PIN — reset mode */}
          {mode === "reset" && (
            <input
              type="text"
              inputMode="numeric"
              value={parentPin}
              onChange={(e) => {
                setParentPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                clearForm();
              }}
              placeholder="Parent PIN (4-6 digits)"
              maxLength={6}
              className="w-full rounded-2xl border border-surface-300 bg-white px-5 py-3.5 text-lg text-black placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-surface-600 dark:bg-surface-900 dark:text-white dark:placeholder:text-surface-500 dark:focus:border-brand-400 dark:focus:ring-brand-600/30"
            />
          )}

          {/* Password */}
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearForm();
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={
              mode === "signup"
                ? "Create a password (6+ characters)"
                : mode === "reset"
                  ? "New password (6+ characters)"
                  : "Password"
            }
            className="w-full rounded-2xl border border-surface-300 bg-white px-5 py-3.5 text-lg text-black placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-surface-600 dark:bg-surface-900 dark:text-white dark:placeholder:text-surface-500 dark:focus:border-brand-400 dark:focus:ring-brand-600/30"
          />

          {/* Parent PIN — signup only (optional) */}
          {mode === "signup" && (
            <input
              type="text"
              inputMode="numeric"
              value={parentPin}
              onChange={(e) => {
                setParentPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                clearForm();
              }}
              placeholder="Parent PIN for password reset (optional, 4-6 digits)"
              maxLength={6}
              className="w-full rounded-2xl border border-surface-300 bg-white px-5 py-3.5 text-lg text-black placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-surface-600 dark:bg-surface-900 dark:text-white dark:placeholder:text-surface-500 dark:focus:border-brand-400 dark:focus:ring-brand-600/30"
            />
          )}

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-2xl bg-brand-600 py-3.5 text-lg font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60 dark:focus:ring-offset-surface-900"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : mode === "signup"
                  ? "Create Account"
                  : "Reset Password"}
          </button>

          {/* Toggle links */}
          <div className="space-y-1 text-sm text-surface-500 dark:text-surface-400">
            {mode === "login" && (
              <>
                <p>
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                    className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    Sign up
                  </button>
                </p>
                <p>
                  <button
                    onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}
                    className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    Forgot password?
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                  className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === "reset" && (
              <p>
                <button
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                  className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Back to sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

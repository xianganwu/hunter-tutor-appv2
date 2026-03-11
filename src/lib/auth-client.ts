// Client-side auth helpers — runs in the browser

import { enqueueSyncRetry, attachOnlineListener } from "./sync-queue";
import { DATA_KEYS } from "./data-keys";
import { getDirtyKeys, clearDirtyKeys } from "./user-profile";

export type MascotType = "penguin" | "monkey";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  mascotType?: MascotType;
  onboardingComplete?: boolean;
}

export async function authSignup(
  name: string,
  email: string,
  password: string,
  parentPin?: string,
  mascotType?: MascotType
): Promise<{ user?: AuthUser; error?: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signup", name, email, password, parentPin, mascotType: mascotType ?? "penguin" }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Signup failed" };
    return { user: data.user };
  } catch {
    return { error: "Unable to connect to the server. Please try again." };
  }
}

export async function authLogin(
  email: string,
  password: string
): Promise<{ user?: AuthUser; error?: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Login failed" };
    return { user: data.user };
  } catch {
    return { error: "Unable to connect to the server. Please try again." };
  }
}

export async function authLogout(): Promise<void> {
  await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "logout" }),
  });
}

export async function authSetParentPin(pin: string): Promise<{ error?: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_pin", parentPin: pin }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { error: data.error || "Failed to set PIN" };
    }
    return {};
  } catch {
    return { error: "Unable to connect to the server." };
  }
}

export async function authResetPassword(
  email: string,
  parentPin: string,
  newPassword: string
): Promise<{ user?: AuthUser; error?: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset_password",
        email,
        parentPin,
        newPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Password reset failed" };
    return { user: data.user };
  } catch {
    return { error: "Unable to connect to the server." };
  }
}

export async function authCompleteOnboarding(): Promise<{ error?: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete_onboarding" }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { error: data.error || "Failed to complete onboarding" };
    }
    return {};
  } catch {
    return { error: "Unable to connect to the server." };
  }
}

export async function authGetUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth");
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

// ─── Progress sync ────────────────────────────────────────────────────

/**
 * Upload all localStorage progress data to the server.
 * Call this after significant progress updates.
 */
export async function syncProgressToServer(userName: string): Promise<boolean> {
  try {
    const progress: Record<string, unknown> = {};
    for (const key of DATA_KEYS) {
      const storageKey = `hunter-tutor:${userName}:${key}`;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        try {
          progress[key] = JSON.parse(raw);
        } catch {
          progress[key] = raw;
        }
      }
    }

    if (Object.keys(progress).length === 0) return true;

    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Download progress from server and write to localStorage.
 * Call this on login to restore progress on a new device.
 */
export async function syncProgressFromServer(
  userName: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/progress");
    if (!res.ok) return false;
    const data = await res.json();
    const progress = data.progress as Record<string, unknown>;

    for (const [key, value] of Object.entries(progress)) {
      const storageKey = `hunter-tutor:${userName}:${key}`;
      localStorage.setItem(storageKey, JSON.stringify(value));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize localStorage from server data on login.
 * Uploads any dirty (unsynced) local changes first, then pulls all server data.
 */
export async function initializeFromServer(userName: string): Promise<boolean> {
  try {
    // 1. Check for dirty keys (unsynced localStorage changes)
    const dirtyKeys = getDirtyKeys();
    if (dirtyKeys.size > 0) {
      // Upload dirty keys first so we don't lose local work
      const dirtyProgress: Record<string, unknown> = {};
      for (const key of dirtyKeys) {
        const storageKey = `hunter-tutor:${userName}:${key}`;
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          try {
            dirtyProgress[key] = JSON.parse(raw);
          } catch {
            dirtyProgress[key] = raw;
          }
        }
      }

      if (Object.keys(dirtyProgress).length > 0) {
        await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress: dirtyProgress }),
        });
      }
    }

    // 2. GET all server data
    const res = await fetch("/api/progress");
    if (!res.ok) return false;
    const data = await res.json();
    const progress = data.progress as Record<string, unknown>;

    // 3. Populate localStorage with server data
    for (const [key, value] of Object.entries(progress)) {
      const storageKey = `hunter-tutor:${userName}:${key}`;
      localStorage.setItem(storageKey, JSON.stringify(value));
    }

    // 4. Clear dirty keys
    clearDirtyKeys();
    return true;
  } catch {
    return false;
  }
}

/**
 * Debounced background sync — saves progress to server.
 * Safe to call frequently; only syncs at most once per 5 seconds.
 * If offline or sync fails, queues for retry when connection returns.
 */
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let onlineListenerReady = false;

export function scheduleSyncToServer(userName: string): void {
  // Attach online listener once (retries queued syncs when back online)
  if (!onlineListenerReady) {
    onlineListenerReady = true;
    attachOnlineListener(syncProgressToServer);
  }

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    syncTimeout = null;

    // If offline, queue immediately
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueSyncRetry(userName);
      return;
    }

    const ok = await syncProgressToServer(userName);
    if (!ok) {
      enqueueSyncRetry(userName);
    }
  }, 5000);
}

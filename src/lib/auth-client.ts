// Client-side auth helpers — runs in the browser

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export async function authSignup(
  name: string,
  email: string,
  password: string
): Promise<{ user?: AuthUser; error?: string }> {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signup", name, email, password }),
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

const DATA_KEYS = [
  "skill-mastery",
  "mistakes",
  "simulations",
  "reading-stamina",
  "teaching-moments",
  "essays",
] as const;

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
 * Debounced background sync — saves progress to server.
 * Safe to call frequently; only syncs at most once per 5 seconds.
 */
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

export function scheduleSyncToServer(userName: string): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncProgressToServer(userName);
    syncTimeout = null;
  }, 5000);
}

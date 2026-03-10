import { scheduleSyncToServer } from "./auth-client";

const ACTIVE_USER_KEY = "hunter-tutor:active-user";
const USERS_KEY = "hunter-tutor:users";
const AUTH_USER_KEY = "hunter-tutor:auth-user";

const DATA_SUFFIXES = [
  "skill-mastery",
  "mistakes",
  "simulations",
  "reading-stamina",
  "teaching-moments",
  "essays",
] as const;

export function getActiveUser(): string | null {
  try {
    return localStorage.getItem(ACTIVE_USER_KEY);
  } catch {
    return null;
  }
}

export function setActiveUser(name: string): void {
  try {
    localStorage.setItem(ACTIVE_USER_KEY, name);
  } catch {
    // localStorage unavailable
  }
}

export function clearActiveUser(): void {
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
  } catch {
    // localStorage unavailable
  }
}

export function getUserList(): string[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) return [];
    return JSON.parse(data) as string[];
  } catch {
    return [];
  }
}

export function addUser(name: string): void {
  const users = getUserList();
  if (users.some((u) => u.toLowerCase() === name.toLowerCase())) return;
  users.push(name);
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // localStorage unavailable
  }
}

export function removeUser(name: string): void {
  const users = getUserList().filter(
    (u) => u.toLowerCase() !== name.toLowerCase()
  );
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    for (const suffix of DATA_SUFFIXES) {
      localStorage.removeItem(`hunter-tutor:${name}:${suffix}`);
    }
    const active = getActiveUser();
    if (active?.toLowerCase() === name.toLowerCase()) {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

export function resetUserProgress(name: string): void {
  try {
    for (const suffix of DATA_SUFFIXES) {
      localStorage.removeItem(`hunter-tutor:${name}:${suffix}`);
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Returns the namespaced localStorage key for the active user.
 * If no user is active, returns the original key for backward compatibility.
 */
export function getStorageKey(baseKey: string): string {
  const user = getActiveUser();
  if (!user) return baseKey;
  const suffix = baseKey.replace(/^hunter-tutor-/, "");
  return `hunter-tutor:${user}:${suffix}`;
}

/**
 * Check whether un-namespaced (legacy) data exists.
 */
export function hasLegacyData(): boolean {
  try {
    return DATA_SUFFIXES.some(
      (suffix) => localStorage.getItem(`hunter-tutor-${suffix}`) !== null
    );
  } catch {
    return false;
  }
}

/**
 * Migrate legacy un-namespaced data to a user's namespace.
 * Copies each old key's data to the namespaced key, then removes the old key.
 */
export function migrateAnonymousData(targetUser: string): void {
  try {
    for (const suffix of DATA_SUFFIXES) {
      const oldKey = `hunter-tutor-${suffix}`;
      const data = localStorage.getItem(oldKey);
      if (data) {
        localStorage.setItem(`hunter-tutor:${targetUser}:${suffix}`, data);
        localStorage.removeItem(oldKey);
      }
    }
  } catch {
    // localStorage unavailable
  }
}

// ─── Authenticated user helpers ──────────────────────────────────────

export interface StoredAuthUser {
  id: string;
  name: string;
  email: string;
}

export function getStoredAuthUser(): StoredAuthUser | null {
  try {
    const data = localStorage.getItem(AUTH_USER_KEY);
    if (!data) return null;
    return JSON.parse(data) as StoredAuthUser;
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user: StoredAuthUser): void {
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    // localStorage unavailable
  }
}

export function clearStoredAuthUser(): void {
  try {
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    // localStorage unavailable
  }
}

/**
 * Call after any progress data is saved to localStorage.
 * Schedules a debounced background sync to the server if user is authenticated.
 */
export function notifyProgressChanged(): void {
  const user = getActiveUser();
  const authUser = getStoredAuthUser();
  if (user && authUser) {
    scheduleSyncToServer(user);
  }
}

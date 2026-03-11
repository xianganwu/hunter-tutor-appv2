import { scheduleSyncToServer } from "./auth-client";
import { DATA_KEYS, type DataKey } from "./data-keys";

const ACTIVE_USER_KEY = "hunter-tutor:active-user";
const USERS_KEY = "hunter-tutor:users";
const AUTH_USER_KEY = "hunter-tutor:auth-user";
const DIRTY_KEYS_KEY = "hunter-tutor:dirty-keys";

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
    for (const suffix of DATA_KEYS) {
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
    for (const suffix of DATA_KEYS) {
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
    return DATA_KEYS.some(
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
    for (const suffix of DATA_KEYS) {
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
  mascotType?: "penguin" | "monkey";
  onboardingComplete?: boolean;
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

export function getStoredMascotType(): "penguin" | "monkey" {
  const user = getStoredAuthUser();
  return user?.mascotType === "monkey" ? "monkey" : "penguin";
}

export function clearStoredAuthUser(): void {
  try {
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    // localStorage unavailable
  }
}

// ─── Dirty key tracking ─────────────────────────────────────────────

export function markKeyDirty(key: DataKey): void {
  try {
    const dirty = getDirtyKeys();
    dirty.add(key);
    localStorage.setItem(DIRTY_KEYS_KEY, JSON.stringify([...dirty]));
  } catch {
    // localStorage unavailable
  }
}

export function getDirtyKeys(): Set<DataKey> {
  try {
    const raw = localStorage.getItem(DIRTY_KEYS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as DataKey[]);
  } catch {
    return new Set();
  }
}

export function clearDirtyKeys(): void {
  try {
    localStorage.removeItem(DIRTY_KEYS_KEY);
  } catch {
    // localStorage unavailable
  }
}

/**
 * Call after any progress data is saved to localStorage.
 * Optionally accepts the data key that changed so it can be tracked as dirty.
 * Schedules a debounced background sync to the server if user is authenticated.
 */
export function notifyProgressChanged(key?: DataKey): void {
  if (key) {
    markKeyDirty(key);
  }
  const user = getActiveUser();
  const authUser = getStoredAuthUser();
  if (user && authUser) {
    scheduleSyncToServer(user);
  }
}

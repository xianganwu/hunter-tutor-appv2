"use client";

import { useEffect, useState, useRef } from "react";
import { getStoredAuthUser, getActiveUser } from "@/lib/user-profile";
import {
  initializeFromServer,
  syncProgressToServer,
  flushSyncImmediate,
} from "@/lib/auth-client";
import { DATA_KEYS } from "@/lib/data-keys";

/**
 * Ensures localStorage progress is always hydrated from the database.
 * Wrap around app content in layout.tsx so it runs once per session.
 *
 * - If returning user (localStorage has data): renders immediately, hydrates in background
 * - If fresh session (localStorage empty): shows brief loader, blocks until hydration completes
 * - Registers beforeunload + visibilitychange handlers to flush dirty data
 */
export function ProgressHydrator({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const hadAuthKeysRef = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const authUser = getStoredAuthUser();
    const activeUser = getActiveUser();

    if (!authUser || !activeUser) {
      // Not logged in — render immediately
      setReady(true);
      return;
    }

    // Check if localStorage already has progress data (returning user)
    const hasLocalData = DATA_KEYS.some(
      (key) => localStorage.getItem(`hunter-tutor:${activeUser}:${key}`) !== null,
    );

    if (hasLocalData) {
      // Returning user — render immediately, hydrate in background
      setReady(true);
      initializeFromServer(activeUser).catch(() => {
        // Hydration failed — local data still available
      });
    } else {
      // Fresh session (cleared browser or new device) — block until hydrated
      initializeFromServer(activeUser)
        .catch(() => {
          // Hydration failed — proceed anyway
        })
        .finally(() => {
          setReady(true);
        });
    }
  }, []);

  // Register beforeunload and visibilitychange handlers
  useEffect(() => {
    function handleBeforeUnload() {
      const activeUser = getActiveUser();
      if (activeUser) {
        flushSyncImmediate(activeUser);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        const activeUser = getActiveUser();
        const authUser = getStoredAuthUser();
        if (activeUser && authUser) {
          // Immediate sync when tab is backgrounded
          syncProgressToServer(activeUser).catch(() => {
            // Sync failed — will retry on next opportunity
          });
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // ── Detect external localStorage clearing ──
  useEffect(() => {
    hadAuthKeysRef.current = !!getStoredAuthUser() && !!getActiveUser();

    // Cross-tab detection: storage event fires when another tab modifies localStorage
    function handleStorageChange(e: StorageEvent) {
      if (
        (e.key === "hunter-tutor:auth-user" || e.key === "hunter-tutor:active-user") &&
        e.newValue === null &&
        hadAuthKeysRef.current
      ) {
        console.warn("[ProgressHydrator] Auth keys cleared externally, attempting recovery");
        const activeUser = getActiveUser();
        if (activeUser) {
          initializeFromServer(activeUser).catch(() => {
            // Recovery failed — user will need to re-login
          });
        }
      }
    }

    // Same-tab detection: periodic integrity check (storage event only fires cross-tab)
    const checkInterval = setInterval(() => {
      const hasAuth = !!getStoredAuthUser();
      const hasActive = !!getActiveUser();

      if (hadAuthKeysRef.current && !hasAuth && !hasActive) {
        console.warn("[ProgressHydrator] Auth keys missing (same-tab clear detected)");
        hadAuthKeysRef.current = false;
      }

      if (hasAuth && hasActive) {
        hadAuthKeysRef.current = true;
      }
    }, 30_000);

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50 dark:bg-surface-950">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Loading your progress...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

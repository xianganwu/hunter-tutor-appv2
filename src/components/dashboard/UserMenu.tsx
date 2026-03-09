"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getActiveUser,
  clearActiveUser,
  resetUserProgress,
  removeUser,
} from "@/lib/user-profile";

export function UserMenu() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    const active = getActiveUser();
    if (!active) {
      router.replace("/");
      return;
    }
    setUserName(active);
  }, [router]);

  function handleSwitchUser() {
    clearActiveUser();
    router.push("/");
  }

  function handleReset() {
    if (!userName) return;
    if (confirmText.toLowerCase() !== userName.toLowerCase()) return;
    resetUserProgress(userName);
    setShowReset(false);
    setConfirmText("");
    window.location.reload();
  }

  function handleDeleteProfile() {
    if (!userName) return;
    if (confirmText.toLowerCase() !== userName.toLowerCase()) return;
    removeUser(userName);
    clearActiveUser();
    router.push("/");
  }

  if (!userName) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSwitchUser}
          className="rounded-xl border border-surface-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-surface-600 transition-colors hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-400 dark:hover:bg-surface-800"
        >
          Switch User
        </button>
        <button
          onClick={() => setShowReset(true)}
          className="rounded-xl border border-red-200 bg-surface-0 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-surface-900 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          Reset
        </button>
      </div>

      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/50 px-4 backdrop-blur-sm dark:bg-black/60">
          <div className="w-full max-w-sm rounded-2xl bg-surface-0 p-6 shadow-xl animate-scale-in dark:bg-surface-900">
            <h3 className="mb-2 text-lg font-bold text-surface-900 dark:text-surface-100">
              Reset Progress
            </h3>
            <p className="mb-1 text-sm text-surface-600 dark:text-surface-400">
              This will erase all of {userName}&apos;s practice data:
            </p>
            <ul className="mb-4 list-inside list-disc text-sm text-surface-500 dark:text-surface-400">
              <li>Skill mastery levels</li>
              <li>Mistake journal</li>
              <li>Practice exam history</li>
              <li>Reading progress</li>
              <li>Writing essays</li>
              <li>Teaching moments</li>
            </ul>
            <p className="mb-3 text-sm text-surface-700 dark:text-surface-300">
              Type <strong>{userName}</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={userName}
              autoFocus
              className="mb-4 w-full rounded-xl border border-surface-300 bg-surface-0 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:focus:ring-red-800"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowReset(false);
                  setConfirmText("");
                }}
                className="flex-1 rounded-xl border border-surface-200 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={
                  confirmText.toLowerCase() !== userName.toLowerCase()
                }
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
              >
                Reset
              </button>
              <button
                onClick={handleDeleteProfile}
                disabled={
                  confirmText.toLowerCase() !== userName.toLowerCase()
                }
                className="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                title="Delete profile entirely"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

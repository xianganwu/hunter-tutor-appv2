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
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
          {userName[0].toUpperCase()}
        </span>
        <span className="font-medium text-gray-900">{userName}</span>
        <button
          onClick={handleSwitchUser}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          Switch User
        </button>
        <button
          onClick={() => setShowReset(true)}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
        >
          Reset Progress
        </button>
      </div>

      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-gray-900">
              Reset Progress
            </h3>
            <p className="mb-1 text-sm text-gray-600">
              This will erase all of {userName}&apos;s practice data:
            </p>
            <ul className="mb-4 list-inside list-disc text-sm text-gray-500">
              <li>Skill mastery levels</li>
              <li>Mistake journal</li>
              <li>Practice exam history</li>
              <li>Reading progress</li>
              <li>Writing essays</li>
              <li>Teaching moments</li>
            </ul>
            <p className="mb-3 text-sm text-gray-700">
              Type <strong>{userName}</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={userName}
              autoFocus
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowReset(false);
                  setConfirmText("");
                }}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={
                  confirmText.toLowerCase() !== userName.toLowerCase()
                }
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-40"
              >
                Reset
              </button>
              <button
                onClick={handleDeleteProfile}
                disabled={
                  confirmText.toLowerCase() !== userName.toLowerCase()
                }
                className="rounded-lg border border-red-300 py-2 px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                title="Delete profile entirely"
              >
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

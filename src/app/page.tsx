"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getActiveUser,
  setActiveUser,
  getUserList,
  addUser,
  hasLegacyData,
  migrateAnonymousData,
} from "@/lib/user-profile";
import { Mascot } from "@/components/shared/Mascot";

export default function ProfilePicker() {
  const router = useRouter();
  const [users, setUsers] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [hasLegacy, setHasLegacy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const active = getActiveUser();
    if (active) {
      router.replace("/dashboard");
      return;
    }
    const list = getUserList();
    setUsers(list);
    setHasLegacy(hasLegacyData());
    if (list.length === 0) setShowAdd(true);
    setReady(true);
  }, [router]);

  function selectUser(name: string) {
    setActiveUser(name);
    router.push("/dashboard");
  }

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or less.");
      return;
    }
    if (users.some((u) => u.toLowerCase() === trimmed.toLowerCase())) {
      setError("That name is already taken.");
      return;
    }

    if (hasLegacy && users.length === 0) {
      migrateAnonymousData(trimmed);
      setHasLegacy(false);
    }

    addUser(trimmed);
    setActiveUser(trimmed);
    router.push("/dashboard");
  }

  if (!ready) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-surface-50 px-4 dark:from-surface-950 dark:to-surface-900">
      <div className="w-full max-w-md text-center animate-fade-in">
        {/* Mascot */}
        <div className="mb-6 flex justify-center">
          <Mascot tier={1} size="lg" />
        </div>

        <h1 className="mb-2 text-3xl font-bold text-surface-900 dark:text-surface-100">
          Hunter Tutor
        </h1>
        <p className="mb-8 text-lg text-surface-500 dark:text-surface-400">
          {hasLegacy && users.length === 0
            ? "Welcome back! Enter your name to keep your progress."
            : "Who\u2019s practicing today?"}
        </p>

        {users.length > 0 && !showAdd && (
          <div className="mb-6 space-y-3">
            {users.map((name) => (
              <button
                key={name}
                onClick={() => selectUser(name)}
                className="flex w-full items-center gap-4 rounded-2xl border border-surface-200 bg-surface-0 px-5 py-4 text-left shadow-soft transition-all hover:border-brand-300 hover:shadow-card dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-500/40"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-400">
                  {name[0].toUpperCase()}
                </span>
                <span className="text-lg font-medium text-surface-900 dark:text-surface-100">
                  {name}
                </span>
              </button>
            ))}
          </div>
        )}

        {showAdd ? (
          <div className="space-y-4 animate-slide-up">
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Enter your name"
              maxLength={20}
              autoFocus
              className="w-full rounded-2xl border border-surface-300 bg-white px-5 py-3.5 text-lg text-black placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-surface-600 dark:bg-surface-900 dark:text-white dark:placeholder:text-surface-500 dark:focus:border-brand-400 dark:focus:ring-brand-600/30"
            />
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
            <button
              onClick={handleAdd}
              className="w-full rounded-2xl bg-brand-600 py-3.5 text-lg font-semibold text-white shadow-glow transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
            >
              Start Practicing
            </button>
            {users.length > 0 && (
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewName("");
                  setError("");
                }}
                className="text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300"
              >
                Back to profiles
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full rounded-2xl border-2 border-dashed border-surface-300 py-4 text-surface-500 transition-all hover:border-brand-400 hover:text-brand-600 dark:border-surface-600 dark:text-surface-400 dark:hover:border-brand-500 dark:hover:text-brand-400"
          >
            + Add new profile
          </button>
        )}
      </div>
    </div>
  );
}

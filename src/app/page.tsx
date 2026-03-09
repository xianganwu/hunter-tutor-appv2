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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          Hunter Tutor
        </h1>
        <p className="mb-8 text-lg text-gray-600">
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
                className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                  {name[0].toUpperCase()}
                </span>
                <span className="text-lg font-medium text-gray-900">
                  {name}
                </span>
              </button>
            ))}
          </div>
        )}

        {showAdd ? (
          <div className="space-y-4">
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
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              onClick={handleAdd}
              className="w-full rounded-xl bg-blue-600 py-3 text-lg font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Back to profiles
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 py-4 text-gray-500 transition hover:border-blue-400 hover:text-blue-600"
          >
            + Add new profile
          </button>
        )}
      </div>
    </div>
  );
}

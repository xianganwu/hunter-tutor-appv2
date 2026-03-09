import { describe, it, expect, beforeEach } from "vitest";
import {
  getActiveUser,
  setActiveUser,
  clearActiveUser,
  getUserList,
  addUser,
  removeUser,
  resetUserProgress,
  getStorageKey,
  hasLegacyData,
  migrateAnonymousData,
} from "./user-profile";

function isLocalStorageAvailable(): boolean {
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    return true;
  } catch {
    return false;
  }
}

beforeEach(() => {
  if (!isLocalStorageAvailable()) return;
  localStorage.clear();
});

describe("getStorageKey", () => {
  it("returns original key when no active user", () => {
    expect(getStorageKey("hunter-tutor-skill-mastery")).toBe(
      "hunter-tutor-skill-mastery"
    );
  });

  it("returns namespaced key when active user is set", () => {
    if (!isLocalStorageAvailable()) return;
    setActiveUser("Emma");
    expect(getStorageKey("hunter-tutor-skill-mastery")).toBe(
      "hunter-tutor:Emma:skill-mastery"
    );
    expect(getStorageKey("hunter-tutor-mistakes")).toBe(
      "hunter-tutor:Emma:mistakes"
    );
  });
});

describe("active user", () => {
  it("returns null when no user is set", () => {
    expect(getActiveUser()).toBeNull();
  });

  it("round-trips set and get", () => {
    if (!isLocalStorageAvailable()) return;
    setActiveUser("Jake");
    expect(getActiveUser()).toBe("Jake");
  });

  it("clears active user", () => {
    if (!isLocalStorageAvailable()) return;
    setActiveUser("Jake");
    clearActiveUser();
    expect(getActiveUser()).toBeNull();
  });
});

describe("user list", () => {
  it("returns empty array initially", () => {
    expect(getUserList()).toEqual([]);
  });

  it("adds and retrieves users", () => {
    if (!isLocalStorageAvailable()) return;
    addUser("Emma");
    addUser("Jake");
    expect(getUserList()).toEqual(["Emma", "Jake"]);
  });

  it("prevents duplicate names (case-insensitive)", () => {
    if (!isLocalStorageAvailable()) return;
    addUser("Emma");
    addUser("emma");
    addUser("EMMA");
    expect(getUserList()).toEqual(["Emma"]);
  });

  it("removes a user and their data", () => {
    if (!isLocalStorageAvailable()) return;
    addUser("Emma");
    addUser("Jake");
    localStorage.setItem("hunter-tutor:Emma:skill-mastery", "[]");
    localStorage.setItem("hunter-tutor:Emma:mistakes", "[]");

    removeUser("Emma");
    expect(getUserList()).toEqual(["Jake"]);
    expect(localStorage.getItem("hunter-tutor:Emma:skill-mastery")).toBeNull();
    expect(localStorage.getItem("hunter-tutor:Emma:mistakes")).toBeNull();
  });

  it("clears active user when that user is removed", () => {
    if (!isLocalStorageAvailable()) return;
    addUser("Emma");
    setActiveUser("Emma");
    removeUser("Emma");
    expect(getActiveUser()).toBeNull();
  });
});

describe("resetUserProgress", () => {
  it("clears all 6 data keys for user", () => {
    if (!isLocalStorageAvailable()) return;
    const suffixes = [
      "skill-mastery",
      "mistakes",
      "simulations",
      "reading-stamina",
      "teaching-moments",
      "essays",
    ];
    for (const s of suffixes) {
      localStorage.setItem(`hunter-tutor:Emma:${s}`, "data");
    }

    resetUserProgress("Emma");

    for (const s of suffixes) {
      expect(localStorage.getItem(`hunter-tutor:Emma:${s}`)).toBeNull();
    }
  });

  it("does not affect other users", () => {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem("hunter-tutor:Emma:mistakes", "[1]");
    localStorage.setItem("hunter-tutor:Jake:mistakes", "[2]");

    resetUserProgress("Emma");

    expect(localStorage.getItem("hunter-tutor:Emma:mistakes")).toBeNull();
    expect(localStorage.getItem("hunter-tutor:Jake:mistakes")).toBe("[2]");
  });
});

describe("legacy data migration", () => {
  it("detects legacy data", () => {
    if (!isLocalStorageAvailable()) return;
    expect(hasLegacyData()).toBe(false);

    localStorage.setItem("hunter-tutor-skill-mastery", "[]");
    expect(hasLegacyData()).toBe(true);
  });

  it("migrates legacy data to a user namespace", () => {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem("hunter-tutor-skill-mastery", '[{"skillId":"a"}]');
    localStorage.setItem("hunter-tutor-mistakes", '[{"id":"m1"}]');

    migrateAnonymousData("Emma");

    expect(localStorage.getItem("hunter-tutor:Emma:skill-mastery")).toBe(
      '[{"skillId":"a"}]'
    );
    expect(localStorage.getItem("hunter-tutor:Emma:mistakes")).toBe(
      '[{"id":"m1"}]'
    );
    // Old keys removed
    expect(localStorage.getItem("hunter-tutor-skill-mastery")).toBeNull();
    expect(localStorage.getItem("hunter-tutor-mistakes")).toBeNull();
  });
});

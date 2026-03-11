/**
 * Single source of truth for all localStorage data keys that sync to the server.
 * Import this everywhere instead of maintaining separate key lists.
 */
export const DATA_KEYS = [
  "skill-mastery",
  "mistakes",
  "simulations",
  "reading-stamina",
  "teaching-moments",
  "essays",
  "badges",
  "mascot-customization",
  "daily-plan",
  "drills",
  "weekly-snapshots",
  "vocab-deck",
] as const;

export type DataKey = (typeof DATA_KEYS)[number];

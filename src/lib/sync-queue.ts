/**
 * Offline-resilient sync queue.
 * Queues progress syncs when offline and retries when connectivity returns.
 */

const QUEUE_KEY = "hunter-tutor:sync-queue";

interface QueuedSync {
  userName: string;
  timestamp: number;
}

// ─── Queue persistence ────────────────────────────────────────────────

function getQueue(): QueuedSync[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSync[]) : [];
  } catch {
    return [];
  }
}

function setQueue(queue: QueuedSync[]): void {
  if (typeof window === "undefined") return;
  try {
    if (queue.length === 0) {
      localStorage.removeItem(QUEUE_KEY);
    } else {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // localStorage full or unavailable
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Add a sync to the queue. Deduplicates by userName (keeps latest).
 */
export function enqueueSyncRetry(userName: string): void {
  const queue = getQueue().filter((q) => q.userName !== userName);
  queue.push({ userName, timestamp: Date.now() });
  setQueue(queue);
}

/**
 * Check if there are queued syncs pending.
 */
export function hasPendingSyncs(): boolean {
  return getQueue().length > 0;
}

/**
 * Flush all queued syncs. Calls the provided sync function for each.
 * Removes successfully synced items from the queue.
 * Returns the number of successful syncs.
 */
export async function flushSyncQueue(
  syncFn: (userName: string) => Promise<boolean>
): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  let successCount = 0;
  const remaining: QueuedSync[] = [];

  for (const item of queue) {
    try {
      const ok = await syncFn(item.userName);
      if (ok) {
        successCount++;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  setQueue(remaining);
  return successCount;
}

// ─── Online/Offline listener ─────────────────────────────────────────

let listenerAttached = false;

/**
 * Attach a listener that flushes the sync queue when the browser comes back online.
 * Safe to call multiple times (idempotent).
 */
export function attachOnlineListener(
  syncFn: (userName: string) => Promise<boolean>
): void {
  if (typeof window === "undefined" || listenerAttached) return;
  listenerAttached = true;

  window.addEventListener("online", () => {
    void flushSyncQueue(syncFn);
  });

  // Also try flushing on page visibility change (e.g., user switches back to tab)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      void flushSyncQueue(syncFn);
    }
  });
}

// ─── queryClient.ts ───────────────────────────────────────────────────────────
// Simple, clean, offline-first.
// Rules:
//   1. No custom offline queue — TanStack persister handles cache survival
//   2. No optimistic updates — server is source of truth
//   3. networkMode "offlineFirst" — serves cache when offline, no errors
//   4. Bump CACHE_BUSTER if data schema changes and old cache must be cleared

import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

const CACHE_BUSTER = "v2"; // ← bump this to invalidate all cached data

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   1000 * 60 * 5,            // 5 min — don't refetch recent data
      gcTime:      1000 * 60 * 60 * 24 * 7,  // keep in memory 7 days
      retry:       1,
      networkMode: "offlineFirst",            // serve cache on network failure
    },
    mutations: {
      retry:       0,
      networkMode: "always",                  // attempt mutation, fail fast if offline
    },
  },
});

// ─── Persist to localStorage ──────────────────────────────────────────────────
// Data survives page refresh and browser close.
// If localStorage is corrupt, clear and continue gracefully.
function makeSafeStorage() {
  return {
    getItem: (key: string) => {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    setItem: (key: string, value: string) => {
      try { window.localStorage.setItem(key, value); } catch {}
    },
    removeItem: (key: string) => {
      try { window.localStorage.removeItem(key); } catch {}
    },
  };
}

const PERSIST_KEY = "uscout-cache-v1";

// Clear corrupt cache on startup
try {
  const raw = window.localStorage.getItem(PERSIST_KEY);
  if (raw) JSON.parse(raw);
} catch {
  try { window.localStorage.removeItem(PERSIST_KEY); } catch {}
}

persistQueryClient({
  queryClient,
  persister: createSyncStoragePersister({
    storage:      makeSafeStorage(),
    key:          PERSIST_KEY,
    throttleTime: 1000,
  }),
  maxAge: 1000 * 60 * 60 * 24 * 7,
  buster: CACHE_BUSTER,
});

// ─── API request ──────────────────────────────────────────────────────────────
// Single place for all HTTP calls.
// Throws on non-OK responses so mutations can catch and handle.
export async function apiRequest(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  url:    string,
  body?:  unknown,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers:     body ? { "Content-Type": "application/json" } : {},
    body:        body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${method} ${url} → ${res.status}: ${text}`);
  }
  return res;
}

// ─── Offline mutation queue (players) ─────────────────────────────────────────
// Minimal sync model:
// - UI updates optimistically via TanStack Query cache
// - When offline/network fails, we persist mutations to localStorage
// - On reconnect, we replay in order and reconcile temp ids
const OFFLINE_QUEUE_KEY = "uscout-offline-mutations-v1";
const TEMP_REAL_MAP_KEY = "uscout-temp-real-map-v1";

type QueuedMutation =
  | { id: string; kind: "create"; tempId: string; teamId: string; payload: any }
  | { id: string; kind: "update"; playerId: string; updates: any }
  | { id: string; kind: "delete"; playerId: string };

function readQueue(): QueuedMutation[] {
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]) {
  try { window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

function readTempMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(TEMP_REAL_MAP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTempMap(map: Record<string, string>) {
  try { window.localStorage.setItem(TEMP_REAL_MAP_KEY, JSON.stringify(map)); } catch {}
}

export function enqueueOfflinePlayerMutation(m: QueuedMutation) {
  const q = readQueue();
  q.push(m);
  writeQueue(q);
}

let flushInFlight = false;
export async function flushOfflinePlayerMutations() {
  if (flushInFlight) return;
  flushInFlight = true;
  try {
    const queue = readQueue();
    if (!queue.length) return;

    const tempMap = readTempMap();
    const remaining: QueuedMutation[] = [];

    for (const entry of queue) {
      try {
        if (entry.kind === "create") {
          const res = await apiRequest("POST", "/api/players", entry.payload);
          const created = await res.json();

          tempMap[entry.tempId] = created.id;
          writeTempMap(tempMap);

          const tempPlayer = queryClient.getQueryData<any>(["/api/players", entry.tempId]);
          const merged = tempPlayer ? { ...created, ...tempPlayer, id: created.id } : created;

          queryClient.setQueryData(["/api/players", merged.id], merged);
          queryClient.setQueryData(["/api/players"], (old: any[] | undefined) => {
            const arr = old ?? [];
            const withoutTemp = arr.filter(p => p.id !== entry.tempId);
            const withoutDup = withoutTemp.filter(p => p.id !== merged.id);
            return [...withoutDup, merged];
          });
          queryClient.setQueryData(["/api/players", entry.teamId], (old: any[] | undefined) => {
            const arr = old ?? [];
            const withoutTemp = arr.filter(p => p.id !== entry.tempId);
            const withoutDup = withoutTemp.filter(p => p.id !== merged.id);
            return [...withoutDup, merged];
          });
          queryClient.removeQueries({ queryKey: ["/api/players", entry.tempId] });

          window.dispatchEvent(new CustomEvent("uscout:reconcile", { detail: { tempId: entry.tempId, realId: merged.id } }));
        } else if (entry.kind === "update") {
          const isTemp = entry.playerId.startsWith("temp-");
          if (isTemp && !tempMap[entry.playerId]) { remaining.push(entry); continue; }
          const actualId = tempMap[entry.playerId] ?? entry.playerId;

          const res = await apiRequest("PATCH", `/api/players/${encodeURIComponent(actualId)}`, entry.updates);
          const updated = await res.json();

          queryClient.setQueryData(["/api/players", updated.id], updated);
          queryClient.setQueryData(["/api/players"], (old: any[] | undefined) =>
            (old ?? []).map(p => (p.id === updated.id ? updated : p))
          );
          queryClient.setQueryData(["/api/players", updated.teamId], (old: any[] | undefined) =>
            (old ?? []).map(p => (p.id === updated.id ? updated : p))
          );
        } else if (entry.kind === "delete") {
          const isTemp = entry.playerId.startsWith("temp-");
          if (isTemp && !tempMap[entry.playerId]) { remaining.push(entry); continue; }
          const actualId = tempMap[entry.playerId] ?? entry.playerId;
          await apiRequest("DELETE", `/api/players/${encodeURIComponent(actualId)}`);

          queryClient.setQueryData(["/api/players"], (old: any[] | undefined) =>
            (old ?? []).filter(p => p.id !== actualId)
          );
          queryClient.removeQueries({ queryKey: ["/api/players", actualId] });
        }
      } catch {
        remaining.push(entry);
        if (!navigator.onLine) break;
      }
    }

    writeQueue(remaining);
  } finally {
    flushInFlight = false;
  }
}

window.addEventListener("online", () => { flushOfflinePlayerMutations(); });
if (navigator.onLine) { flushOfflinePlayerMutations(); }

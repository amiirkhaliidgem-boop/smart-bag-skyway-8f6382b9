// Supabase-backed persistence for the Zustand store.
// Every emit pushes the state snapshot to `public.app_state`; realtime
// broadcasts remote changes back into the store. This is what makes
// Preview and Open-in-New-Tab agree — one server-side row of truth.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const ROW_ID = "global";

type PersistenceStatus =
  | "uninitialized"
  | "loading"
  | "hydrated"
  | "saving"
  | "error";

let session: unknown = null;
let localVersion = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPayload: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
let status: PersistenceStatus = "uninitialized";
let saveInFlight = false;
let queuedSnapshot: (() => unknown) | null = null;
let applyRemoteSnapshot: ((payload: unknown, version: number) => void) | null = null;

let hydrated = false;
const hydrationListeners = new Set<() => void>();
function markHydrated() {
  if (hydrated) return;
  hydrated = true;
  status = "hydrated";
  notifyStatus();
  hydrationListeners.forEach((fn) => {
    try { fn(); } catch { /* noop */ }
  });
  hydrationListeners.clear();
}

export function isHydrated(): boolean {
  return hydrated;
}

export function onHydrated(fn: () => void): () => void {
  if (hydrated) { fn(); return () => {}; }
  hydrationListeners.add(fn);
  return () => hydrationListeners.delete(fn);
}

export function markRemoteApply() {
  // Kept for compatibility with older store imports. Remote snapshots are
  // applied directly and never call the persistence scheduler.
}

export function getPersistenceStatus(): PersistenceStatus {
  return status;
}

function notifyStatus(message?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("app:persistence-status", { detail: { status, message } }),
  );
}

function setPersistenceError(message: string) {
  status = "error";
  console.warn("[persistence]", message);
  notifyStatus(message);
}

export function isAuthenticatedForPersistence(): boolean {
  return session !== null;
}

export async function initPersistence(
  applyRemote: (payload: unknown, version: number) => void,
): Promise<void> {
  if (typeof window === "undefined") return;

  applyRemoteSnapshot = applyRemote;
  status = "loading";
  notifyStatus();

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setPersistenceError(`Session restore failed: ${error.message}`);
    markHydrated();
    return;
  }
  session = data.session;

  supabase.auth.onAuthStateChange((_evt, s) => {
    session = s;
    if (s) {
      status = "loading";
      notifyStatus();
      void bootstrap(applyRemote).finally(markHydrated);
    } else {
      teardownChannel();
      status = "hydrated";
      notifyStatus();
    }
  });

  if (session) await bootstrap(applyRemote);
  markHydrated();
}

async function bootstrap(
  applyRemote: (payload: unknown, version: number) => void,
) {
  const { data, error } = await supabase
    .from("app_state")
    .select("payload, version")
    .eq("id", ROW_ID)
    .maybeSingle();
  if (error) {
    setPersistenceError(`Load failed: ${error.message}`);
    return;
  }
  if (data && data.payload && Object.keys(data.payload as object).length > 0) {
    localVersion = Number(data.version ?? 0);
    lastPayload = JSON.stringify(data.payload);
    markRemoteApply();
    applyRemote(data.payload, localVersion);
  }

  teardownChannel();
  channel = supabase
    .channel("app_state_sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_state", filter: `id=eq.${ROW_ID}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as
          | { payload?: unknown; version?: number }
          | undefined;
        if (!row) return;
        const remoteVersion = Number(row.version ?? 0);
        if (remoteVersion <= localVersion) return; // ignore our own echo
        // Never replace unsaved local work. The version-checked save will
        // reject it and surface a conflict instead of silently losing either
        // browser's changes.
        if (saveInFlight || queuedSnapshot || pushTimer) return;
        localVersion = remoteVersion;
        lastPayload = JSON.stringify(row.payload ?? {});
        applyRemote(row.payload, remoteVersion);
      },
    )
    .subscribe();
}

function teardownChannel() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
}

export function scheduleRemotePush(getSnapshot: () => unknown): void {
  if (typeof window === "undefined") return;
  if (!session) return; // not signed in yet — no push
  // Seed/default state must never be allowed to overwrite Supabase while the
  // authoritative snapshot is still loading.
  if (!hydrated || status === "loading" || status === "uninitialized") return;
  queuedSnapshot = getSnapshot;
  if (saveInFlight || pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void flushQueuedPush();
  }, 250);
}

async function flushQueuedPush() {
  if (saveInFlight || !queuedSnapshot) return;
  const getSnapshot = queuedSnapshot;
  queuedSnapshot = null;
  await pushNow(getSnapshot());
  if (queuedSnapshot) {
    pushTimer = setTimeout(() => {
      pushTimer = null;
      void flushQueuedPush();
    }, 0);
  }
}

async function pushNow(snapshot: unknown) {
  const serialized = JSON.stringify(snapshot);
  if (serialized === lastPayload) {
    return;
  }

  saveInFlight = true;
  status = "saving";
  notifyStatus();
  const expectedVersion = localVersion;
  const { data, error } = await supabase.rpc("save_app_state", {
    p_expected_version: expectedVersion,
    p_payload: snapshot as Json,
  });
  saveInFlight = false;

  if (error || !data?.[0]) {
    setPersistenceError(`Save failed: ${error?.message ?? "No result returned"}`);
    return;
  }

  const result = data[0];
  if (!result.saved) {
    setPersistenceError(
      "This screen was out of date, so its changes were not allowed to overwrite newer work. The latest shared state has been restored.",
    );
    localVersion = Number(result.current_version ?? expectedVersion);
    lastPayload = JSON.stringify(result.current_payload ?? {});
    applyRemoteSnapshot?.(result.current_payload, localVersion);
    queuedSnapshot = null;
    return;
  }

  localVersion = Number(result.current_version);
  lastPayload = serialized;
  status = "hydrated";
  notifyStatus();
}
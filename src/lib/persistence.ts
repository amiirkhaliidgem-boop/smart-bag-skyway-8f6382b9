// Supabase-backed persistence for the Zustand store.
// Every emit pushes the state snapshot to `public.app_state`; realtime
// broadcasts remote changes back into the store. This is what makes
// Preview and Open-in-New-Tab agree — one server-side row of truth.

import { supabase } from "@/integrations/supabase/client";

const ROW_ID = "global";

let session: unknown = null;
let localVersion = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPayload: string | null = null;
let suppressNext = false;
let channel: ReturnType<typeof supabase.channel> | null = null;

let hydrated = false;
const hydrationListeners = new Set<() => void>();
function markHydrated() {
  if (hydrated) return;
  hydrated = true;
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
  // Prevent the emit that follows a remote apply from echoing back.
  suppressNext = true;
}

export function isAuthenticatedForPersistence(): boolean {
  return session !== null;
}

export async function initPersistence(
  applyRemote: (payload: unknown, version: number) => void,
): Promise<void> {
  if (typeof window === "undefined") return;

  const { data } = await supabase.auth.getSession();
  session = data.session;

  supabase.auth.onAuthStateChange((_evt, s) => {
    session = s;
    if (s) void bootstrap(applyRemote);
    else teardownChannel();
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
    console.warn("[persistence] load failed", error.message);
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
        localVersion = remoteVersion;
        lastPayload = JSON.stringify(row.payload ?? {});
        markRemoteApply();
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
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow(getSnapshot());
  }, 250);
}

async function pushNow(snapshot: unknown) {
  const serialized = JSON.stringify(snapshot);
  if (serialized === lastPayload) {
    // Snapshot matches last known remote payload — genuine echo, nothing to persist.
    // Consume any pending suppression so it can't leak into a later real mutation.
    suppressNext = false;
    return;
  }
  if (suppressNext) {
    // A remote apply landed but the store diverged (real user mutation).
    // Clear the flag and persist the divergence.
    suppressNext = false;
  }
  lastPayload = serialized;
  const nextVersion = localVersion + 1;
  const { error } = await supabase
    .from("app_state")
    .update({ payload: snapshot as never, version: nextVersion })
    .eq("id", ROW_ID);
  if (error) {
    console.warn("[persistence] push failed", error.message);
    return;
  }
  localVersion = nextVersion;
}
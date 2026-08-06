// ---------------------------------------------------------------------------
// Shared Supabase Realtime hub.
//
// One socket topic ("app_sync") carries every table the app listens to. Each
// consumer registers the tables it actually depends on, so a `deliveries`
// event never wakes a Lost & Found-only consumer and a `system_settings`
// event never touches operational refreshes: dispatch is per-table, not
// per-channel. The channel is reference-counted — it opens on the first
// subscriber and is removed with `supabase.removeChannel` when the last one
// leaves, which makes repeated mounts, route changes and tab refocus unable
// to accumulate duplicate channels.
// ---------------------------------------------------------------------------

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Every public table the application subscribes to. */
export const REALTIME_TABLES = [
  "deliveries",
  "baggage_cases",
  "notification_events",
  "workflow_events",
  "quality_incidents",
  "passenger_feedback",
  "system_settings",
  "sla_regions",
  "notification_templates",
] as const;

export type RealtimeTable = (typeof REALTIME_TABLES)[number];

type Handler = (table: RealtimeTable) => void;

const handlers = new Map<RealtimeTable, Set<Handler>>();
let channel: RealtimeChannel | null = null;
let subscriberCount = 0;

function dispatch(table: RealtimeTable) {
  const set = handlers.get(table);
  if (!set) return;
  // Copy first: a handler may unsubscribe itself while reacting.
  for (const handler of [...set]) handler(table);
}

function openChannel() {
  if (channel) return;
  const ch = supabase.channel("app_sync");
  for (const table of REALTIME_TABLES) {
    ch.on("postgres_changes", { event: "*", schema: "public", table }, () => dispatch(table));
  }
  ch.subscribe();
  channel = ch;
}

function closeChannel() {
  if (!channel) return;
  const ch = channel;
  channel = null;
  void supabase.removeChannel(ch);
}

/**
 * Subscribe to realtime changes on `tables`. Returns an idempotent
 * unsubscribe function; the shared channel closes once nobody is listening.
 */
export function subscribeRealtime(
  tables: readonly RealtimeTable[],
  handler: Handler,
): () => void {
  if (typeof window === "undefined") return () => {};
  for (const table of tables) {
    let set = handlers.get(table);
    if (!set) handlers.set(table, (set = new Set()));
    set.add(handler);
  }
  subscriberCount += 1;
  openChannel();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const table of tables) {
      const set = handlers.get(table);
      if (!set) continue;
      set.delete(handler);
      if (set.size === 0) handlers.delete(table);
    }
    subscriberCount -= 1;
    if (subscriberCount <= 0) {
      subscriberCount = 0;
      closeChannel();
    }
  };
}

/** Diagnostics: which tables currently have at least one listener. */
export function activeRealtimeTables(): RealtimeTable[] {
  return [...handlers.keys()];
}
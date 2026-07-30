// Notification outbox drainer.
//
// The Workflow Engine only ever *queues* notification_events; nothing in the
// app sends them. This endpoint is the single delivery worker, called on a
// schedule by pg_cron. It never decides *what* to send — it only transports
// rows the engine already produced.

import { createFileRoute } from "@tanstack/react-router";
import type { NotificationChannelAdapter } from "@/lib/notifications/channels";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

type Row = Record<string, any>;

async function adapterFor(channel: string): Promise<NotificationChannelAdapter | null> {
  if (channel !== "sms" && channel !== "whatsapp") return null;
  // 1. Integration Center configuration wins when the channel is connected.
  const { configuredAdapter } = await import("@/lib/notifications/adapters/configured.server");
  const live = await configuredAdapter(channel).catch(() => null);
  if (live) return live;
  // 2. Legacy environment-based Twilio credentials.
  const { twilioAdapters, twilioConfigured } = await import(
    "@/lib/notifications/adapters/twilio.server"
  );
  if (twilioConfigured()) return twilioAdapters[channel];
  // 3. Simulated transport (non-production).
  const { simulatedAdapters } = await import("@/lib/notifications/adapters/simulated");
  return simulatedAdapters[channel];
}

export const Route = createFileRoute("/api/public/notifications/drain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        const presented = request.headers.get("apikey");
        if (!key || presented !== key) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const nowIso = new Date().toISOString();

        const { data: claimed, error: claimError } = await db
          .from("notification_events")
          .select("*")
          .in("state", ["queued", "failed"])
          .lt("attempt_count", MAX_ATTEMPTS)
          .lte("next_attempt_at", nowIso)
          .order("created_at")
          .limit(BATCH_SIZE);

        if (claimError) {
          return new Response(JSON.stringify({ error: claimError.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const batch = (claimed ?? []) as Row[];
        if (batch.length === 0) {
          return new Response(JSON.stringify({ sent: 0, failed: 0, claimed: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        await db
          .from("notification_events")
          .update({ state: "sending", last_attempt_at: nowIso })
          .in(
            "id",
            batch.map((n) => n.id),
          );

        let sent = 0;
        let failed = 0;

        for (const event of batch) {
          const attempt = (event.attempt_count ?? 0) + 1;
          const adapter = await adapterFor(event.channel);

          const result = adapter
            ? await adapter
                .send({
                  id: event.id,
                  channel: event.channel,
                  to: event.recipient,
                  message: { subject: event.subject ?? "", body: event.body ?? "" },
                  locale: event.locale === "ar" ? "ar" : "en",
                  attempt,
                })
                .catch((err: unknown) => ({
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                  retryable: true,
                }))
            : { ok: false, error: `No transport for channel ${event.channel}`, retryable: false };

          const provider = adapter?.name ?? "none";

          await db.from("notification_attempts").insert({
            notification_id: event.id,
            attempt_no: attempt,
            provider,
            succeeded: result.ok,
            provider_message_id: "providerId" in result ? (result.providerId ?? null) : null,
            error: result.ok ? "" : (result.error ?? ""),
          });

          const exhausted = attempt >= MAX_ATTEMPTS || result.retryable === false;
          await db
            .from("notification_events")
            .update({
              attempt_count: attempt,
              provider,
              provider_message_id:
                "providerId" in result ? (result.providerId ?? event.provider_message_id) : event.provider_message_id,
              state: result.ok ? "sent" : exhausted ? "failed" : "queued",
              sent_at: result.ok ? new Date().toISOString() : event.sent_at,
              failure_reason: result.ok ? "" : (result.error ?? ""),
              next_attempt_at: result.ok
                ? event.next_attempt_at
                : new Date(Date.now() + Math.pow(2, attempt) * 60_000).toISOString(),
            })
            .eq("id", event.id);

          if (result.ok) sent += 1;
          else failed += 1;
        }

        // Real traffic feeds the API Status monitor.
        const { recordHealthSample } = await import("@/lib/system/integrations.server");
        await recordHealthSample({
          apiKey: "notification_api",
          ok: failed === 0,
          detail: `Drained ${batch.length} · sent ${sent} · failed ${failed}`,
          error: failed > 0 ? `${failed} notification(s) failed to send` : "",
          source: "traffic",
        });

        return new Response(JSON.stringify({ claimed: batch.length, sent, failed }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
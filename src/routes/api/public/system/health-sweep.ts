// Scheduled API health sweep. Called by pg_cron (or any external scheduler)
// with the project publishable key, exactly like the notification drainer.
// It probes every internal API and every configured integration, writing
// samples the System module reads for uptime and latency.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/system/health-sweep")({
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

        try {
          const { runHealthSweep } = await import("@/lib/system/integrations.server");
          const result = await runHealthSweep(null);
          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
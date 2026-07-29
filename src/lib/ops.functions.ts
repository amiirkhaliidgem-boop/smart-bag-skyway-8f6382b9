import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The operational snapshot is served in three independent tiers so the UI can
 * paint real KPI values as soon as the core lands instead of waiting for the
 * whole dataset. Same auth, same limits, same mapping as before.
 */

/** Tier 1 — cases, deliveries, workflow, station, id/version maps. */
export const loadOpsCore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildCoreSnapshot } = await import("./ops.server");
    return buildCoreSnapshot(context.supabase as any);
  });

/** Tier 2 — audit trail and notification queue. */
export const loadOpsActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildActivitySnapshot } = await import("./ops.server");
    return buildActivitySnapshot(context.supabase as any);
  });

/** Tier 3 — feedback, quality incidents, agent positions and routes. */
export const loadOpsSecondary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildSecondarySnapshot } = await import("./ops.server");
    return buildSecondarySnapshot(context.supabase as any);
  });

/** Generic guarded RPC bridge to the Workflow Engine functions in PostgreSQL. */
export const callOpsRpc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fn: string; args: Record<string, unknown> }) => {
    const allowed = new Set([
      "lf_create_case",
      "lf_update_case",
      "lf_set_status",
      "lf_bulk_set_status",
      "dm_schedule",
      "dm_assign_agent",
      "dm_resend_otp",
      "dm_add_note",
      "dm_mark_failed",
      "dm_mark_returned",
      "dm_close",
      "agent_advance",
      "agent_complete_delivery",
      "agent_report_position",
      "wf_transition",
      "notif_claim_batch",
      "notif_record_result",
    ]);
    if (!allowed.has(input.fn)) throw new Error(`Unknown operation: ${input.fn}`);
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any).rpc(data.fn, data.args);
    if (error) throw new Error(error.message);
    return result ?? null;
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Full operational snapshot projected from the normalized production tables. */
export const loadOpsSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildSnapshot } = await import("./ops.server");
    return buildSnapshot(context.supabase as any);
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

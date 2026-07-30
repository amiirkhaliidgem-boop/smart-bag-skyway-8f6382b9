import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Whole-ecosystem operational report, aggregated in PostgreSQL. */
export const loadOperationalReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string; grain: "day" | "week" | "month" }) => {
    if (!input?.from || !input?.to) throw new Error("A reporting date range is required");
    const grain: "day" | "week" | "month" =
      input.grain === "week" || input.grain === "month" ? input.grain : "day";
    return { from: input.from, to: input.to, grain };
  })
  .handler(async ({ data, context }) => {
    const { fetchOperationalReport } = await import("./reports.server");
    return fetchOperationalReport(context.supabase as any, data.from, data.to, data.grain);
  });

/** Quality Management actions — Workflow Engine RPCs, journaled to Timeline & Audit. */
export const callQualityRpc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fn: string; args: Record<string, unknown> }) => {
    const allowed = new Set([
      "qm_create_incident",
      "qm_assign_incident",
      "qm_set_state",
      "qm_resolve_incident",
      "qm_sweep_sla",
    ]);
    if (!allowed.has(input.fn)) throw new Error(`Unknown operation: ${input.fn}`);
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any).rpc(data.fn, data.args);
    if (error) throw new Error(error.message);
    return result ?? null;
  });

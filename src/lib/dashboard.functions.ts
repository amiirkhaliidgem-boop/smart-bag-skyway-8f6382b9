import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Whole-ecosystem executive snapshot, aggregated in PostgreSQL. */
export const loadExecutiveDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string; grain: "day" | "week" | "month" }) => {
    if (!input?.from || !input?.to) throw new Error("A dashboard date range is required");
    const grain: "day" | "week" | "month" =
      input.grain === "week" || input.grain === "month" ? input.grain : "day";
    return { from: input.from, to: input.to, grain };
  })
  .handler(async ({ data, context }) => {
    const { fetchExecutiveDashboard } = await import("./dashboard.server");
    return fetchExecutiveDashboard(context.supabase as any, data.from, data.to, data.grain);
  });

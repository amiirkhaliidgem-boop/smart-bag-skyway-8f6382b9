import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const stationSchema = z.object({
  code: z.string().min(1).max(8),
  name: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Persists the station (route-optimization origin). RLS restricts this to admins. */
export const saveStation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => stationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: existing } = await sb
      .from("stations")
      .select("id")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await sb.from("stations").update(data).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb
        .from("stations")
        .insert({ ...data, timezone: "UTC", is_default: true });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const ioEventSchema = z.object({
  action: z.string().min(1).max(64),
  actor: z.string().max(120).default("Operator"),
  target: z.string().max(200),
  details: z.string().max(2000),
});

/** Records an Import/Export operation in the administration audit trail. */
export const logDataIoEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ioEventSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      actor_name: data.actor,
      actor_role: "Data I/O",
      action: data.action,
      target: data.target,
      details: data.details,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

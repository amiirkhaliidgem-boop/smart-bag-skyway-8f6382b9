import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_CONTACTS,
  DEFAULT_GENERAL,
  type ContactSettings,
  type GeneralSettings,
  type NotificationTemplateRow,
  type SlaRegion,
  type SystemSettingsBundle,
} from "@/lib/settings/types";

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

/* ------------------------------------------------------------------ *
 * System Settings — the live configuration centre.
 * Every value below is stored in PostgreSQL and read back by the
 * Workflow, Notification and Passenger engines.
 * ------------------------------------------------------------------ */

/** Reads the whole settings bundle for signed-in staff. */
export const loadSystemSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemSettingsBundle> => {
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("settings_get_all");
    if (error) throw new Error(error.message);
    const raw = (data ?? {}) as Record<string, any>;
    return {
      general: { ...DEFAULT_GENERAL, ...(raw.general ?? {}) } as GeneralSettings,
      contacts: { ...DEFAULT_CONTACTS, ...(raw.contacts ?? {}) } as ContactSettings,
      sla: { lf_sla_hours: Number(raw.sla?.lf_sla_hours ?? 24) },
      regions: (raw.regions ?? []) as SlaRegion[],
      templates: (raw.templates ?? []) as NotificationTemplateRow[],
      canManage: Boolean(raw.can_manage),
    };
  });

const groupSchema = z.object({
  group: z.enum(["general", "contacts", "sla"]),
  payload: z.record(z.string(), z.unknown()),
});

/** Persists one settings group. The RPC rejects non-administrators. */
export const saveSystemSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => groupSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("settings_save", {
      p_group: data.group,
      p_payload: data.payload,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const regionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Region name is required").max(80),
  name_ar: z.string().max(80).default(""),
  sla_hours: z.number().int().min(1).max(2000),
  is_default: z.boolean().default(false),
  active: z.boolean().default(true),
});

/** Creates or updates a Home Delivery SLA region. */
export const saveSlaRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => regionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("sla_region_upsert", { p_payload: data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSlaRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("sla_region_delete", { p_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const templateSchema = z.object({
  trigger_key: z.string().min(1).max(64),
  channel: z.enum(["sms", "whatsapp", "email"]),
  subject_en: z.string().max(200).default(""),
  subject_ar: z.string().max(200).default(""),
  body_en: z.string().max(2000).default(""),
  body_ar: z.string().max(2000).default(""),
  active: z.boolean().default(true),
});

/** Saves a notification template; the engine renders from these rows at send time. */
export const saveNotificationTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => templateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("notif_template_upsert", { p_payload: data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface PublicSettings {
  companyName: string;
  systemName: string;
  logoUrl: string;
  defaultLanguage: "en" | "ar";
  contacts: ContactSettings;
}

/** Anon-safe subset consumed by the public Passenger Portal. */
export const getPublicSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSettings> => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data, error } = await (sb as any).rpc("settings_get_public");
    const raw = (error ? {} : ((data ?? {}) as Record<string, any>)) as Record<string, any>;
    return {
      companyName: raw.company_name || DEFAULT_GENERAL.company_name,
      systemName: raw.system_name || DEFAULT_GENERAL.system_name,
      logoUrl: raw.logo_url || "",
      defaultLanguage: raw.default_language === "ar" ? "ar" : "en",
      contacts: { ...DEFAULT_CONTACTS, ...(raw.contacts ?? {}) },
    };
  },
);

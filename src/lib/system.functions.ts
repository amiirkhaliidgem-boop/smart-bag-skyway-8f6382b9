import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SystemCenterData } from "@/lib/system/catalog";

/** Read model for the Integration Center + API Status. Admin only. */
export const loadSystemCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemCenterData> => {
    const { assertAdmin } = await import("@/lib/admin/guard.server");
    await assertAdmin(context.userId);
    const { getSystemCenter } = await import("@/lib/system/integrations.server");
    return getSystemCenter();
  });

const saveSchema = z.object({
  key: z.string().min(1).max(64),
  provider: z.string().max(64).optional(),
  environment: z.enum(["development", "testing", "production"]).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  secrets: z.record(z.string(), z.string()).default({}),
});

export const saveIntegrationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { saveIntegration } = await import("@/lib/system/integrations.server");
    return saveIntegration(actor, data);
  });

export const testIntegrationConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(64),
        testInput: z.string().max(200).optional(),
        sync: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { testIntegration } = await import("@/lib/system/integrations.server");
    return testIntegration(actor, data.key, data.testInput, data.sync ? "sync" : "test");
  });

export const toggleIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ key: z.string().min(1).max(64), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { setIntegrationEnabled } = await import("@/lib/system/integrations.server");
    return setIntegrationEnabled(actor, data.key, data.enabled);
  });

export const disconnectIntegrationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ key: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { disconnectIntegration } = await import("@/lib/system/integrations.server");
    return disconnectIntegration(actor, data.key);
  });

export const runApiHealthSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { runHealthSweep } = await import("@/lib/system/integrations.server");
    return runHealthSweep(actor);
  });
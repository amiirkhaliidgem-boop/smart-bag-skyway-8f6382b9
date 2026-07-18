import { createServerFn } from "@tanstack/react-start";

const seededUsers = [
  {
    id: "1d12039b-2e5f-41ab-b044-219211d85d42",
    email: "admin@iab.aero",
    password: "Admin!2026",
    role: "admin",
    displayName: "Airport Administrator",
  },
  {
    id: "4ce5946c-a86d-4004-83f9-91ffa60ea05f",
    email: "lf.officer@iab.aero",
    password: "LostFound!2026",
    role: "agent",
    displayName: "Lost & Found Officer",
  },
  {
    id: "c88802f4-3154-44b6-8f0d-d8083600b450",
    email: "dispatch@iab.aero",
    password: "Dispatch!2026",
    role: "coordinator",
    displayName: "Delivery Coordinator",
  },
  {
    id: "a400da68-3563-4ac4-8696-76b6ceffd07a",
    email: "driver@iab.aero",
    password: "Driver!2026",
    role: "driver",
    displayName: "Driver",
  },
] as const;

export const repairSeededAuthUsers = createServerFn({ method: "POST" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: Array<{ email: string; ok: boolean; error?: string }> = [];

    for (const user of seededUsers) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: user.email,
        password: user.password,
        email_confirm: true,
        ban_duration: "none",
        app_metadata: { role: user.role },
        user_metadata: { role: user.role, display_name: user.displayName },
      });
      results.push({
        email: user.email,
        ok: !error,
        ...(error ? { error: error.message } : {}),
      });
    }

    return results;
  },
);
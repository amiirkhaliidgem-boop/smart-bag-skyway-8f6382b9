import { createFileRoute } from "@tanstack/react-router";

const REPAIR_KEY = "6c11e055a1644a2883ed680b07fd9821";

export const Route = createFileRoute("/api/public/auth-repair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-repair-key") !== REPAIR_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const users = [
          ["1d12039b-2e5f-41ab-b044-219211d85d42", "admin@iab.aero", "Admin!2026", "admin", "Airport Administrator"],
          ["4ce5946c-a86d-4004-83f9-91ffa60ea05f", "lf.officer@iab.aero", "LostFound!2026", "agent", "Lost & Found Officer"],
          ["c88802f4-3154-44b6-8f0d-d8083600b450", "dispatch@iab.aero", "Dispatch!2026", "coordinator", "Delivery Coordinator"],
          ["a400da68-3563-4ac4-8696-76b6ceffd07a", "driver@iab.aero", "Driver!2026", "driver", "Driver"],
        ] as const;
        const results = [];
        for (const [id, email, password, role, displayName] of users) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
            email,
            password,
            email_confirm: true,
            ban_duration: "none",
            app_metadata: { role },
            user_metadata: { role, display_name: displayName },
          });
          results.push({ email, ok: !error, error: error?.message });
        }
        return Response.json(results);
      },
    },
  },
});
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface Actor {
  userId: string;
  name: string;
  role: string | null;
  appUserId: string | null;
}

/** Verifies the caller holds Administration → Manage, and returns actor identity. */
export async function assertAdmin(userId: string): Promise<Actor> {
  const { data: allowed, error } = await supabaseAdmin.rpc("has_permission", {
    _user_id: userId,
    _module: "Administration",
    _action: "Manage",
  });
  if (error) throw new Error(error.message);

  const { data: me } = await supabaseAdmin
    .from("app_users")
    .select("id, full_name, user_role_assignments(role_id, app_roles(name))")
    .eq("user_id", userId)
    .maybeSingle();

  // Fall back to the legacy admin role so the first administrator is never locked out.
  let ok = Boolean(allowed);
  if (!ok) {
    const { data: legacy } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    ok = Boolean(legacy);
  }
  if (!ok) throw new Error("Forbidden: Administration → Manage permission required.");

  const assignment = (me as { user_role_assignments?: { app_roles?: { name?: string } } | null } | null)
    ?.user_role_assignments;
  return {
    userId,
    name: (me as { full_name?: string } | null)?.full_name ?? "Administrator",
    role: assignment?.app_roles?.name ?? "Administrator",
    appUserId: (me as { id?: string } | null)?.id ?? null,
  };
}

export async function logAdminAction(
  actor: Actor,
  action: string,
  target: string,
  details = "",
): Promise<void> {
  await supabaseAdmin.from("admin_audit_log").insert({
    actor_user_id: actor.userId,
    actor_name: actor.name,
    actor_role: actor.role,
    action,
    target,
    details,
  });
}

/** Keeps the legacy `user_roles` table (used by has_role/RLS) in sync with the assignment. */
export async function syncLegacyRole(appUserId: string, roleId: string): Promise<void> {
  const { data: user } = await supabaseAdmin
    .from("app_users")
    .select("user_id")
    .eq("id", appUserId)
    .maybeSingle();
  if (!user?.user_id) return;
  const { data: role } = await supabaseAdmin
    .from("app_roles")
    .select("legacy_role")
    .eq("id", roleId)
    .maybeSingle();
  await supabaseAdmin.from("user_roles").delete().eq("user_id", user.user_id);
  if (role?.legacy_role) {
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: user.user_id, role: role.legacy_role });
  }
}
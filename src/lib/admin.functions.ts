import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { friendlyUserError } from "@/lib/admin/errors";
import type { AdminWorkspaceData } from "@/lib/admin/modules";

export const getAdminWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminWorkspaceData> => {
    const { assertAdmin } = await import("@/lib/admin/guard.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, roles, permissions, audit, assignments] = await Promise.all([
      supabaseAdmin.from("app_users").select("*").order("full_name"),
      supabaseAdmin.from("app_roles").select("*").order("name"),
      supabaseAdmin.from("role_permissions").select("role_id, module, action, allowed"),
      supabaseAdmin
        .from("admin_audit_log")
        .select("id, actor_name, actor_role, action, target, details, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin.from("user_role_assignments").select("app_user_id, role_id"),
    ]);

    const roleByUser = new Map(
      (assignments.data ?? []).map((a) => [a.app_user_id as string, a.role_id as string]),
    );

    return {
      users: (users.data ?? []).map((u) => ({
        id: u.id,
        user_id: u.user_id,
        employee_id: u.employee_id,
        full_name: u.full_name,
        username: u.username,
        email: u.email,
        mobile: u.mobile,
        department: u.department,
        status: u.status,
        user_type: u.user_type,
        last_login_at: u.last_login_at,
        created_at: u.created_at,
        role_id: roleByUser.get(u.id) ?? null,
        has_pin: Boolean(u.driver_pin_hash),
      })),
      roles: (roles.data ?? []) as AdminWorkspaceData["roles"],
      permissions: (permissions.data ?? []) as AdminWorkspaceData["permissions"],
      audit: (audit.data ?? []) as AdminWorkspaceData["audit"],
    };
  });

const userInput = z.object({
  id: z.string().uuid().optional(),
  employeeId: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(1).max(120),
  username: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  mobile: z.string().trim().max(40).optional().or(z.literal("")),
  department: z.string().trim().max(80).default(""),
  status: z.enum(["Active", "Disabled", "Invited"]).default("Active"),
  userType: z.enum(["staff", "driver"]).default("staff"),
  roleId: z.string().uuid(),
  password: z.string().min(6).max(72).optional().or(z.literal("")),
  pin: z
    .string()
    .regex(/^\d{6,8}$/, "PIN must be 6 to 8 digits.")
    .optional()
    .or(z.literal("")),
});

export const saveAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction, syncLegacyRole } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin } = await import("@/lib/admin/pin.server");

    const row: Record<string, unknown> = {
      employee_id: data.employeeId,
      full_name: data.fullName,
      username: data.username,
      email: data.email || null,
      mobile: data.mobile || null,
      department: data.department,
      status: data.status,
      user_type: data.userType,
    };

    if (data.pin) {
      const { hash, salt } = hashPin(data.pin);
      row.driver_pin_hash = hash;
      row.driver_pin_salt = salt;
    }

    let appUserId = data.id ?? null;

    if (appUserId) {
      const { data: existing } = await supabaseAdmin
        .from("app_users")
        .select("user_id")
        .eq("id", appUserId)
        .maybeSingle();
      const { ensureAuthIdentity, syncAuthIdentity } = await import("@/lib/admin/identity.server");
      // A Delivery Agent signs in with their PIN; staff with their password.
      const credential = data.userType === "driver" ? data.pin : data.password;

      // Identity work runs before the profile write so a rejected edit (e.g. a
      // colliding sign-in address) leaves nothing half-applied.
      if (existing?.user_id) {
        // Editing a username or email changes the address the login page
        // resolves — push it to Supabase Auth so credentials keep working.
        await syncAuthIdentity({
          appUserId,
          authUserId: existing.user_id,
          username: data.username,
          email: data.email,
          fullName: data.fullName,
          userType: data.userType,
        });
        if (credential) {
          const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
            existing.user_id,
            { password: credential },
          );
          if (pwError) throw new Error(pwError.message);
        }
      } else {
        // No orphaned profiles: an account without a sign-in identity gets one.
        if (!credential) {
          throw new Error(
            data.userType === "driver"
              ? "This account has no sign-in identity yet. Set a 6–8 digit PIN to create it."
              : "This account has no sign-in identity yet. Set a password to create it.",
          );
        }
        await ensureAuthIdentity({
          appUserId,
          username: data.username,
          email: data.email,
          fullName: data.fullName,
          userType: data.userType,
          password: credential,
          existingUserId: null,
        });
      }

      const { error } = await supabaseAdmin.from("app_users").update(row as never).eq("id", appUserId);
      if (error) throw new Error(friendlyUserError(error.message));
      await logAdminAction(actor, "User Updated", data.fullName, `Employee ${data.employeeId}`);
    } else {
      if (data.userType === "staff") {
        if (!data.password) {
          throw new Error("Staff accounts require a password.");
        }
        // Supabase Auth requires an email identity. When the operator does not
        // supply one, derive an internal identity from the username so staff can
        // sign in with Username + Password.
        const { internalIdentity } = await import("@/lib/admin/identity.server");
        const identity = data.email || internalIdentity(data.username, "staff");
        const created = await supabaseAdmin.auth.admin.createUser({
          email: identity,
          password: data.password,
          email_confirm: true,
          user_metadata: { full_name: data.fullName },
        });
        if (created.error) throw new Error(created.error.message);
        row.user_id = created.data.user?.id ?? null;
      } else {
        // Delivery Agents sign in on the same login page with Username /
        // Employee ID + PIN, so they need a real account too.
        if (!data.pin) {
          throw new Error("Delivery Agent accounts require a 6–8 digit PIN.");
        }
        const { internalIdentity } = await import("@/lib/admin/identity.server");
        const created = await supabaseAdmin.auth.admin.createUser({
          email: data.email || internalIdentity(data.username, "driver"),
          password: data.pin,
          email_confirm: true,
          user_metadata: { full_name: data.fullName },
        });
        if (created.error) throw new Error(created.error.message);
        row.user_id = created.data.user?.id ?? null;
      }
      const { data: inserted, error } = await supabaseAdmin
        .from("app_users")
        .insert(row as never)
        .select("id")
        .single();
      if (error) throw new Error(friendlyUserError(error.message));
      appUserId = inserted.id;
      await logAdminAction(
        actor,
        "User Created",
        data.fullName,
        `${data.userType === "driver" ? "Delivery Agent" : "Staff"} · ${data.employeeId}`,
      );
    }

    const { error: assignError } = await supabaseAdmin
      .from("user_role_assignments")
      .upsert({ app_user_id: appUserId!, role_id: data.roleId }, { onConflict: "app_user_id" });
    if (assignError) throw new Error(assignError.message);
    await syncLegacyRole(appUserId!, data.roleId);

    return { id: appUserId };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["Active", "Disabled", "Invited"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin
      .from("app_users")
      .select("full_name, user_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("app_users")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (user?.user_id) {
      await supabaseAdmin.auth.admin.updateUserById(user.user_id, {
        ban_duration: data.status === "Disabled" ? "876000h" : "none",
      });
    }
    await logAdminAction(
      actor,
      data.status === "Disabled" ? "User Disabled" : "User Activated",
      user?.full_name ?? data.id,
    );
    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin
      .from("app_users")
      .select("full_name, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (user?.user_id === context.userId) throw new Error("You cannot delete your own account.");
    const { error } = await supabaseAdmin.from("app_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (user?.user_id) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user.user_id);
      await supabaseAdmin.auth.admin.deleteUser(user.user_id);
    }
    await logAdminAction(actor, "User Deleted", user?.full_name ?? data.id);
    return { ok: true };
  });

export const resetUserCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        password: z.string().min(6).max(72).optional(),
        pin: z.string().regex(/^\d{6,8}$/, "PIN must be 6 to 8 digits.").optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin } = await import("@/lib/admin/pin.server");
    const { data: user } = await supabaseAdmin
      .from("app_users")
      .select("full_name, user_id, username, email, user_type")
      .eq("id", data.id)
      .maybeSingle();

    if (data.password) {
      if (!user?.user_id) throw new Error("This account has no sign-in identity.");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.user_id, {
        password: data.password,
      });
      if (error) throw new Error(error.message);
      await logAdminAction(actor, "Password Reset", user.full_name);
    }
    if (data.pin) {
      const { hash, salt } = hashPin(data.pin);
      const { error } = await supabaseAdmin
        .from("app_users")
        .update({ driver_pin_hash: hash, driver_pin_salt: salt })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      // The PIN is also the agent's password on the unified login page.
      const { ensureAuthIdentity } = await import("@/lib/admin/identity.server");
      const authUserId = await ensureAuthIdentity({
        appUserId: data.id,
        username: user?.username ?? "",
        email: user?.email,
        fullName: user?.full_name ?? "",
        userType: "driver",
        password: data.pin,
        existingUserId: user?.user_id ?? null,
      });
      if (!user?.user_id && authUserId) {
        const { syncLegacyRole } = await import("@/lib/admin/guard.server");
        const { data: assignment } = await supabaseAdmin
          .from("user_role_assignments")
          .select("role_id")
          .eq("app_user_id", data.id)
          .maybeSingle();
        if (assignment?.role_id) await syncLegacyRole(data.id, assignment.role_id);
      }
      await logAdminAction(actor, "Password Reset", user?.full_name ?? data.id, "Delivery Agent PIN reset");
    }
    return { ok: true };
  });

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), roleId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction, syncLegacyRole } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_role_assignments")
      .upsert({ app_user_id: data.id, role_id: data.roleId }, { onConflict: "app_user_id" });
    if (error) throw new Error(error.message);
    await syncLegacyRole(data.id, data.roleId);
    const [{ data: user }, { data: role }] = await Promise.all([
      supabaseAdmin.from("app_users").select("full_name").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("app_roles").select("name").eq("id", data.roleId).maybeSingle(),
    ]);
    await logAdminAction(actor, "Role Changed", user?.full_name ?? data.id, `Role set to ${role?.name ?? ""}`);
    return { ok: true };
  });

export const saveRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(300).default(""),
        cloneFromRoleId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("app_roles")
        .update({ name: data.name, description: data.description })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAdminAction(actor, "Permission Modified", data.name, "Role details updated");
      return { id: data.id };
    }

    const key = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now()
      .toString(36)
      .slice(-4)}`;
    const { data: inserted, error } = await supabaseAdmin
      .from("app_roles")
      .insert({ key, name: data.name, description: data.description, is_system: false })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const modulesList = (await import("@/lib/admin/modules")).RBAC_MODULES;
    const actionsList = (await import("@/lib/admin/modules")).RBAC_ACTIONS;
    let source: { module: string; action: string; allowed: boolean }[] = [];
    if (data.cloneFromRoleId) {
      const { data: src } = await supabaseAdmin
        .from("role_permissions")
        .select("module, action, allowed")
        .eq("role_id", data.cloneFromRoleId);
      source = src ?? [];
    }
    const allowedSet = new Set(source.filter((s) => s.allowed).map((s) => `${s.module}|${s.action}`));
    const rows = modulesList.flatMap((m) =>
      actionsList.map((a) => ({
        role_id: inserted.id,
        module: m,
        action: a,
        allowed: allowedSet.has(`${m}|${a}`),
      })),
    );
    const { error: permError } = await supabaseAdmin.from("role_permissions").insert(rows);
    if (permError) throw new Error(permError.message);

    await logAdminAction(
      actor,
      "Permission Modified",
      data.name,
      data.cloneFromRoleId ? "Role cloned" : "Role created",
    );
    return { id: inserted.id };
  });

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin
      .from("app_roles")
      .select("name, is_system")
      .eq("id", data.id)
      .maybeSingle();
    if (role?.is_system) throw new Error("Built-in roles cannot be deleted.");
    const { count } = await supabaseAdmin
      .from("user_role_assignments")
      .select("id", { count: "exact", head: true })
      .eq("role_id", data.id);
    if ((count ?? 0) > 0) throw new Error("Reassign the users on this role before deleting it.");
    const { error } = await supabaseAdmin.from("app_roles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminAction(actor, "Permission Modified", role?.name ?? data.id, "Role deleted");
    return { ok: true };
  });

export const savePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        roleId: z.string().uuid(),
        changes: z
          .array(z.object({ module: z.string(), action: z.string(), allowed: z.boolean() }))
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin/guard.server");
    const actor = await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.changes.map((c) => ({
      role_id: data.roleId,
      module: c.module,
      action: c.action,
      allowed: c.allowed,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("role_permissions")
      .upsert(rows, { onConflict: "role_id,module,action" });
    if (error) throw new Error(error.message);
    const { data: role } = await supabaseAdmin
      .from("app_roles")
      .select("name")
      .eq("id", data.roleId)
      .maybeSingle();
    await logAdminAction(
      actor,
      "Permission Modified",
      role?.name ?? data.roleId,
      `${data.changes.length} permission change(s) saved`,
    );
    return { ok: true };
  });

/** Delivery Agent Portal sign-in: username or employee ID + PIN. */
export const touchLastLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("app_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true };
  });
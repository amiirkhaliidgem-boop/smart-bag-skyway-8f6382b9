import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Internal sign-in identity for accounts created without a corporate email.
 * Staff and Delivery Agents both authenticate through the single login page;
 * the operator never sees or types this address.
 */
export function internalIdentity(username: string, userType: "staff" | "driver"): string {
  const handle = username.trim().toLowerCase();
  return `${handle}@${userType === "driver" ? "agent" : "staff"}.local`;
}

/**
 * Ensures an app_users row has a real Supabase account so the unified login
 * page can authenticate it. Returns the auth user id.
 */
export async function ensureAuthIdentity(params: {
  appUserId: string;
  username: string;
  email?: string | null;
  fullName: string;
  userType: "staff" | "driver";
  password: string;
  existingUserId?: string | null;
}): Promise<string> {
  const { existingUserId } = params;
  if (existingUserId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
      password: params.password,
    });
    if (error) throw new Error(error.message);
    return existingUserId;
  }

  const identity = params.email?.trim() || internalIdentity(params.username, params.userType);
  const created = await supabaseAdmin.auth.admin.createUser({
    email: identity,
    password: params.password,
    email_confirm: true,
    user_metadata: { full_name: params.fullName },
  });
  if (created.error) throw new Error(created.error.message);
  const userId = created.data.user?.id;
  if (!userId) throw new Error("Could not create the sign-in identity.");
  await supabaseAdmin.from("app_users").update({ user_id: userId }).eq("id", params.appUserId);
  return userId;
}

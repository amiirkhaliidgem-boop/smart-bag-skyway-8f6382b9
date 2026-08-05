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
 * The address the login page will resolve for this profile. Mirrors the
 * database function `login_identity_for_username` exactly: an explicit email
 * wins, otherwise the username-derived internal address is used.
 */
export function desiredIdentity(params: {
  username: string;
  email?: string | null;
  userType: "staff" | "driver";
}): string {
  const email = params.email?.trim();
  return email ? email.toLowerCase() : internalIdentity(params.username, params.userType);
}

/**
 * Keeps Supabase Auth in step with the profile after an edit.
 *
 * Editing a username (or email) changes the address the login page resolves.
 * Without this the Auth account keeps its original address and the operator
 * gets "Invalid login credentials" even though the password is unchanged.
 * Only the email is touched here — never the password.
 */
export async function syncAuthIdentity(params: {
  appUserId: string;
  authUserId: string;
  username: string;
  email?: string | null;
  fullName: string;
  userType: "staff" | "driver";
}): Promise<void> {
  const target = desiredIdentity(params);

  // No second profile may resolve to the same sign-in address.
  const { data: clashes } = await supabaseAdmin
    .from("app_users")
    .select("id, username, email, user_type")
    .neq("id", params.appUserId);
  const clash = (clashes ?? []).find(
    (u) =>
      desiredIdentity({
        username: u.username as string,
        email: u.email as string | null,
        userType: (u.user_type as "staff" | "driver") ?? "staff",
      }) === target,
  );
  if (clash) {
    throw new Error("Another account already signs in with this username or email.");
  }

  const { data: current, error: readError } = await supabaseAdmin.auth.admin.getUserById(
    params.authUserId,
  );
  if (readError) throw new Error(readError.message);

  const sameEmail = (current.user?.email ?? "").toLowerCase() === target;
  const sameName = current.user?.user_metadata?.full_name === params.fullName;
  if (sameEmail && sameName) return;

  const { error } = await supabaseAdmin.auth.admin.updateUserById(params.authUserId, {
    ...(sameEmail ? {} : { email: target, email_confirm: true }),
    user_metadata: { ...(current.user?.user_metadata ?? {}), full_name: params.fullName },
  });
  if (error) {
    if (/already been registered|already exists/i.test(error.message)) {
      throw new Error("Another account already signs in with this username or email.");
    }
    throw new Error(error.message);
  }
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
    // Keep the sign-in address aligned with the current username/email first.
    await syncAuthIdentity({
      appUserId: params.appUserId,
      authUserId: existingUserId,
      username: params.username,
      email: params.email,
      fullName: params.fullName,
      userType: params.userType,
    });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
      password: params.password,
    });
    if (error) throw new Error(error.message);
    return existingUserId;
  }

  const identity = desiredIdentity(params);
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

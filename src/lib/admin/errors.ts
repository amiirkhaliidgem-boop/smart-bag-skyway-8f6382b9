/** Turns raw Postgres constraint errors into operator-friendly messages. */
export function friendlyUserError(message: string): string {
  if (message.includes("app_users_username_key")) return "Username already in use.";
  if (message.includes("app_users_employee_id_key")) return "Employee ID already in use.";
  return message;
}

/** Auth-provider errors phrased for the operator creating/editing an account. */
export function friendlyIdentityError(message: string): string {
  if (/already been registered|already exists|email_exists/i.test(message)) {
    return "Another account already signs in with this username or email.";
  }
  return message;
}

/** Turns raw Postgres constraint errors into operator-friendly messages. */
export function friendlyUserError(message: string): string {
  if (message.includes("app_users_username_key")) return "Username already in use.";
  if (message.includes("app_users_employee_id_key")) return "Employee ID already in use.";
  return message;
}

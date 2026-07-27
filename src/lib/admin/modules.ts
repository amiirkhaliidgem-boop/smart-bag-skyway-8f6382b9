// Central RBAC vocabulary for the Administration workspace.
// Rows of the permission matrix are modules, columns are actions.

export const RBAC_MODULES = [
  "Executive Dashboard",
  "Lost & Found",
  "Baggage Tracking",
  "Customer Feedback",
  "Delivery Management",
  "Driver Portal",
  "Warehouse",
  "QR",
  "Workflow Monitor",
  "Notification Center",
  "Timeline",
  "Reports",
  "Import / Export",
  "Administration",
] as const;

export type RbacModule = (typeof RBAC_MODULES)[number];

export const RBAC_ACTIONS = [
  "View",
  "Create",
  "Edit",
  "Delete",
  "Assign",
  "Approve",
  "Export",
  "Print",
  "Manage",
] as const;

export type RbacAction = (typeof RBAC_ACTIONS)[number];

// Route prefix → module. First match wins; order matters.
export const ROUTE_MODULES: { prefix: string; exact?: boolean; module: RbacModule }[] = [
  { prefix: "/", exact: true, module: "Executive Dashboard" },
  { prefix: "/lost-found", module: "Lost & Found" },
  { prefix: "/tracking", module: "Baggage Tracking" },
  { prefix: "/feedback", module: "Customer Feedback" },
  { prefix: "/contact-center", module: "Customer Feedback" },
  { prefix: "/delivery", module: "Delivery Management" },
  { prefix: "/route-tracking", module: "Delivery Management" },
  { prefix: "/passenger", module: "Delivery Management" },
  { prefix: "/driver-portal", module: "Driver Portal" },
  { prefix: "/storage", module: "Warehouse" },
  { prefix: "/qr-scan", module: "QR" },
  { prefix: "/workflow-monitor", module: "Workflow Monitor" },
  { prefix: "/notifications", module: "Notification Center" },
  { prefix: "/timeline", module: "Timeline" },
  { prefix: "/reports", module: "Reports" },
  { prefix: "/data-io", module: "Import / Export" },
  { prefix: "/export-center", module: "Import / Export" },
  { prefix: "/admin", module: "Administration" },
  { prefix: "/integrations", module: "Administration" },
  { prefix: "/api-status", module: "Administration" },
  { prefix: "/settings", module: "Administration" },
];

export function moduleForPath(pathname: string): RbacModule | null {
  const rule = ROUTE_MODULES.find((r) =>
    r.exact ? pathname === r.prefix : pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  return rule?.module ?? null;
}

export const USER_STATUSES = ["Active", "Disabled", "Invited"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DEPARTMENTS = [
  "Lost & Found",
  "Delivery Operations",
  "Baggage Services",
  "Quality",
  "Passenger Services",
  "Operations Control",
  "Management",
  "Administration",
] as const;

export interface AdminUserRecord {
  id: string;
  user_id: string | null;
  employee_id: string;
  full_name: string;
  username: string;
  email: string | null;
  mobile: string | null;
  department: string;
  status: string;
  user_type: string;
  last_login_at: string | null;
  created_at: string;
  role_id: string | null;
  has_pin?: boolean;
}

export interface AdminRoleRecord {
  id: string;
  key: string;
  name: string;
  description: string;
  is_system: boolean;
  legacy_role: string | null;
}

export interface AdminPermissionRecord {
  role_id: string;
  module: string;
  action: string;
  allowed: boolean;
}

export interface AdminAuditRecord {
  id: string;
  actor_name: string;
  actor_role: string | null;
  action: string;
  target: string;
  details: string;
  created_at: string;
}

export interface AdminWorkspaceData {
  users: AdminUserRecord[];
  roles: AdminRoleRecord[];
  permissions: AdminPermissionRecord[];
  audit: AdminAuditRecord[];
}
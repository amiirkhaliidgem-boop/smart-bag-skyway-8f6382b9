import { useSyncExternalStore } from "react";
import { ROLES, ROLE_LABELS, ROLE_PERMISSIONS, type Role, type Action, type Resource } from "@/lib/roles/roles";

export type EmploymentStatus = "Active" | "Disabled" | "Invited";

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  avatarInitials: string;
  avatarColor: string;
  department: string;
  position: string;
  station: string;
  role: Role;
  status: EmploymentStatus;
  lastActivity: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  head: string;
  description: string;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  active: boolean;
}

export interface Team {
  id: string;
  name: string;
  department: string;
  station: string;
  lead: string;
  memberCount: number;
}

export type AdminActionType =
  | "User Created"
  | "User Updated"
  | "User Disabled"
  | "User Activated"
  | "User Deleted"
  | "Password Reset"
  | "Role Changed"
  | "Permission Updated"
  | "Department Changed"
  | "Department Created"
  | "Station Created"
  | "Team Created";

export interface AdminActivity {
  id: string;
  at: string;
  actor: string;
  actorRole: Role;
  action: AdminActionType;
  target: string;
  details?: string;
}

export const ADMIN_MODULES = [
  "Dashboard",
  "Lost & Found",
  "Storage",
  "QR",
  "Delivery",
  "Driver",
  "Passenger Portal",
  "Reports",
  "Notification Center",
  "Timeline",
  "Quality",
  "Administration",
] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

export const PERMISSION_ACTIONS = ["View", "Create", "Edit", "Delete", "Approve", "Export"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

// Map high-level admin modules onto the RBAC resource vocabulary in roles.ts
const MODULE_TO_RESOURCE: Record<AdminModule, Resource> = {
  Dashboard: "report",
  "Lost & Found": "case",
  Storage: "storage",
  QR: "case",
  Delivery: "delivery",
  Driver: "delivery",
  "Passenger Portal": "delivery",
  Reports: "report",
  "Notification Center": "notification",
  Timeline: "audit",
  Quality: "incident",
  Administration: "user",
};

const ACTION_TO_RBAC: Record<PermissionAction, Action | Action[]> = {
  View: "read",
  Create: "create",
  Edit: "update",
  Delete: "delete",
  Approve: "approve",
  Export: ["read"], // Export derives from read permission
};

export function hasPermission(role: Role, module: AdminModule, action: PermissionAction): boolean {
  const resource = MODULE_TO_RESOURCE[module];
  const perms = ROLE_PERMISSIONS[role] ?? [];
  const match = perms.find((p) => p.resource === resource);
  if (!match) return false;
  const need = ACTION_TO_RBAC[action];
  const needed = Array.isArray(need) ? need : [need];
  return needed.every((n) => match.actions.includes(n));
}

export const DEPARTMENTS: Department[] = [
  { id: "DEP-01", name: "Lost & Found", head: "Yasmin Fathy", description: "PIR intake and baggage recovery." },
  { id: "DEP-02", name: "Delivery", head: "Ahmed Selim", description: "Home delivery scheduling and fleet dispatch." },
  { id: "DEP-03", name: "Baggage Services", head: "Karim Hafez", description: "Storage control and belt operations." },
  { id: "DEP-04", name: "Quality", head: "Rania Adel", description: "Quality assurance and misconduct investigation." },
  { id: "DEP-05", name: "Passenger Services", head: "Nadine Ashraf", description: "Passenger-facing communication and feedback." },
  { id: "DEP-06", name: "Operations Control", head: "Mostafa Reda", description: "Central operational supervision." },
  { id: "DEP-07", name: "Management", head: "Hisham Kamal", description: "Executive leadership and station management." },
];

export const STATIONS: Station[] = [
  { id: "STA-CAI", code: "CAI", name: "Cairo International Airport", city: "Cairo", country: "Egypt", active: true },
  { id: "STA-HRG", code: "HRG", name: "Hurghada International (Planned)", city: "Hurghada", country: "Egypt", active: false },
  { id: "STA-SSH", code: "SSH", name: "Sharm El-Sheikh International (Planned)", city: "Sharm El-Sheikh", country: "Egypt", active: false },
];

export const TEAMS: Team[] = [
  { id: "TM-01", name: "L&F Morning Shift", department: "Lost & Found", station: "Cairo International Airport", lead: "Yasmin Fathy", memberCount: 6 },
  { id: "TM-02", name: "L&F Night Shift", department: "Lost & Found", station: "Cairo International Airport", lead: "Sara Mahmoud", memberCount: 5 },
  { id: "TM-03", name: "Delivery Fleet A", department: "Delivery", station: "Cairo International Airport", lead: "Ahmed Selim", memberCount: 8 },
  { id: "TM-04", name: "Delivery Fleet B", department: "Delivery", station: "Cairo International Airport", lead: "Karim El-Sayed", memberCount: 7 },
  { id: "TM-05", name: "Quality Review Board", department: "Quality", station: "Cairo International Airport", lead: "Rania Adel", memberCount: 4 },
  { id: "TM-06", name: "Contact Center", department: "Passenger Services", station: "Cairo International Airport", lead: "Nadine Ashraf", memberCount: 9 },
];

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-cyan-100 text-cyan-700",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const seedUsers: AdminUser[] = [
  {
    id: "EMP-1001",
    fullName: "Hisham Kamal",
    email: "hisham.kamal@iab.aero",
    mobile: "+20 100 111 2001",
    department: "Management",
    position: "Station Manager",
    station: "Cairo International Airport",
    role: "StationManager",
    status: "Active",
    lastActivity: "2026-07-10T08:12:00Z",
    createdAt: "2024-01-15T09:00:00Z",
    avatarInitials: initials("Hisham Kamal"),
    avatarColor: pickColor("Hisham Kamal"),
  },
  {
    id: "EMP-1002",
    fullName: "Karim Hafez",
    email: "karim.hafez@iab.aero",
    mobile: "+20 100 222 4310",
    department: "Baggage Services",
    position: "Baggage Service Manager",
    station: "Cairo International Airport",
    role: "BaggageServiceManager",
    status: "Active",
    lastActivity: "2026-07-10T07:44:00Z",
    createdAt: "2024-02-20T09:00:00Z",
    avatarInitials: initials("Karim Hafez"),
    avatarColor: pickColor("Karim Hafez"),
  },
  {
    id: "EMP-1003",
    fullName: "Yasmin Fathy",
    email: "yasmin.fathy@iab.aero",
    mobile: "+20 122 883 1120",
    department: "Lost & Found",
    position: "Baggage Supervisor",
    station: "Cairo International Airport",
    role: "BaggageSupervisor",
    status: "Active",
    lastActivity: "2026-07-10T06:18:00Z",
    createdAt: "2024-03-05T09:00:00Z",
    avatarInitials: initials("Yasmin Fathy"),
    avatarColor: pickColor("Yasmin Fathy"),
  },
  {
    id: "EMP-1004",
    fullName: "Sara Mahmoud",
    email: "sara.mahmoud@iab.aero",
    mobile: "+20 111 550 9922",
    department: "Lost & Found",
    position: "Lost & Found Agent",
    station: "Cairo International Airport",
    role: "LostAndFoundAgent",
    status: "Active",
    lastActivity: "2026-07-09T22:11:00Z",
    createdAt: "2024-04-10T09:00:00Z",
    avatarInitials: initials("Sara Mahmoud"),
    avatarColor: pickColor("Sara Mahmoud"),
  },
  {
    id: "EMP-1005",
    fullName: "Mohamed Reda",
    email: "mohamed.reda@iab.aero",
    mobile: "+20 100 445 6721",
    department: "Passenger Services",
    position: "Lost & Found Agent",
    station: "Cairo International Airport",
    role: "LostAndFoundAgent",
    status: "Active",
    lastActivity: "2026-07-10T05:20:00Z",
    createdAt: "2024-05-01T09:00:00Z",
    avatarInitials: initials("Mohamed Reda"),
    avatarColor: pickColor("Mohamed Reda"),
  },
  {
    id: "EMP-1006",
    fullName: "Ahmed Selim",
    email: "ahmed.selim@iab.aero",
    mobile: "+20 122 331 8890",
    department: "Delivery",
    position: "Delivery Coordinator",
    station: "Cairo International Airport",
    role: "DeliveryCoordinator",
    status: "Active",
    lastActivity: "2026-07-10T08:01:00Z",
    createdAt: "2024-05-14T09:00:00Z",
    avatarInitials: initials("Ahmed Selim"),
    avatarColor: pickColor("Ahmed Selim"),
  },
  {
    id: "EMP-1007",
    fullName: "Ahmed Mostafa",
    email: "ahmed.mostafa@iab.aero",
    mobile: "+20 100 998 1122",
    department: "Delivery",
    position: "Driver",
    station: "Cairo International Airport",
    role: "Driver",
    status: "Active",
    lastActivity: "2026-07-10T07:55:00Z",
    createdAt: "2024-06-01T09:00:00Z",
    avatarInitials: initials("Ahmed Mostafa"),
    avatarColor: pickColor("Ahmed Mostafa"),
  },
  {
    id: "EMP-1008",
    fullName: "Karim El-Sayed",
    email: "karim.elsayed@iab.aero",
    mobile: "+20 122 118 4477",
    department: "Delivery",
    position: "Driver",
    station: "Cairo International Airport",
    role: "Driver",
    status: "Active",
    lastActivity: "2026-07-10T04:12:00Z",
    createdAt: "2024-06-02T09:00:00Z",
    avatarInitials: initials("Karim El-Sayed"),
    avatarColor: pickColor("Karim El-Sayed"),
  },
  {
    id: "EMP-1009",
    fullName: "Rania Adel",
    email: "rania.adel@iab.aero",
    mobile: "+20 100 776 4432",
    department: "Quality",
    position: "Quality Team Lead",
    station: "Cairo International Airport",
    role: "QualityTeam",
    status: "Active",
    lastActivity: "2026-07-10T06:44:00Z",
    createdAt: "2024-07-11T09:00:00Z",
    avatarInitials: initials("Rania Adel"),
    avatarColor: pickColor("Rania Adel"),
  },
  {
    id: "EMP-1010",
    fullName: "Nadine Ashraf",
    email: "nadine.ashraf@iab.aero",
    mobile: "+20 111 220 6655",
    department: "Passenger Services",
    position: "Contact Center Supervisor",
    station: "Cairo International Airport",
    role: "BaggageSupervisor",
    status: "Active",
    lastActivity: "2026-07-10T07:32:00Z",
    createdAt: "2024-08-19T09:00:00Z",
    avatarInitials: initials("Nadine Ashraf"),
    avatarColor: pickColor("Nadine Ashraf"),
  },
  {
    id: "EMP-1011",
    fullName: "Hadeer Samir",
    email: "hadeer.samir@iab.aero",
    mobile: "+20 122 908 7451",
    department: "Passenger Services",
    position: "Contact Center Agent",
    station: "Cairo International Airport",
    role: "LostAndFoundAgent",
    status: "Disabled",
    lastActivity: "2026-06-28T10:11:00Z",
    createdAt: "2024-10-02T09:00:00Z",
    avatarInitials: initials("Hadeer Samir"),
    avatarColor: pickColor("Hadeer Samir"),
  },
  {
    id: "EMP-1012",
    fullName: "Mostafa Reda",
    email: "mostafa.reda@iab.aero",
    mobile: "+20 100 654 1128",
    department: "Operations Control",
    position: "Operations Controller",
    station: "Cairo International Airport",
    role: "SystemAdministrator",
    status: "Active",
    lastActivity: "2026-07-10T08:18:00Z",
    createdAt: "2024-01-08T09:00:00Z",
    avatarInitials: initials("Mostafa Reda"),
    avatarColor: pickColor("Mostafa Reda"),
  },
];

interface AdminState {
  users: AdminUser[];
  departments: Department[];
  stations: Station[];
  teams: Team[];
  activity: AdminActivity[];
}

let state: AdminState = {
  users: seedUsers,
  departments: DEPARTMENTS,
  stations: STATIONS,
  teams: TEAMS,
  activity: [
    {
      id: "AA-1005",
      at: "2026-07-10T08:10:00Z",
      actor: "Mostafa Reda",
      actorRole: "SystemAdministrator",
      action: "Role Changed",
      target: "Nadine Ashraf",
      details: "Lost & Found Agent → Baggage Supervisor",
    },
    {
      id: "AA-1004",
      at: "2026-07-09T15:42:00Z",
      actor: "Hisham Kamal",
      actorRole: "StationManager",
      action: "User Disabled",
      target: "Hadeer Samir",
      details: "Left the organization.",
    },
    {
      id: "AA-1003",
      at: "2026-07-08T09:22:00Z",
      actor: "Mostafa Reda",
      actorRole: "SystemAdministrator",
      action: "Permission Updated",
      target: "Delivery Coordinator",
      details: "Granted assign on delivery module.",
    },
    {
      id: "AA-1002",
      at: "2026-07-05T11:03:00Z",
      actor: "Hisham Kamal",
      actorRole: "StationManager",
      action: "User Created",
      target: "Mohamed Reda",
      details: "Onboarded to Passenger Services.",
    },
    {
      id: "AA-1001",
      at: "2026-07-01T09:00:00Z",
      actor: "Mostafa Reda",
      actorRole: "SystemAdministrator",
      action: "Department Changed",
      target: "Karim Hafez",
      details: "Operations Control → Baggage Services",
    },
  ],
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAdminStore<T>(selector: (s: AdminState) => T): T {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  return selector(snapshot);
}

export function getAdminState(): AdminState {
  return state;
}

function nextActivityId() {
  const max = state.activity.reduce((m, a) => {
    const n = parseInt(a.id.replace("AA-", ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 1000);
  return `AA-${max + 1}`;
}

function logActivity(entry: Omit<AdminActivity, "id" | "at">) {
  const full: AdminActivity = {
    ...entry,
    id: nextActivityId(),
    at: new Date().toISOString(),
  };
  state = { ...state, activity: [full, ...state.activity] };
}

export function updateUser(
  id: string,
  patch: Partial<AdminUser>,
  actor: { name: string; role: Role },
  action: AdminActionType = "User Updated",
  details?: string,
) {
  const before = state.users.find((u) => u.id === id);
  if (!before) return;
  state = {
    ...state,
    users: state.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
  };
  logActivity({
    actor: actor.name,
    actorRole: actor.role,
    action,
    target: before.fullName,
    details,
  });
  emit();
}

export function setUserStatus(
  id: string,
  status: EmploymentStatus,
  actor: { name: string; role: Role },
) {
  const u = state.users.find((x) => x.id === id);
  if (!u) return;
  updateUser(
    id,
    { status },
    actor,
    status === "Disabled" ? "User Disabled" : "User Activated",
    `Status set to ${status}`,
  );
}

export function deleteUser(id: string, actor: { name: string; role: Role }) {
  const u = state.users.find((x) => x.id === id);
  if (!u) return;
  state = { ...state, users: state.users.filter((x) => x.id !== id) };
  logActivity({
    actor: actor.name,
    actorRole: actor.role,
    action: "User Deleted",
    target: u.fullName,
  });
  emit();
}

export function resetPassword(id: string, actor: { name: string; role: Role }) {
  const u = state.users.find((x) => x.id === id);
  if (!u) return;
  logActivity({
    actor: actor.name,
    actorRole: actor.role,
    action: "Password Reset",
    target: u.fullName,
    details: "Temporary password link generated (placeholder).",
  });
  emit();
}

export function addUser(
  input: Omit<AdminUser, "id" | "avatarInitials" | "avatarColor" | "lastActivity" | "createdAt">,
  actor: { name: string; role: Role },
) {
  const maxN = state.users.reduce((m, u) => {
    const n = parseInt(u.id.replace("EMP-", ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 1000);
  const user: AdminUser = {
    ...input,
    id: `EMP-${maxN + 1}`,
    avatarInitials: initials(input.fullName),
    avatarColor: pickColor(input.fullName),
    lastActivity: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  state = { ...state, users: [user, ...state.users] };
  logActivity({
    actor: actor.name,
    actorRole: actor.role,
    action: "User Created",
    target: user.fullName,
    details: `${user.position} — ${user.department}`,
  });
  emit();
  return user;
}

export function roleLabels() {
  return ROLE_LABELS;
}

export function allRoles(): Role[] {
  return [...ROLES];
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SystemAdministrator: "Unrestricted access. Manages users, roles, permissions, and system configuration.",
  StationManager: "Owns station operations. Approves deliveries and reviews quality incidents.",
  BaggageServiceManager: "Oversees baggage services end-to-end including storage and delivery coordination.",
  BaggageSupervisor: "Supervises daily baggage handling shifts and coordinates field teams.",
  LostAndFoundAgent: "Creates PIRs, updates cases, and manages passenger touchpoints on the floor.",
  DeliveryCoordinator: "Assigns drivers, schedules deliveries, and drives passenger notifications.",
  Driver: "Executes home deliveries via the Driver Portal. Reports incidents from the field.",
  QualityTeam: "Investigates quality incidents, monitors feedback, and audits operational logs.",
  Passenger: "Reference role for passenger-facing tokenized portal. Not assignable to employees.",
};

export function usersByRole(users: AdminUser[]): Record<Role, number> {
  const acc = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  for (const u of users) acc[u.role] = (acc[u.role] ?? 0) + 1;
  return acc;
}
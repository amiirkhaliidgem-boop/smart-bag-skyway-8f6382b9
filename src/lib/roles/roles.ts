// Enterprise role architecture. RBAC is not yet enforced — this file
// defines the vocabulary so wiring it into UI and API layers later is a
// mechanical change.

export const ROLES = [
  "SystemAdministrator",
  "StationManager",
  "BaggageServiceManager",
  "BaggageSupervisor",
  "LostAndFoundAgent",
  "DeliveryCoordinator",
  "Driver",
  "QualityTeam",
  "Passenger",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SystemAdministrator: "System Administrator",
  StationManager: "Station Manager",
  BaggageServiceManager: "Baggage Service Manager",
  BaggageSupervisor: "Baggage Supervisor",
  LostAndFoundAgent: "Lost & Found Agent",
  DeliveryCoordinator: "Delivery Coordinator",
  Driver: "Delivery Agent",
  QualityTeam: "Quality Team",
  Passenger: "Passenger",
};

export type Resource =
  | "case"
  | "delivery"
  | "storage"
  | "notification"
  | "incident"
  | "feedback"
  | "report"
  | "user"
  | "audit";

export type Action = "read" | "create" | "update" | "delete" | "assign" | "approve";

export interface Permission {
  resource: Resource;
  actions: Action[];
}

const ALL: Action[] = ["read", "create", "update", "delete", "assign", "approve"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SystemAdministrator: [
    { resource: "case", actions: ALL },
    { resource: "delivery", actions: ALL },
    { resource: "storage", actions: ALL },
    { resource: "notification", actions: ALL },
    { resource: "incident", actions: ALL },
    { resource: "feedback", actions: ALL },
    { resource: "report", actions: ALL },
    { resource: "user", actions: ALL },
    { resource: "audit", actions: ["read"] },
  ],
  StationManager: [
    { resource: "case", actions: ["read", "update", "approve"] },
    { resource: "delivery", actions: ["read", "update", "approve", "assign"] },
    { resource: "incident", actions: ["read", "update"] },
    { resource: "report", actions: ["read"] },
    { resource: "audit", actions: ["read"] },
  ],
  BaggageServiceManager: [
    { resource: "case", actions: ["read", "create", "update", "approve"] },
    { resource: "delivery", actions: ["read", "create", "update", "approve", "assign"] },
    { resource: "storage", actions: ["read", "update"] },
    { resource: "incident", actions: ["read", "update"] },
    { resource: "report", actions: ["read"] },
  ],
  BaggageSupervisor: [
    { resource: "case", actions: ["read", "update"] },
    { resource: "delivery", actions: ["read", "update", "assign"] },
    { resource: "storage", actions: ["read", "update"] },
    { resource: "incident", actions: ["read", "create"] },
  ],
  LostAndFoundAgent: [
    { resource: "case", actions: ["read", "create", "update"] },
    { resource: "storage", actions: ["read", "update"] },
    { resource: "feedback", actions: ["read"] },
  ],
  DeliveryCoordinator: [
    { resource: "delivery", actions: ["read", "create", "update", "assign"] },
    { resource: "notification", actions: ["read", "create"] },
    { resource: "case", actions: ["read"] },
  ],
  Driver: [
    { resource: "delivery", actions: ["read", "update"] },
    { resource: "incident", actions: ["read", "create"] },
  ],
  QualityTeam: [
    { resource: "incident", actions: ALL },
    { resource: "feedback", actions: ["read"] },
    { resource: "audit", actions: ["read"] },
    { resource: "report", actions: ["read"] },
  ],
  Passenger: [
    { resource: "delivery", actions: ["read"] },
    { resource: "feedback", actions: ["create"] },
    { resource: "incident", actions: ["create"] },
  ],
};

export function can(role: Role, action: Action, resource: Resource): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  const match = perms.find((p) => p.resource === resource);
  return !!match && match.actions.includes(action);
}
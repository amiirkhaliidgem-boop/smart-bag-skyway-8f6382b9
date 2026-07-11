import type { Role } from "../roles/roles";
import type { WorkflowStatus } from "../workflow/statuses";

export type AuditAction =
  | "workflow.transition"
  | "notification.dispatch"
  | "incident.create"
  | "incident.update"
  | "delivery.assign"
  | "delivery.update"
  | "case.create"
  | "case.update";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  actor: string;
  role?: Role;
  entityType: "delivery" | "case" | "incident" | "notification";
  entityId: string;
  fromStatus?: WorkflowStatus;
  toStatus?: WorkflowStatus;
  note?: string;
  at: string;
}
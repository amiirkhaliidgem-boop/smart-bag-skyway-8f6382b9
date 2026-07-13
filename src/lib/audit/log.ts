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
  
export type IoAuditAction = "import.commit" | "export.run";

export interface ImportAuditEntry {
  id: string;
  action: IoAuditAction;
  actor: string;
  moduleId: string;
  moduleLabel: string;
  fileName?: string;
  totalRows?: number;
  accepted?: number;
  rejected?: number;
  warnings?: number;
  duplicates?: number;
  format?: string;
  at: string;
}

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
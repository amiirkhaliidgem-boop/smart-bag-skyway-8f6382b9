// Canonical Lost & Found case lifecycle. Independent enum used by the
// enterprise L&F module. Each status maps to an equivalent WorkflowStatus
// on the central Workflow Engine so timeline, audit, notifications, and
// the Executive Dashboard stay in sync — L&F never becomes a parallel
// engine.

import type { WorkflowStatus } from "../workflow/statuses";

export const LF_STATUSES = [
  "Open",
  "Tracing",
  "Located",
  "In Transit to Cairo",
  "Arrived at Cairo",
  "Waiting Customs Clearance",
  "Ready for Delivery",
  "Assigned Driver",
  "Out for Delivery",
  "Delivered",
  "Closed",
] as const;

export type LFStatus = (typeof LF_STATUSES)[number];

export const LF_STATUS_ORDER: Record<LFStatus, number> = LF_STATUSES.reduce(
  (acc, s, i) => ((acc[s] = i), acc),
  {} as Record<LFStatus, number>,
);

export const LF_STATUS_COLOR: Record<LFStatus, string> = {
  Open: "bg-rose-100 text-rose-700 border-rose-200",
  Tracing: "bg-amber-100 text-amber-700 border-amber-200",
  Located: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "In Transit to Cairo": "bg-sky-100 text-sky-700 border-sky-200",
  "Arrived at Cairo": "bg-blue-100 text-blue-700 border-blue-200",
  "Waiting Customs Clearance": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Ready for Delivery": "bg-violet-100 text-violet-700 border-violet-200",
  "Assigned Driver": "bg-purple-100 text-purple-700 border-purple-200",
  "Out for Delivery": "bg-cyan-100 text-cyan-700 border-cyan-200",
  Delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Closed: "bg-slate-200 text-slate-700 border-slate-300",
};

// Map an L&F case status to the canonical Workflow Engine status so the
// same transition can be mirrored into the workflow / audit / notification
// pipeline when a delivery record exists for the case.
export const LF_TO_WORKFLOW: Record<LFStatus, WorkflowStatus> = {
  Open: "PIR_CREATED",
  Tracing: "PIR_CREATED",
  Located: "HOME_DELIVERY_REQUESTED",
  "In Transit to Cairo": "HOME_DELIVERY_REQUESTED",
  "Arrived at Cairo": "DELIVERY_APPROVED",
  "Waiting Customs Clearance": "DELIVERY_APPROVED",
  "Ready for Delivery": "READY_FOR_COLLECTION",
  "Assigned Driver": "DRIVER_ASSIGNED",
  "Out for Delivery": "OUT_FOR_DELIVERY",
  Delivered: "DELIVERED",
  Closed: "CLOSED",
};

export function nextLfStatus(current: LFStatus): LFStatus | null {
  const i = LF_STATUS_ORDER[current];
  if (i === undefined || i >= LF_STATUSES.length - 1) return null;
  return LF_STATUSES[i + 1];
}

export function canTransitionLf(from: LFStatus, to: LFStatus): boolean {
  return LF_STATUS_ORDER[to] > LF_STATUS_ORDER[from];
}
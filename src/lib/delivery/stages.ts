// Delivery Management — canonical operational lifecycle.
// Overlays the shared Workflow Engine without replacing it.
// Each stage maps to a WorkflowStatus that Delivery uses to feed the
// Workflow Engine (which in turn triggers Notifications / Timeline / Audit).
// This module only DEFINES the stages; it does not own state.

import type { WorkflowStatus } from "../workflow/statuses";
import type { DeliveryStatus } from "../store";
import type { LFStatus } from "../lost-found/statuses";

export const DELIVERY_STAGES = [
  "Ready for Delivery",
  "Scheduled",
  "Assigned",
  "Driver Accepted",
  "Collected Bag",
  "Out for Delivery",
  "Delivered",
  "Delivery Failed",
  "Returned to Airport",
] as const;

export type DeliveryStage = (typeof DELIVERY_STAGES)[number];

export const STAGE_LABELS: Record<DeliveryStage, string> = {
  "Ready for Delivery": "Ready for Delivery",
  Scheduled: "Scheduled",
  Assigned: "Assigned Driver",
  "Driver Accepted": "Driver Accepted",
  "Collected Bag": "Collected Bag",
  "Out for Delivery": "Out for Delivery",
  Delivered: "Delivered",
  "Delivery Failed": "Delivery Failed",
  "Returned to Airport": "Returned to Airport",
};

export const STAGE_ORDER: Record<DeliveryStage, number> = DELIVERY_STAGES.reduce(
  (acc, s, i) => ((acc[s] = i), acc),
  {} as Record<DeliveryStage, number>,
);

// Map a stage to the canonical WorkflowStatus so the Workflow Engine, Timeline,
// Audit and Notifications receive the correct signal.
export function stageToWorkflow(stage: DeliveryStage): WorkflowStatus {
  switch (stage) {
    case "Ready for Delivery":
    case "Scheduled":
      return "DELIVERY_APPROVED";
    case "Assigned":
    case "Driver Accepted":
      return "DRIVER_ASSIGNED";
    case "Collected Bag":
      return "CLAIMED_ON_HAND";
    case "Out for Delivery":
      return "OUT_FOR_DELIVERY";
    case "Delivered":
      return "DELIVERED";
    case "Delivery Failed":
      return "OUT_FOR_DELIVERY";
    case "Returned to Airport":
      return "DELIVERY_APPROVED";
  }
}

// Derive an operational stage from legacy DeliveryStatus, so seed data and
// records that pre-date the stage overlay keep rendering correctly.
export function stageFromLegacy(d: {
  status: DeliveryStatus;
  driver?: string;
  otpStatus?: string;
}): DeliveryStage {
  switch (d.status) {
    case "Pending":
      return "Ready for Delivery";
    case "Assigned":
      return d.driver && d.driver !== "—" ? "Assigned" : "Scheduled";
    case "Picked Up":
      return "Collected Bag";
    case "Out For Delivery":
      return "Out for Delivery";
    case "Delivered":
      return "Delivered";
  }
}

export function stageToLegacyStatus(stage: DeliveryStage): DeliveryStatus {
  switch (stage) {
    case "Ready for Delivery":
    case "Scheduled":
      return "Pending";
    case "Assigned":
    case "Driver Accepted":
    case "Returned to Airport":
      return "Assigned";
    case "Collected Bag":
      return "Picked Up";
    case "Out for Delivery":
    case "Delivery Failed":
      return "Out For Delivery";
    case "Delivered":
      return "Delivered";
  }
}

// Map a Delivery stage → canonical Lost & Found status so both modules
// display exactly the same operational state. The Workflow Engine is the
// single source of truth; this mapping keeps the L&F case in lockstep.
export function stageToLfStatus(stage: DeliveryStage): LFStatus {
  switch (stage) {
    case "Ready for Delivery":
    case "Scheduled":
      return "Ready for Delivery";
    case "Assigned":
    case "Driver Accepted":
    case "Collected Bag":
      return "Assigned Driver";
    case "Out for Delivery":
    case "Delivery Failed":
      return "Out for Delivery";
    case "Delivered":
      return "Delivered";
    case "Returned to Airport":
      return "Ready for Delivery";
  }
}

export const STAGE_STYLES: Record<DeliveryStage, string> = {
  "Ready for Delivery": "bg-slate-100 text-slate-700 border-slate-200",
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  Assigned: "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Driver Accepted": "bg-violet-100 text-violet-700 border-violet-200",
  "Collected Bag": "bg-teal-100 text-teal-700 border-teal-200",
  "Out for Delivery": "bg-cyan-100 text-cyan-700 border-cyan-200",
  Delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Delivery Failed": "bg-rose-100 text-rose-700 border-rose-200",
  "Returned to Airport": "bg-amber-100 text-amber-700 border-amber-200",
};

// Predefined failure reasons — free-text is not allowed for operational
// consistency and downstream reporting.
export const FAILURE_REASONS = [
  "Passenger Not Available",
  "Passenger Requested Reschedule",
  "Wrong Address",
  "Phone Not Reachable",
  "Passenger Refused",
  "Security Issue",
  "Driver Issue",
  "Weather",
  "Other",
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

// Operational queues shown as tabs in the Dispatch Center. Each queue maps
// to one or more stages.
export const DELIVERY_QUEUES = [
  { id: "all", label: "All", stages: [...DELIVERY_STAGES] as DeliveryStage[] },
  { id: "ready", label: "Ready for Delivery", stages: ["Ready for Delivery"] },
  { id: "scheduled", label: "Scheduled", stages: ["Scheduled"] },
  { id: "assigned", label: "Assigned", stages: ["Assigned", "Driver Accepted"] },
  { id: "out", label: "Out for Delivery", stages: ["Collected Bag", "Out for Delivery"] },
  { id: "failed", label: "Failed", stages: ["Delivery Failed"] },
  { id: "returned", label: "Returned to Airport", stages: ["Returned to Airport"] },
  { id: "completed", label: "Completed", stages: ["Delivered"] },
] as const satisfies ReadonlyArray<{ id: string; label: string; stages: DeliveryStage[] }>;

export type DeliveryQueueId = (typeof DELIVERY_QUEUES)[number]["id"];

// Which coordinator actions apply at a given stage. Buttons for actions
// that are not valid at the current stage must be hidden — never disabled.
export function actionsForStage(stage: DeliveryStage) {
  const s = stage;
  return {
    assign: s === "Ready for Delivery" || s === "Scheduled" || s === "Returned to Airport",
    reassign: s === "Assigned" || s === "Driver Accepted",
    generateOtp: s === "Driver Accepted" || s === "Collected Bag" || s === "Out for Delivery",
    resendOtp: s === "Driver Accepted" || s === "Collected Bag" || s === "Out for Delivery",
    notify: s !== "Delivered",
    markFailed: s === "Out for Delivery" || s === "Collected Bag" || s === "Driver Accepted",
    markReturned: s === "Delivery Failed",
    reschedule: s === "Delivery Failed" || s === "Returned to Airport",
    close: s === "Delivered" || s === "Returned to Airport",
    // Driver-side actions (surfaced in the coordinator UI for testing/manual override).
    driverAccept: s === "Assigned",
    driverReject: s === "Assigned",
    collect: s === "Driver Accepted",
    startTrip: s === "Collected Bag",
    markDelivered: s === "Out for Delivery",
  };
}

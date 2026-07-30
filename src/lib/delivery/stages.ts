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
  "Returned to Airport",
] as const;

export type DeliveryStage = (typeof DELIVERY_STAGES)[number];

export const STAGE_LABELS: Record<DeliveryStage, string> = {
  "Ready for Delivery": "Ready for Delivery",
  Scheduled: "Scheduled",
  Assigned: "Assigned Delivery Agent",
  "Driver Accepted": "Delivery Agent Accepted",
  "Collected Bag": "Collected Bag",
  "Out for Delivery": "Out for Delivery",
  Delivered: "Delivered",
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
    case "Returned to Airport":
      return "READY_FOR_COLLECTION";
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
    case "Returned to Airport":
      return "Pending";
    case "Assigned":
    case "Driver Accepted":
      return "Assigned";
    case "Collected Bag":
      return "Picked Up";
    case "Out for Delivery":
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
  "Returned to Airport": "bg-amber-100 text-amber-700 border-amber-200",
};

// Predefined reasons a delivery is returned to the airport. Free-text is not
// allowed so downstream reporting stays consistent. Codes match
// `public.failure_reasons.code` in the database.
export const RETURN_REASONS = [
  { code: "passenger_not_available", label: "Passenger Not Available" },
  { code: "passenger_requested_reschedule", label: "Passenger Requested Reschedule" },
  { code: "wrong_address", label: "Wrong Address" },
  { code: "phone_not_reachable", label: "Phone Not Reachable" },
  { code: "passenger_refused", label: "Passenger Refused" },
  { code: "security_issue", label: "Security Issue" },
  { code: "agent_issue", label: "Delivery Agent Issue" },
  { code: "weather", label: "Weather" },
  { code: "other", label: "Other" },
] as const;

export type ReturnReasonCode = (typeof RETURN_REASONS)[number]["code"];

// Which coordinator actions apply at a given stage. Buttons for actions
// that are not valid at the current stage must be hidden — never disabled.
export function actionsForStage(stage: DeliveryStage) {
  const s = stage;
  return {
    assign: s === "Ready for Delivery" || s === "Scheduled",
    reassign: s === "Assigned" || s === "Driver Accepted",
    schedule: s === "Ready for Delivery",
    generateOtp: s === "Driver Accepted" || s === "Collected Bag" || s === "Out for Delivery",
    resendOtp: s === "Driver Accepted" || s === "Collected Bag" || s === "Out for Delivery",
    // Returning to the airport unwinds an in-flight delivery back to the
    // Ready for Delivery queue. Handled entirely by the Workflow Engine.
    markReturned:
      s === "Assigned" ||
      s === "Driver Accepted" ||
      s === "Collected Bag" ||
      s === "Out for Delivery",
    // Driver-side actions (surfaced in the coordinator UI for testing/manual override).
    driverAccept: s === "Assigned",
    driverReject: s === "Assigned",
    collect: s === "Driver Accepted",
    startTrip: s === "Collected Bag",
    markDelivered: s === "Out for Delivery",
  };
}

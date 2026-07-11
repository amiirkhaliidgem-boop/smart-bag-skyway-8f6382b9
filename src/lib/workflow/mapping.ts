// Bidirectional mapping between the canonical WorkflowStatus and the
// legacy CaseStatus / DeliveryStatus values that existing pages consume.
// This lets pre-existing modules keep working while the workflow engine
// becomes the source of truth.

import type { CaseStatus, DeliveryStatus } from "../store";
import type { WorkflowStatus } from "./statuses";

export function toCaseStatus(w: WorkflowStatus): CaseStatus {
  switch (w) {
    case "PIR_CREATED":
      return "Missing";
    case "HOME_DELIVERY_REQUESTED":
    case "DELIVERY_APPROVED":
      return "Located";
    case "DRIVER_ASSIGNED":
    case "READY_FOR_COLLECTION":
      return "Ready For Delivery";
    case "CLAIMED_ON_HAND":
    case "OUT_FOR_DELIVERY":
    case "DRIVER_ARRIVED":
    case "OTP_VERIFIED":
      return "Out For Delivery";
    case "DELIVERED":
    case "FEEDBACK_SUBMITTED":
    case "CLOSED":
      return "Delivered";
    default:
      return "Stored";
  }
}

export function toDeliveryStatus(w: WorkflowStatus): DeliveryStatus {
  switch (w) {
    case "PIR_CREATED":
    case "HOME_DELIVERY_REQUESTED":
    case "DELIVERY_APPROVED":
      return "Pending";
    case "DRIVER_ASSIGNED":
    case "READY_FOR_COLLECTION":
      return "Assigned";
    case "CLAIMED_ON_HAND":
      return "Picked Up";
    case "OUT_FOR_DELIVERY":
    case "DRIVER_ARRIVED":
    case "OTP_VERIFIED":
      return "Out For Delivery";
    case "DELIVERED":
    case "FEEDBACK_SUBMITTED":
    case "CLOSED":
      return "Delivered";
    default:
      return "Pending";
  }
}

export function fromDeliveryStatus(d: DeliveryStatus): WorkflowStatus {
  switch (d) {
    case "Pending":
      return "DELIVERY_APPROVED";
    case "Assigned":
      return "DRIVER_ASSIGNED";
    case "Picked Up":
      return "CLAIMED_ON_HAND";
    case "Out For Delivery":
      return "OUT_FOR_DELIVERY";
    case "Delivered":
      return "DELIVERED";
  }
}
// Delivery Workflow Engine — Canonical Status Definitions
// Single source of truth for every operational status in the IAB Smart
// Baggage Ecosystem. Every module (Lost & Found, Storage, Delivery,
// Driver Portal, Passenger Portal, Reports) reads status via this engine.

export const WORKFLOW_STATUSES = [
  "PIR_CREATED",
  "HOME_DELIVERY_REQUESTED",
  "DELIVERY_APPROVED",
  "DRIVER_ASSIGNED",
  "READY_FOR_COLLECTION",
  "READY_FOR_AIRPORT_PICKUP",
  "CLAIMED_ON_HAND",
  "OUT_FOR_DELIVERY",
  "DRIVER_ARRIVED",
  "OTP_VERIFIED",
  "DELIVERED",
  "PASSENGER_PICKED_UP",
  "FEEDBACK_SUBMITTED",
  "CLOSED",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_LABELS: Record<WorkflowStatus, { en: string; ar: string }> = {
  PIR_CREATED: { en: "PIR Created", ar: "تم إنشاء تقرير الحقيبة" },
  HOME_DELIVERY_REQUESTED: { en: "Home Delivery Requested", ar: "تم طلب التوصيل" },
  DELIVERY_APPROVED: { en: "Delivery Approved", ar: "تم اعتماد التوصيل" },
  DRIVER_ASSIGNED: { en: "Delivery Agent Assigned", ar: "تم تعيين مندوب التسليم" },
  READY_FOR_COLLECTION: { en: "Ready for Collection", ar: "جاهز للاستلام" },
  READY_FOR_AIRPORT_PICKUP: { en: "Ready for Airport Pickup", ar: "جاهز للاستلام من المطار" },
  CLAIMED_ON_HAND: { en: "Claimed On Hand", ar: "تم استلام الحقيبة" },
  OUT_FOR_DELIVERY: { en: "Out for Delivery", ar: "خرجت للتوصيل" },
  DRIVER_ARRIVED: { en: "Delivery Agent Arrived", ar: "وصل مندوب التسليم" },
  OTP_VERIFIED: { en: "OTP Verified", ar: "تم التحقق من الرمز" },
  DELIVERED: { en: "Delivered", ar: "تم التوصيل" },
  PASSENGER_PICKED_UP: { en: "Passenger Picked Up", ar: "تم الاستلام من الراكب" },
  FEEDBACK_SUBMITTED: { en: "Feedback Submitted", ar: "تم إرسال التقييم" },
  CLOSED: { en: "Closed", ar: "مغلق" },
};

export const WORKFLOW_ORDER: Record<WorkflowStatus, number> =
  WORKFLOW_STATUSES.reduce(
    (acc, s, i) => ((acc[s] = i), acc),
    {} as Record<WorkflowStatus, number>,
  );

export function isTerminal(status: WorkflowStatus): boolean {
  return status === "CLOSED";
}

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  // Forward-only progression is the norm; allow skipping intermediate
  // steps but never backward moves except by explicit admin override.
  return WORKFLOW_ORDER[to] > WORKFLOW_ORDER[from];
}
// Pure row → legacy-shape mappers. Shared by the server-function layer so
// the screens keep consuming the exact shapes they already render, while
// PostgreSQL remains the single source of truth.

import type {
  BaggageCase,
  Delivery,
  Feedback,
  NotificationEvent,
  QualityIncident,
  WorkflowRecord,
  Station,
  DriverPosition,
  DriverRoute,
  Priority,
  OtpStatus,
} from "./store";
import type { AuditEntry } from "./audit/log";
import type { LFStatus } from "./lost-found/statuses";
import type { DeliveryStage } from "./delivery/stages";
import { stageToLegacyStatus } from "./delivery/stages";
import { toCaseStatus } from "./workflow/mapping";
import type { WorkflowStatus } from "./workflow/statuses";
import type { NotificationChannel, NotificationTrigger } from "./notifications/templates";

type Row = Record<string, any>;

export interface OpsSnapshot {
  cases: BaggageCase[];
  deliveries: Delivery[];
  workflow: WorkflowRecord[];
  notifications: NotificationEvent[];
  audit: AuditEntry[];
  feedback: Feedback[];
  qualityIncidents: QualityIncident[];
  station: Station;
  driverPositions: Record<string, DriverPosition>;
  driverRoutes: Record<string, DriverRoute>;
  /** case_no → uuid */
  caseIds: Record<string, string>;
  /** delivery_no → uuid */
  deliveryIds: Record<string, string>;
  /** agent full name → app_users.id */
  agentIds: Record<string, string>;
  /** case_no / delivery_no → row version for optimistic concurrency */
  caseVersions: Record<string, number>;
  deliveryVersions: Record<string, number>;
  agents: { id: string; name: string; employeeId: string }[];
  /** True when the collection hit its read cap and older rows are not loaded. */
  truncated: { cases: boolean; deliveries: boolean; audit: boolean; notifications: boolean };
  /** The cap that was applied, so the UI can say "most recent N". */
  limits: { cases: number; deliveries: number; audit: number; notifications: number };
}

export function mapCase(
  c: Row,
  bags: Row[],
  history: Row[],
): BaggageCase {
  const tags = bags
    .filter((b) => b.case_id === c.id)
    .sort((a, b) => a.seq - b.seq)
    .map((b) => b.bag_tag as string);
  return {
    bagId: c.case_no,
    passengerName: c.passenger_name ?? "",
    flightNumber: c.flight_number ?? "",
    pirNumber: c.pir_number ?? "",
    bagTagNumber: tags[0] ?? "",
    arrivalDate: c.arrival_date ?? "",
    contact: c.contact_mobile ?? "",
    email: c.email ?? "",
    description: c.description ?? "",
    status: toCaseStatus(c.workflow_status as WorkflowStatus),
    storage:
      c.storage_zone || c.storage_shelf || c.storage_position
        ? {
            zone: c.storage_zone ?? "",
            shelf: c.storage_shelf ?? "",
            position: c.storage_position ?? "",
          }
        : null,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    resolvedAt: c.resolved_at ?? undefined,
    lfStatus: c.lf_status as LFStatus,
    priority: (c.priority ?? "Normal") as Priority,
    passenger: {
      firstName: c.passenger_first_name ?? undefined,
      middleName: c.passenger_middle_name ?? undefined,
      lastName: c.passenger_last_name ?? undefined,
      nationality: c.nationality ?? undefined,
      passportNumber: c.passport_number ?? undefined,
      pnr: c.pnr ?? undefined,
      ticketNumber: c.ticket_number ?? undefined,
      mobile2: c.contact_mobile_alt ?? undefined,
    },
    flight: {
      airline: c.airline ?? undefined,
      arrivalTime: c.arrival_time ?? undefined,
      originAirport: c.origin_airport ?? undefined,
      destinationAirport: c.destination_airport ?? undefined,
      terminal: c.terminal ?? undefined,
      arrivalBelt: c.arrival_belt ?? undefined,
    },
    baggage: {
      numberOfBags: c.number_of_bags ?? undefined,
      weightKg: c.weight_kg ?? undefined,
      brand: c.bag_brand ?? undefined,
      color: c.bag_color ?? undefined,
      type: c.bag_type ?? undefined,
      size: c.bag_size ?? undefined,
      distinctiveMarks: c.distinctive_marks ?? undefined,
      fragile: c.fragile ?? undefined,
      rushDelivery: c.rush_delivery ?? undefined,
      vipPassenger: c.priority === "VIP",
      bagTags: tags,
    },
    delivery: {
      method: c.delivery_method ?? undefined,
      fullAddress: c.full_address ?? undefined,
      googleMapsLink: c.google_maps_link ?? undefined,
      preferredDeliveryTime: c.preferred_delivery_time ?? undefined,
    },
    internal: {
      department: c.department ?? undefined,
      internalNotes: c.internal_notes ?? undefined,
      casePriority: (c.priority ?? "Normal") as Priority,
    },
    documents: [],
    incomplete: c.incomplete ?? false,
    missingFields: c.missing_fields ?? [],
    lfHistory: history
      .filter((h) => h.case_id === c.id && h.to_status)
      .map((h) => ({
        status: (h.to_stage
          ? (h.to_stage as string)
          : (h.to_status as string)) as LFStatus,
        at: h.occurred_at,
        actor: h.actor_name ?? "system",
        note: h.reason || undefined,
      })),
  };
}

export function mapDelivery(
  d: Row,
  caseNo: string,
  agentName: string | undefined,
  otp: Row | undefined,
  notes: Row[],
  failureLabel: string | undefined,
): Delivery {
  const stage = d.stage as DeliveryStage;
  return {
    deliveryId: d.delivery_no,
    bagId: caseNo,
    passengerName: d.passenger_name ?? "",
    address: d.address ?? "",
    mobile: d.mobile ?? "",
    pirNumber: d.pir_number ?? "",
    priority: (d.priority ?? "Normal") as Priority,
    status: stageToLegacyStatus(stage),
    driver: agentName ?? "—",
    eta: d.scheduled_for ?? "",
    otpStatus: (otp?.state ?? "Pending") as OtpStatus,
    otpCode: otp?.code ?? "",
    destination:
      d.dest_lat != null && d.dest_lng != null
        ? { lat: d.dest_lat, lng: d.dest_lng, label: d.address ?? "" }
        : undefined,
    stage,
    deliveryType: d.delivery_type ?? undefined,
    vip: d.priority === "VIP",
    failureReason: failureLabel,
    createdAt: d.created_at,
    lastUpdatedAt: d.updated_at,
    acceptedAt: d.accepted_at ?? undefined,
    collectedAt: d.collected_at ?? undefined,
    deliveredAt: d.delivered_at ?? undefined,
    notes: notes
      .filter((n) => n.delivery_id === d.id)
      .map((n) => ({
        id: n.id,
        at: n.created_at,
        actor: n.author_name ?? "system",
        text: n.body ?? "",
      })),
  };
}

export function mapWorkflow(d: Row, caseNo: string, token: string | undefined, events: Row[]): WorkflowRecord {
  return {
    deliveryId: d.delivery_no,
    bagId: caseNo,
    status: d.workflow_status as WorkflowStatus,
    token: token ?? "",
    history: events
      .filter((e) => e.delivery_id === d.id)
      .map((e) => ({
        status: e.to_status as WorkflowStatus,
        at: e.occurred_at,
        actor: e.actor_name ?? "system",
        role: e.actor_role ?? undefined,
      })),
  };
}

export function mapNotification(n: Row, deliveryNo: string | undefined): NotificationEvent {
  return {
    id: n.id,
    deliveryId: deliveryNo ?? "",
    status: n.trigger_status as NotificationTrigger,
    channel: n.channel as NotificationChannel,
    locale: (n.locale === "ar" ? "ar" : "en") as "en" | "ar",
    to: n.recipient ?? "",
    message: { subject: n.subject || undefined, body: n.body ?? "" },
    createdAt: n.created_at,
    status_: (n.state === "cancelled" ? "failed" : n.state) as NotificationEvent["status_"],
    operator: "Workflow Engine",
    sentAt: n.sent_at ?? undefined,
    provider: n.provider ?? undefined,
    providerId: n.provider_message_id ?? undefined,
    attempts: n.attempt_count ?? 0,
    lastAttemptAt: n.last_attempt_at ?? undefined,
    failureReason: n.failure_reason || undefined,
  };
}

export function mapAudit(a: Row, deliveryNo: string | undefined, caseNo: string | undefined): AuditEntry {
  const entityId =
    a.entity_type === "delivery" ? (deliveryNo ?? a.entity_id) : (caseNo ?? a.entity_id);
  return {
    id: String(a.id),
    action: (a.action ?? "case.update") as AuditEntry["action"],
    actor: a.actor_name ?? "system",
    role: a.actor_role ?? undefined,
    entityType: (a.entity_type ?? "case") as AuditEntry["entityType"],
    entityId,
    note: a.note || undefined,
    at: a.occurred_at,
  };
}

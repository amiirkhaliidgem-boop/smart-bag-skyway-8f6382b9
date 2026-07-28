// ---------------------------------------------------------------------------
// Operational projection cache.
//
// PostgreSQL is the single source of truth. This module holds a read-only
// projection of the normalized production tables and forwards every mutation
// to the Workflow Engine functions in the database. It contains no business
// rules, no seed data and no `app_state`.
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from "react";
import { WORKFLOW_STATUSES, type WorkflowStatus } from "./workflow/statuses";
import type {
  NotificationChannel,
  RenderedMessage,
  NotificationTrigger,
} from "./notifications/templates";
import type { AuditEntry, ImportAuditEntry } from "./audit/log";
import type { Role } from "./roles/roles";
import type { LFStatus } from "./lost-found/statuses";
import { type DeliveryStage, stageFromLegacy } from "./delivery/stages";
import type { FailureReason } from "./delivery/stages";
import { loadOpsSnapshot, callOpsRpc } from "./ops.functions";
import { saveStation, logDataIoEvent } from "./settings.functions";
import { supabase } from "@/integrations/supabase/client";

export type CaseStatus =
  | "Missing"
  | "Located"
  | "Stored"
  | "Ready For Delivery"
  | "Out For Delivery"
  | "Delivered";

export type DeliveryStatus =
  | "Pending"
  | "Assigned"
  | "Picked Up"
  | "Out For Delivery"
  | "Delivered";

export type OtpStatus = "Pending" | "Sent" | "Verified" | "Failed";

export type Priority = "Normal" | "VIP";

export type DeliveryMethod = "Home Delivery" | "Airport Pickup";

export interface CaseDocument {
  id: string;
  type: "Passport Copy" | "Arrival Stamp" | "Authorization Letter" | "Other";
  name: string;
  uploadedAt: string;
  uploadedBy?: string;
  sizeKb?: number;
}

export interface CasePassenger {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nationality?: string;
  passportNumber?: string;
  pnr?: string;
  ticketNumber?: string;
  mobile2?: string;
  preferredLanguage?: "en" | "ar" | "fr";
}

export interface CaseFlight {
  airline?: string;
  arrivalTime?: string;
  originAirport?: string;
  destinationAirport?: string;
  terminal?: string;
  arrivalBelt?: string;
}

export interface CaseBaggage {
  numberOfBags?: number;
  weightKg?: number;
  brand?: string;
  color?: string;
  type?: string;
  size?: string;
  distinctiveMarks?: string;
  vipPassenger?: boolean;
  rushDelivery?: boolean;
  fragile?: boolean;
  // Enterprise: one bag tag per physical bag. Length should match
  // numberOfBags. Legacy cases without this array fall back to
  // BaggageCase.bagTagNumber (single-tag). Kept optional for backward
  // compatibility with pre-existing seeds and imports.
  bagTags?: string[];
}

export interface CaseDelivery {
  method?: DeliveryMethod;
  country?: string;
  governorate?: string;
  city?: string;
  district?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  nearestLandmark?: string;
  googleMapsLink?: string;
  preferredDeliveryTime?: string;
  // Enterprise: single free-form delivery address captured by the L&F
  // wizard. When present this is the authoritative address used to
  // bootstrap Delivery Management. Legacy structured fields remain for
  // backward compatibility.
  fullAddress?: string;
}

export interface CaseInternal {
  assignedOfficer?: string;
  station?: string;
  department?: string;
  internalNotes?: string;
  casePriority?: Priority;
  createdBy?: string;
}

export type CallDirection = "Inbound" | "Outbound" | "No Answer" | "Callback Required";

export interface CallLog {
  id: string;
  bagId?: string;
  pirNumber?: string;
  passengerName: string;
  phone: string;
  agent: string;
  direction: CallDirection;
  durationSec: number;
  notes: string;
  at: string;
}

export interface WhatsAppMessage {
  id: string;
  passengerName: string;
  phone: string;
  pirNumber?: string;
  lastMessage: string;
  unread: number;
  at: string;
  thread: { from: "Passenger" | "Agent"; text: string; at: string }[];
}

export interface Feedback {
  id: string;
  bagId: string;
  passengerName: string;
  resolved: boolean;
  rating: number; // 1-5
  comments: string;
  at: string;
}

export interface QualityIncident {
  id: string;
  bagId: string;
  deliveryId?: string;
  passengerName: string;
  driver: string;
  category: "Possible Misconduct" | "Damaged Baggage" | "Late Delivery" | "Other";
  severity: "High" | "Medium" | "Low";
  status: "Open" | "Under Review" | "Resolved";
  description: string;
  at: string;
}

export interface WorkflowRecord {
  deliveryId: string;
  bagId: string;
  status: WorkflowStatus;
  token: string;
  history: {
    status: WorkflowStatus;
    at: string;
    actor: string;
    role?: Role;
  }[];
}

export interface NotificationEvent {
  id: string;
  deliveryId: string;
  status: NotificationTrigger;
  channel: NotificationChannel;
  locale: "en" | "ar";
  to: string;
  message: RenderedMessage;
  createdAt: string;
  status_: "queued" | "sending" | "sent" | "failed";
  passengerName?: string;
  pirNumber?: string;
  operator?: string;
  sentAt?: string;
  /** Provider that handled (or last attempted) this event, e.g. "simulated-sms". */
  provider?: string;
  /** Provider-side message id returned on a successful send. */
  providerId?: string;
  attempts?: number;
  lastAttemptAt?: string;
  failureReason?: string;
}

export interface BaggageCase {
  bagId: string;
  passengerName: string;
  flightNumber: string;
  pirNumber: string;
  bagTagNumber: string;
  arrivalDate: string;
  contact: string;
  email: string;
  description: string;
  status: CaseStatus;
  storage: { zone: string; shelf: string; position: string } | null;
  createdAt: string;
  resolvedAt?: string;
  // ---- Enterprise L&F extensions (all optional; legacy seeds keep working)
  lfStatus?: LFStatus;
  priority?: Priority;
  passenger?: CasePassenger;
  flight?: CaseFlight;
  baggage?: CaseBaggage;
  delivery?: CaseDelivery;
  internal?: CaseInternal;
  documents?: CaseDocument[];
  lfHistory?: {
    status: LFStatus;
    at: string;
    actor: string;
    note?: string;
  }[];
  updatedAt?: string;
  /** L&F operational: true when import/creation captured only the
   *  mandatory operational fields and one or more optional fields are
   *  still pending. Agents complete these later; workflow is unaffected. */
  incomplete?: boolean;
  /** Human-readable list of optional fields still missing. Cleared once
   *  the case is fully completed. */
  missingFields?: string[];
}

export interface Delivery {
  deliveryId: string;
  bagId: string;
  passengerName: string;
  address: string;
  mobile: string;
  pirNumber: string;
  priority: Priority;
  status: DeliveryStatus;
  driver: string;
  eta: string;
  otpStatus: OtpStatus;
  otpCode: string;
  driverLocation?: { lat: number; lng: number; label: string };
  destination?: { lat: number; lng: number; label: string };
  // ---- Delivery Management operational overlay (all optional; legacy
  // seeds derive stage from `status` via stageFromLegacy). ----
  stage?: DeliveryStage;
  station?: string;
  deliveryType?: "Home Delivery" | "Airport Pickup";
  vip?: boolean;
  failureReason?: string;
  createdAt?: string;
  lastUpdatedAt?: string;
  acceptedAt?: string;
  collectedAt?: string;
  deliveredAt?: string;
  notes?: { id: string; at: string; actor: string; text: string }[];
}

interface State {
  cases: BaggageCase[];
  deliveries: Delivery[];
  callLogs: CallLog[];
  whatsapp: WhatsAppMessage[];
  feedback: Feedback[];
  qualityIncidents: QualityIncident[];
  workflow: WorkflowRecord[];
  notifications: NotificationEvent[];
  audit: AuditEntry[];
  ioAudit: ImportAuditEntry[];
  station: Station;
  driverPositions: Record<string, DriverPosition>;
  driverRoutes: Record<string, DriverRoute>;
}

// Station (airport) configuration — origin for route optimization and the
// default anchor for the driver's route. Editable from Settings › Airport
// so the system can be deployed at any airport, not just Cairo.
export interface Station {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export const DEFAULT_STATION: Station = {
  code: "CAI",
  name: "Cairo International Airport",
  lat: 30.1219,
  lng: 31.4056,
};

// Live driver position reported by the Driver Portal. The Workflow
// Engine reads this when it recomputes a driver's optimized route.
export interface DriverPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  at: string;
}

// Route optimized by the Workflow Engine for a specific driver.
// The Driver Portal is a pure consumer — it never runs optimization
// itself, it only renders `stops` in this order.
export interface DriverRoute {
  driver: string;
  origin: { lat: number; lng: number; source: "gps" | "lastStop" | "station" };
  stops: string[]; // deliveryId in visit order
  computedAt: string;
}

/** Which snapshot collections hit their read cap, and the cap that applied. */
export interface SnapshotTruncation {
  cases: boolean;
  deliveries: boolean;
  audit: boolean;
  notifications: boolean;
  limits: { cases: number; deliveries: number; audit: number; notifications: number };
}

const EMPTY_TRUNCATION: SnapshotTruncation = {
  cases: false,
  deliveries: false,
  audit: false,
  notifications: false,
  limits: { cases: 0, deliveries: 0, audit: 0, notifications: 0 },
};

interface State {
  cases: BaggageCase[];
  deliveries: Delivery[];
  callLogs: CallLog[];
  whatsapp: WhatsAppMessage[];
  feedback: Feedback[];
  qualityIncidents: QualityIncident[];
  workflow: WorkflowRecord[];
  notifications: NotificationEvent[];
  audit: AuditEntry[];
  ioAudit: ImportAuditEntry[];
  station: Station;
  driverPositions: Record<string, DriverPosition>;
  driverRoutes: Record<string, DriverRoute>;
  truncated: SnapshotTruncation;
}

function emptyState(): State {
  return {
    cases: [],
    deliveries: [],
    callLogs: [],
    whatsapp: [],
    feedback: [],
    qualityIncidents: [],
    workflow: [],
    notifications: [],
    audit: [],
    ioAudit: [],
    station: DEFAULT_STATION,
    driverPositions: {},
    driverRoutes: {},
    truncated: EMPTY_TRUNCATION,
  };
}

let state: State = emptyState();
const listeners = new Set<() => void>();

// Identifier maps: the UI speaks human identifiers (BAG-000123 / DEL-000123),
// the database speaks UUIDs.
let caseIds: Record<string, string> = {};
let deliveryIds: Record<string, string> = {};
let agentIds: Record<string, string> = {};
let caseVersions: Record<string, number> = {};
let deliveryVersions: Record<string, number> = {};

/** Active Delivery Agents, refreshed from `app_users` on every snapshot. */
export const driverPool: string[] = [];

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: State) => T): T {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  return selector(snapshot);
}

export function getState() {
  return state;
}

export { WORKFLOW_STATUSES };

// ---------- Hydration ----------

let hydrating: Promise<void> | null = null;
let booted = false;

export async function refreshOps(): Promise<void> {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const snap = await loadOpsSnapshot();
      state = {
        ...state,
        cases: snap.cases,
        deliveries: snap.deliveries,
        workflow: snap.workflow,
        notifications: snap.notifications,
        audit: snap.audit,
        feedback: snap.feedback,
        qualityIncidents: snap.qualityIncidents,
        station: snap.station,
        driverPositions: snap.driverPositions,
        driverRoutes: snap.driverRoutes,
        truncated: { ...snap.truncated, limits: snap.limits },
      };
      caseIds = snap.caseIds;
      deliveryIds = snap.deliveryIds;
      agentIds = snap.agentIds;
      caseVersions = snap.caseVersions;
      deliveryVersions = snap.deliveryVersions;
      driverPool.splice(0, driverPool.length, ...snap.agents.map((a) => a.name));
      notify();
    } catch (err) {
      console.warn("[ops] snapshot load failed", err);
    } finally {
      hydrating = null;
    }
  })();
  return hydrating;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRefresh() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshOps();
  }, 150);
}

function boot() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  void refreshOps();
  supabase.auth.onAuthStateChange((_e, session) => {
    if (session) void refreshOps();
    else {
      state = emptyState();
      notify();
    }
  });
  const channel = supabase
    .channel("ops_sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "baggage_cases" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "notification_events" }, scheduleRefresh)
    .subscribe();
  window.addEventListener("beforeunload", () => {
    void supabase.removeChannel(channel);
  });
}

if (typeof window !== "undefined") setTimeout(boot, 0);

// ---------- Engine bridge ----------

type RpcArgs = Record<string, unknown>;

async function rpc(fn: string, args: RpcArgs) {
  const result = await callOpsRpc({ data: { fn, args } });
  await refreshOps();
  return result;
}

function caseUuid(bagId: string) {
  return caseIds[bagId];
}
function deliveryUuid(deliveryId: string) {
  return deliveryIds[deliveryId];
}
function agentUuid(name: string) {
  return agentIds[name];
}

function reportError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn("[ops]", message);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:ops-error", { detail: { message } }));
  }
  return message;
}

// ---------- Read helpers ----------

export function getWorkflow(deliveryId: string): WorkflowRecord | undefined {
  return state.workflow.find((w) => w.deliveryId === deliveryId);
}

export function findByToken(token: string): WorkflowRecord | undefined {
  return state.workflow.find((w) => w.token === token);
}

export function ensurePassengerToken(deliveryId: string): string | undefined {
  return state.workflow.find((w) => w.deliveryId === deliveryId)?.token || undefined;
}

export function getDeliveryStage(d: Delivery): DeliveryStage {
  return d.stage ?? stageFromLegacy(d);
}

// ---------- Lost & Found ----------

export async function addCase(
  input: Omit<BaggageCase, "bagId" | "status" | "storage" | "createdAt"> & {
    initialLfStatus?: LFStatus;
  },
): Promise<BaggageCase | null> {
  const payload = {
    pir_number: input.pirNumber,
    passenger_name: input.passengerName,
    passenger_first_name: input.passenger?.firstName,
    passenger_middle_name: input.passenger?.middleName,
    passenger_last_name: input.passenger?.lastName,
    nationality: input.passenger?.nationality,
    passport_number: input.passenger?.passportNumber,
    pnr: input.passenger?.pnr,
    ticket_number: input.passenger?.ticketNumber,
    contact_mobile: input.contact,
    contact_mobile_alt: input.passenger?.mobile2,
    email: input.email,
    airline: input.flight?.airline ?? "",
    flight_number: input.flightNumber,
    arrival_date: input.arrivalDate || null,
    arrival_time: input.flight?.arrivalTime,
    origin_airport: input.flight?.originAirport,
    destination_airport: input.flight?.destinationAirport,
    terminal: input.flight?.terminal,
    arrival_belt: input.flight?.arrivalBelt,
    number_of_bags: input.baggage?.numberOfBags ?? 1,
    weight_kg: input.baggage?.weightKg,
    bag_brand: input.baggage?.brand,
    bag_color: input.baggage?.color,
    bag_type: input.baggage?.type,
    bag_size: input.baggage?.size,
    distinctive_marks: input.baggage?.distinctiveMarks,
    fragile: input.baggage?.fragile ?? false,
    rush_delivery: input.baggage?.rushDelivery ?? false,
    description: input.description ?? "",
    priority: input.priority ?? input.internal?.casePriority ?? "Normal",
    delivery_method: input.delivery?.method ?? "Home Delivery",
    full_address: input.delivery?.fullAddress ?? "",
    preferred_delivery_time: input.delivery?.preferredDeliveryTime,
    google_maps_link: input.delivery?.googleMapsLink,
    department: input.internal?.department ?? "",
    internal_notes: input.internal?.internalNotes ?? "",
    incomplete: input.incomplete ?? false,
    missing_fields: input.missingFields ?? [],
    bag_tags: input.baggage?.bagTags?.length
      ? input.baggage.bagTags
      : input.bagTagNumber
        ? [input.bagTagNumber]
        : [],
  };
  try {
    await rpc("lf_create_case", { p_payload: payload });
    const created = state.cases.find((c) => c.pirNumber === input.pirNumber);
    if (created && input.initialLfStatus && input.initialLfStatus !== "Open") {
      await updateLfStatus(created.bagId, input.initialLfStatus, { force: true });
    }
    return state.cases.find((c) => c.pirNumber === input.pirNumber) ?? null;
  } catch (err) {
    reportError(err);
    return null;
  }
}

function casePatchPayload(patch: Partial<BaggageCase>): RpcArgs {
  const p: RpcArgs = {};
  if (patch.passengerName !== undefined) p.passenger_name = patch.passengerName;
  if (patch.flightNumber !== undefined) p.flight_number = patch.flightNumber;
  if (patch.contact !== undefined) p.contact_mobile = patch.contact;
  if (patch.email !== undefined) p.email = patch.email;
  if (patch.description !== undefined) p.description = patch.description;
  if (patch.arrivalDate !== undefined) p.arrival_date = patch.arrivalDate;
  if (patch.priority !== undefined) p.priority = patch.priority;
  if (patch.incomplete !== undefined) p.incomplete = patch.incomplete;
  if (patch.missingFields !== undefined) p.missing_fields = patch.missingFields;
  if (patch.storage !== undefined && patch.storage) {
    p.storage_zone = patch.storage.zone;
    p.storage_shelf = patch.storage.shelf;
    p.storage_position = patch.storage.position;
  }
  const pa = patch.passenger;
  if (pa) {
    if (pa.firstName !== undefined) p.passenger_first_name = pa.firstName;
    if (pa.middleName !== undefined) p.passenger_middle_name = pa.middleName;
    if (pa.lastName !== undefined) p.passenger_last_name = pa.lastName;
    if (pa.nationality !== undefined) p.nationality = pa.nationality;
    if (pa.passportNumber !== undefined) p.passport_number = pa.passportNumber;
    if (pa.pnr !== undefined) p.pnr = pa.pnr;
    if (pa.ticketNumber !== undefined) p.ticket_number = pa.ticketNumber;
    if (pa.mobile2 !== undefined) p.contact_mobile_alt = pa.mobile2;
  }
  const fl = patch.flight;
  if (fl) {
    if (fl.airline !== undefined) p.airline = fl.airline;
    if (fl.arrivalTime !== undefined) p.arrival_time = fl.arrivalTime;
    if (fl.originAirport !== undefined) p.origin_airport = fl.originAirport;
    if (fl.destinationAirport !== undefined) p.destination_airport = fl.destinationAirport;
    if (fl.terminal !== undefined) p.terminal = fl.terminal;
    if (fl.arrivalBelt !== undefined) p.arrival_belt = fl.arrivalBelt;
  }
  const bg = patch.baggage;
  if (bg) {
    if (bg.numberOfBags !== undefined) p.number_of_bags = bg.numberOfBags;
    if (bg.weightKg !== undefined) p.weight_kg = bg.weightKg;
    if (bg.brand !== undefined) p.bag_brand = bg.brand;
    if (bg.color !== undefined) p.bag_color = bg.color;
    if (bg.type !== undefined) p.bag_type = bg.type;
    if (bg.size !== undefined) p.bag_size = bg.size;
    if (bg.distinctiveMarks !== undefined) p.distinctive_marks = bg.distinctiveMarks;
    if (bg.fragile !== undefined) p.fragile = bg.fragile;
    if (bg.rushDelivery !== undefined) p.rush_delivery = bg.rushDelivery;
    if (bg.bagTags !== undefined) p.bag_tags = bg.bagTags;
  }
  const dl = patch.delivery;
  if (dl) {
    if (dl.method !== undefined) p.delivery_method = dl.method;
    if (dl.fullAddress !== undefined) p.full_address = dl.fullAddress;
    if (dl.googleMapsLink !== undefined) p.google_maps_link = dl.googleMapsLink;
    if (dl.preferredDeliveryTime !== undefined) p.preferred_delivery_time = dl.preferredDeliveryTime;
  }
  const it = patch.internal;
  if (it) {
    if (it.department !== undefined) p.department = it.department;
    if (it.internalNotes !== undefined) p.internal_notes = it.internalNotes;
  }
  return p;
}

export async function updateCase(bagId: string, patch: Partial<BaggageCase>) {
  const id = caseUuid(bagId);
  if (!id) return;
  try {
    await rpc("lf_update_case", {
      p_case: id,
      p_payload: casePatchPayload(patch),
      p_expected_version: caseVersions[bagId] ?? null,
    });
  } catch (err) {
    reportError(err);
  }
}

export async function editCase(
  bagId: string,
  patch: Partial<BaggageCase>,
  _opts: { actor?: string; role?: Role; note?: string } = {},
) {
  await updateCase(bagId, patch);
}

export async function updateLfStatus(
  bagId: string,
  next: LFStatus,
  _opts: { actor?: string; role?: Role; note?: string; force?: boolean } = {},
) {
  const id = caseUuid(bagId);
  if (!id) return;
  try {
    await rpc("lf_set_status", {
      p_case: id,
      p_status: next,
      p_expected_version: caseVersions[bagId] ?? null,
    });
  } catch (err) {
    reportError(err);
  }
}

export async function bulkUpdateCases(bagIds: string[], patch: Partial<BaggageCase>) {
  for (const bagId of bagIds) await updateCase(bagId, patch);
}

export async function bulkAssignDelivery(
  bagIds: string[],
  _opts: { actor?: string; role?: Role } = {},
): Promise<{ handedOver: number; alreadyHandedOver: number; skipped: number }> {
  let alreadyHandedOver = 0;
  let skipped = 0;
  const targets: string[] = [];
  for (const bagId of bagIds) {
    const c = state.cases.find((x) => x.bagId === bagId);
    if (!c) {
      skipped++;
      continue;
    }
    const current = c.lfStatus ?? "Open";
    if (current === "Ready for Delivery" || state.deliveries.some((d) => d.bagId === bagId)) {
      alreadyHandedOver++;
      continue;
    }
    if (current === "Delivered" || current === "Closed") {
      skipped++;
      continue;
    }
    targets.push(bagId);
  }
  let handedOver = 0;
  if (targets.length) {
    try {
      const ids = targets.map((b) => caseUuid(b)).filter(Boolean);
      handedOver = (await rpc("lf_bulk_set_status", {
        p_cases: ids,
        p_status: "Ready for Delivery",
      })) as number;
    } catch (err) {
      reportError(err);
    }
  }
  return { handedOver: handedOver ?? 0, alreadyHandedOver, skipped };
}

export async function assignStorage(
  bagId: string,
  storage: { zone: string; shelf: string; position: string },
) {
  await updateCase(bagId, { storage });
}

// Documents are not part of the production schema yet.
export function addCaseDocument(
  _bagId: string,
  _doc: Omit<CaseDocument, "id" | "uploadedAt">,
): CaseDocument | undefined {
  return undefined;
}
export function removeCaseDocument(_bagId: string, _docId: string) {}

// ---------- Delivery Management ----------

export async function scheduleDelivery(
  deliveryId: string,
  eta: string,
  _opts: { actor?: string; role?: Role } = {},
) {
  const id = deliveryUuid(deliveryId);
  if (!id) return;
  try {
    await rpc("dm_schedule", {
      p_delivery: id,
      p_scheduled_for: eta,
      p_expected_version: deliveryVersions[deliveryId] ?? null,
    });
  } catch (err) {
    reportError(err);
  }
}

export async function assignDriver(
  deliveryId: string,
  driver: string,
  opts: { actor?: string; role?: Role; note?: string } = {},
) {
  const id = deliveryUuid(deliveryId);
  const agent = agentUuid(driver);
  if (!id || !agent) {
    reportError(new Error(`No active Delivery Agent record for "${driver}"`));
    return;
  }
  try {
    await rpc("dm_assign_agent", {
      p_delivery: id,
      p_agent: agent,
      p_expected_version: deliveryVersions[deliveryId] ?? null,
    });
    if (opts.note?.trim()) await addDeliveryNote(deliveryId, opts.note);
  } catch (err) {
    reportError(err);
  }
}

export async function bulkAssignDriver(
  deliveryIds: string[],
  driver: string,
  opts: { actor?: string; role?: Role; note?: string } = {},
) {
  for (const id of deliveryIds) await assignDriver(id, driver, opts);
}

export async function addDeliveryNote(
  deliveryId: string,
  text: string,
  _opts: { actor?: string; role?: Role } = {},
) {
  const id = deliveryUuid(deliveryId);
  if (!id || !text.trim()) return;
  try {
    await rpc("dm_add_note", { p_delivery: id, p_body: text.trim() });
  } catch (err) {
    reportError(err);
  }
}

export async function resendOtp(deliveryId: string, _opts: { actor?: string } = {}) {
  const id = deliveryUuid(deliveryId);
  if (!id) return;
  try {
    await rpc("dm_resend_otp", { p_delivery: id });
  } catch (err) {
    reportError(err);
  }
}

export const generateOtp = resendOtp;

export async function markDeliveryFailed(
  deliveryId: string,
  reason: FailureReason,
  opts: { actor?: string; role?: Role; note?: string } = {},
) {
  const id = deliveryUuid(deliveryId);
  if (!id) return;
  try {
    await rpc("dm_mark_failed", {
      p_delivery: id,
      p_reason_code: String(reason),
      p_note: opts.note ?? "",
      p_expected_version: deliveryVersions[deliveryId] ?? null,
    });
  } catch (err) {
    reportError(err);
  }
}

export async function markReturnedToAirport(
  deliveryId: string,
  _opts: { actor?: string; role?: Role } = {},
) {
  const id = deliveryUuid(deliveryId);
  if (!id) return;
  try {
    await rpc("dm_mark_returned", {
      p_delivery: id,
      p_expected_version: deliveryVersions[deliveryId] ?? null,
    });
  } catch (err) {
    reportError(err);
  }
}

export async function closeDelivery(
  deliveryId: string,
  _opts: { actor?: string; role?: Role } = {},
) {
  const id = deliveryUuid(deliveryId);
  if (!id) return;
  try {
    await rpc("dm_close", { p_delivery: id });
  } catch (err) {
    reportError(err);
  }
}

export async function rescheduleDelivery(
  deliveryId: string,
  _opts: { actor?: string; role?: Role } = {},
) {
  const id = deliveryUuid(deliveryId);
  if (!id) return;
  try {
    await rpc("dm_schedule", {
      p_delivery: id,
      p_scheduled_for: new Date().toISOString(),
      p_expected_version: deliveryVersions[deliveryId] ?? null,
    });
  } catch (err) {
    reportError(err);
  }
}

/** Generic stage move. Routed to the Workflow Engine, which validates it. */
export async function setDeliveryStage(
  deliveryId: string,
  stage: DeliveryStage,
  opts: { actor?: string; role?: Role; note?: string; failureReason?: FailureReason } = {},
) {
  if (stage === "Delivery Failed") {
    await markDeliveryFailed(deliveryId, (opts.failureReason ?? "OTHER") as FailureReason, opts);
    return;
  }
  if (stage === "Returned to Airport") {
    await markReturnedToAirport(deliveryId, opts);
    return;
  }
  const id = deliveryUuid(deliveryId);
  if (!id) return;
  try {
    await rpc("wf_transition", {
      p_delivery: id,
      p_to: stage,
      p_reason: opts.note ?? "",
      p_metadata: {},
      p_expected_version: deliveryVersions[deliveryId] ?? null,
    });
  } catch (err) {
    reportError(err);
  }
}

// ---------- Delivery Agent actions ----------

async function agentAdvance(deliveryId: string, stage: DeliveryStage) {
  const id = deliveryUuid(deliveryId);
  if (!id) return;
  try {
    await rpc("agent_advance", {
      p_delivery: id,
      p_to: stage,
      p_expected_version: deliveryVersions[deliveryId] ?? null,
    });
  } catch (err) {
    reportError(err);
  }
}

export const driverAccept = (deliveryId: string, _opts: { actor?: string; role?: Role } = {}) =>
  agentAdvance(deliveryId, "Driver Accepted");
export const driverCollect = (deliveryId: string, _opts: { actor?: string; role?: Role } = {}) =>
  agentAdvance(deliveryId, "Collected Bag");
export const driverStartTrip = (deliveryId: string, _opts: { actor?: string; role?: Role } = {}) =>
  agentAdvance(deliveryId, "Out for Delivery");
export const driverReject = (deliveryId: string, _opts: { actor?: string; role?: Role; note?: string } = {}) =>
  agentAdvance(deliveryId, "Scheduled");

export async function driverMarkDelivered(
  deliveryId: string,
  opts: { actor?: string; role?: Role; code?: string } = {},
) {
  const id = deliveryUuid(deliveryId);
  if (!id) return;
  try {
    await rpc("agent_complete_delivery", { p_delivery: id, p_code: opts.code ?? "" });
  } catch (err) {
    reportError(err);
  }
}

export async function reportDriverPosition(
  _driver: string,
  pos: { lat: number; lng: number; accuracy?: number },
) {
  if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;
  try {
    await rpc("agent_report_position", {
      p_lat: pos.lat,
      p_lng: pos.lng,
      p_accuracy: pos.accuracy ?? null,
    });
  } catch (err) {
    reportError(err);
  }
}

// Contact Center is not backed by production tables yet — these stay
// in-memory for the current session and are reported as a known gap.
export function addCallLog(input: Omit<CallLog, "id" | "at">) {
  const log: CallLog = { ...input, id: `CL-${Date.now()}`, at: new Date().toISOString() };
  state = { ...state, callLogs: [log, ...state.callLogs] };
  notify();
  return log;
}

export function logIoAudit(entry: Omit<ImportAuditEntry, "id" | "at">) {
  const full: ImportAuditEntry = { ...entry, id: `IO-${Date.now()}`, at: new Date().toISOString() };
  state = { ...state, ioAudit: [full, ...state.ioAudit] };
  notify();
  // Persist to the administration audit trail (fire-and-forget).
  void logDataIoEvent({
    data: {
      action: full.action,
      actor: full.actor ?? "Operator",
      target: `${full.moduleLabel ?? full.moduleId ?? "Data I/O"}${full.fileName ? ` · ${full.fileName}` : ""}`,
      details: JSON.stringify({
        format: full.format,
        totalRows: full.totalRows,
        accepted: full.accepted,
        rejected: full.rejected,
        warnings: full.warnings,
        duplicates: full.duplicates,
      }),
    },
  }).catch(reportError);
  return full;
}

export async function setStation(patch: Partial<Station>) {
  const next = { ...state.station, ...patch };
  state = { ...state, station: next };
  notify();
  try {
    await saveStation({ data: next });
    await refreshOps();
  } catch (err) {
    reportError(err);
  }
  return state.station;
}

import { useSyncExternalStore } from "react";
import {
  WORKFLOW_STATUSES,
  type WorkflowStatus,
  canTransition,
} from "./workflow/statuses";
import {
  toCaseStatus,
  toDeliveryStatus,
  fromDeliveryStatus,
} from "./workflow/mapping";
import {
  renderTemplate,
  type NotificationChannel,
  type TemplateContext,
  type RenderedMessage,
  type NotificationTrigger,
} from "./notifications/templates";
import { defaultAdapters } from "./notifications/channels";
import { generateTrackingToken } from "./passenger/tokens";
import type { AuditEntry, ImportAuditEntry } from "./audit/log";
import type { Role } from "./roles/roles";
import type { LFStatus } from "./lost-found/statuses";
import { LF_TO_WORKFLOW, canTransitionLf } from "./lost-found/statuses";
import {
  type DeliveryStage,
  stageToWorkflow,
  stageToLegacyStatus,
  stageFromLegacy,
} from "./delivery/stages";
import { stageToLfStatus } from "./delivery/stages";
import type { FailureReason } from "./delivery/stages";

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

const driverPool = [
  "Ahmed Mostafa",
  "Karim El-Sayed",
  "Youssef Hassan",
  "Omar Nabil",
  "Mahmoud Farouk",
];

const seedCases: BaggageCase[] = [
  {
    bagId: "BAG-100231",
    passengerName: "Mariam Hossam",
    flightNumber: "MS985",
    pirNumber: "CAIMS12045",
    bagTagNumber: "MS548921",
    arrivalDate: "2026-06-18",
    contact: "+20 100 234 5512",
    email: "mariam.hossam@example.com",
    description: "Black Samsonite hardshell, 28in, red ribbon on handle",
    status: "Delivered",
    storage: { zone: "A", shelf: "03", position: "12" },
    createdAt: "2026-06-18T09:14:00Z",
    resolvedAt: "2026-06-19T16:40:00Z",
  },
  {
    bagId: "BAG-100232",
    passengerName: "Tarek Abdelrahman",
    flightNumber: "TK694",
    pirNumber: "CAITK13902",
    bagTagNumber: "TK220981",
    arrivalDate: "2026-06-19",
    contact: "+20 122 884 7710",
    email: "tarek.a@example.com",
    description: "Navy soft-shell American Tourister, 24in, name tag attached",
    status: "Ready For Delivery",
    storage: { zone: "B", shelf: "07", position: "04" },
    createdAt: "2026-06-19T11:02:00Z",
  },
  {
    bagId: "BAG-100233",
    passengerName: "Layla Ibrahim",
    flightNumber: "EK927",
    pirNumber: "CAIEK77120",
    bagTagNumber: "EK771203",
    arrivalDate: "2026-06-20",
    contact: "+20 111 552 0991",
    email: "layla.ibrahim@example.com",
    description: "Silver Delsey cabin trolley with blue strap",
    status: "Stored",
    storage: { zone: "A", shelf: "11", position: "02" },
    createdAt: "2026-06-20T07:45:00Z",
  },
  {
    bagId: "BAG-100234",
    passengerName: "Hassan El-Shenawy",
    flightNumber: "LH582",
    pirNumber: "CAILH40118",
    bagTagNumber: "LH401184",
    arrivalDate: "2026-06-20",
    contact: "+20 100 998 2210",
    email: "h.shenawy@example.com",
    description: "Large black Tumi suitcase, gold zipper, 30in",
    status: "Out For Delivery",
    storage: { zone: "C", shelf: "02", position: "08" },
    createdAt: "2026-06-20T14:21:00Z",
  },
  {
    bagId: "BAG-100235",
    passengerName: "Nour Adel",
    flightNumber: "AF553",
    pirNumber: "CAIAF66302",
    bagTagNumber: "AF663021",
    arrivalDate: "2026-06-21",
    contact: "+20 109 332 1145",
    email: "nour.adel@example.com",
    description: "Pink Kipling backpack with monkey keychain",
    status: "Located",
    storage: { zone: "B", shelf: "01", position: "10" },
    createdAt: "2026-06-21T05:30:00Z",
  },
  {
    bagId: "BAG-100236",
    passengerName: "Sherif Mounir",
    flightNumber: "QR1303",
    pirNumber: "CAIQR88410",
    bagTagNumber: "QR884103",
    arrivalDate: "2026-06-21",
    contact: "+20 122 100 4477",
    email: "sherif.mounir@example.com",
    description: "Olive green duffel bag, leather handles, no wheels",
    status: "Missing",
    storage: null,
    createdAt: "2026-06-21T08:55:00Z",
  },
  {
    bagId: "BAG-100237",
    passengerName: "Dina Saad",
    flightNumber: "MS777",
    pirNumber: "CAIMS90021",
    bagTagNumber: "MS900213",
    arrivalDate: "2026-06-19",
    contact: "+20 100 778 3320",
    email: "dina.saad@example.com",
    description: "Red Rimowa cabin, dented top-left corner",
    status: "Delivered",
    storage: { zone: "A", shelf: "05", position: "09" },
    createdAt: "2026-06-19T16:10:00Z",
    resolvedAt: "2026-06-20T12:30:00Z",
  },
  {
    bagId: "BAG-100238",
    passengerName: "Omar Khaled",
    flightNumber: "BA155",
    pirNumber: "CAIBA22907",
    bagTagNumber: "BA229073",
    arrivalDate: "2026-06-20",
    contact: "+20 111 220 9988",
    email: "omar.khaled@example.com",
    description: "Grey North Face hiking backpack, 65L, sleeping bag attached",
    status: "Ready For Delivery",
    storage: { zone: "C", shelf: "09", position: "01" },
    createdAt: "2026-06-20T19:00:00Z",
  },
];

const seedDeliveries: Delivery[] = [
  {
    deliveryId: "DEL-50012",
    bagId: "BAG-100234",
    passengerName: "Hassan El-Shenawy",
    address: "14 Road 9, Maadi, Cairo",
    mobile: "+20 100 998 2210",
    pirNumber: "CAILH40118",
    priority: "VIP",
    status: "Out For Delivery",
    driver: "Ahmed Mostafa",
    eta: "2026-06-23T19:30:00Z",
    otpStatus: "Sent",
    otpCode: "4819",
    driverLocation: { lat: 30.058, lng: 31.245, label: "Salah Salem, Cairo" },
    destination: { lat: 29.96, lng: 31.258, label: "Maadi, Cairo" },
  },
  {
    deliveryId: "DEL-50013",
    bagId: "BAG-100232",
    passengerName: "Tarek Abdelrahman",
    address: "27 El-Nasr St, Nasr City, Cairo",
    mobile: "+20 122 884 7710",
    pirNumber: "CAITK13902",
    priority: "Normal",
    status: "Assigned",
    driver: "Karim El-Sayed",
    eta: "2026-06-23T21:00:00Z",
    otpStatus: "Pending",
    otpCode: "3021",
    destination: { lat: 30.05, lng: 31.34, label: "Nasr City, Cairo" },
  },
  {
    deliveryId: "DEL-50014",
    bagId: "BAG-100238",
    passengerName: "Omar Khaled",
    address: "8 Mohamed Mazhar, Zamalek, Cairo",
    mobile: "+20 111 220 9988",
    pirNumber: "CAIBA22907",
    priority: "Normal",
    status: "Pending",
    driver: "—",
    eta: "2026-06-24T10:00:00Z",
    otpStatus: "Pending",
    otpCode: "7756",
    destination: { lat: 30.063, lng: 31.219, label: "Zamalek, Cairo" },
  },
  {
    deliveryId: "DEL-50011",
    bagId: "BAG-100231",
    passengerName: "Mariam Hossam",
    address: "55 El-Tahrir, Dokki, Giza",
    mobile: "+20 100 234 5512",
    pirNumber: "CAIMS12045",
    priority: "Normal",
    status: "Delivered",
    driver: "Youssef Hassan",
    eta: "2026-06-19T16:40:00Z",
    otpStatus: "Verified",
    otpCode: "9100",
    destination: { lat: 30.038, lng: 31.211, label: "Dokki, Giza" },
  },
];

const seedCallLogs: CallLog[] = [
  {
    id: "CL-9001",
    bagId: "BAG-100236",
    pirNumber: "CAIQR88410",
    passengerName: "Sherif Mounir",
    phone: "+20 122 100 4477",
    agent: "Sara Mahmoud",
    direction: "Inbound",
    durationSec: 312,
    notes: "Passenger requesting update on missing bag. Promised callback within 2h.",
    at: "2026-06-23T08:14:00Z",
  },
  {
    id: "CL-9002",
    bagId: "BAG-100234",
    pirNumber: "CAILH40118",
    passengerName: "Hassan El-Shenawy",
    phone: "+20 100 998 2210",
    agent: "Mohamed Reda",
    direction: "Outbound",
    durationSec: 184,
    notes: "Confirmed delivery window 19:00–20:30, OTP sent via SMS.",
    at: "2026-06-23T14:02:00Z",
  },
  {
    id: "CL-9003",
    bagId: "BAG-100232",
    pirNumber: "CAITK13902",
    passengerName: "Tarek Abdelrahman",
    phone: "+20 122 884 7710",
    agent: "Sara Mahmoud",
    direction: "Callback Required",
    durationSec: 0,
    notes: "Voicemail left. Customer to confirm delivery address.",
    at: "2026-06-23T15:20:00Z",
  },
  {
    id: "CL-9004",
    passengerName: "Yara Magdy",
    phone: "+20 100 442 1009",
    agent: "Hadeer Samir",
    direction: "No Answer",
    durationSec: 0,
    notes: "First attempt — no answer. Retry scheduled.",
    at: "2026-06-23T16:48:00Z",
  },
];

const seedWhatsapp: WhatsAppMessage[] = [
  {
    id: "WA-7001",
    passengerName: "Hassan El-Shenawy",
    phone: "+20 100 998 2210",
    pirNumber: "CAILH40118",
    lastMessage: "Delivery agent is 10 min away. Please share OTP at handover.",
    unread: 0,
    at: "2026-06-23T18:40:00Z",
    thread: [
      { from: "Passenger", text: "Hi, any update on my bag?", at: "2026-06-23T14:00:00Z" },
      { from: "Agent", text: "Hello Mr. Hassan, your bag is out for delivery now.", at: "2026-06-23T14:05:00Z" },
      { from: "Agent", text: "Delivery agent is 10 min away. Please share OTP at handover.", at: "2026-06-23T18:40:00Z" },
    ],
  },
  {
    id: "WA-7002",
    passengerName: "Layla Ibrahim",
    phone: "+20 111 552 0991",
    pirNumber: "CAIEK77120",
    lastMessage: "We located your bag in Zone A. Scheduling delivery tomorrow.",
    unread: 2,
    at: "2026-06-23T11:22:00Z",
    thread: [
      { from: "Passenger", text: "Where is my luggage??", at: "2026-06-23T10:01:00Z" },
      { from: "Agent", text: "We located your bag in Zone A. Scheduling delivery tomorrow.", at: "2026-06-23T11:22:00Z" },
    ],
  },
  {
    id: "WA-7003",
    passengerName: "Nour Adel",
    phone: "+20 109 332 1145",
    pirNumber: "CAIAF66302",
    lastMessage: "Thanks! Received the bag in good condition.",
    unread: 0,
    at: "2026-06-22T20:11:00Z",
    thread: [
      { from: "Agent", text: "Your bag has been delivered. Please confirm receipt.", at: "2026-06-22T19:50:00Z" },
      { from: "Passenger", text: "Thanks! Received the bag in good condition.", at: "2026-06-22T20:11:00Z" },
    ],
  },
];

const seedFeedback: Feedback[] = [
  {
    id: "FB-3001",
    bagId: "BAG-100231",
    passengerName: "Mariam Hossam",
    resolved: true,
    rating: 5,
    comments: "Excellent service. Delivery agent was punctual and very polite.",
    at: "2026-06-19T17:10:00Z",
  },
  {
    id: "FB-3002",
    bagId: "BAG-100237",
    passengerName: "Dina Saad",
    resolved: true,
    rating: 4,
    comments: "Slight delay but communication was clear. Thank you.",
    at: "2026-06-20T13:00:00Z",
  },
  {
    id: "FB-3003",
    bagId: "BAG-100234",
    passengerName: "Hassan El-Shenawy",
    resolved: false,
    rating: 3,
    comments: "Delivery still in progress at time of survey.",
    at: "2026-06-23T19:00:00Z",
  },
];

let state: State = load();
const listeners = new Set<() => void>();

function defaults(): State {
  const workflow: WorkflowRecord[] = seedDeliveries.map((d) => ({
    deliveryId: d.deliveryId,
    bagId: d.bagId,
    status: fromDeliveryStatus(d.status),
    token: generateTrackingToken(d.deliveryId),
    history: [
      {
        status: fromDeliveryStatus(d.status),
        at: new Date().toISOString(),
        actor: "system",
      },
    ],
  }));
  return {
    cases: seedCases,
    deliveries: seedDeliveries,
    callLogs: seedCallLogs,
    whatsapp: seedWhatsapp,
    feedback: seedFeedback,
    qualityIncidents: [],
    workflow,
    notifications: [],
    audit: [],
    ioAudit: [],
    station: DEFAULT_STATION,
    driverPositions: {},
    driverRoutes: {},
  };
}

function load(): State {
  const defaults: State = {
    cases: seedCases,
    deliveries: seedDeliveries,
    callLogs: seedCallLogs,
    whatsapp: seedWhatsapp,
    feedback: seedFeedback,
    qualityIncidents: [],
    workflow: [],
    notifications: [],
    audit: [],
    ioAudit: [],
    station: DEFAULT_STATION,
    driverPositions: {},
    driverRoutes: {},
  };
  // Always start from defaults on both server and client so SSR HTML
  // matches the first client render. localStorage is merged in after
  // hydration via `hydrateFromStorage()` scheduled below.
  return defaults;
}

// -- Supabase-backed persistence (single source of truth) ------------------
// The store keeps its full behavior. On the client, we bootstrap from
// `app_state` in Supabase, subscribe to realtime changes, and push every
// mutation back. Preview and Open-in-New-Tab therefore see the same state.
import {
  initPersistence,
  scheduleRemotePush,
  markRemoteApply,
} from "./persistence";

let bootstrapped = false;
function applyRemote(payload: unknown, _version: number) {
  const base = defaults();
  const parsed = (payload ?? {}) as Partial<State>;
  state = {
    ...base,
    ...parsed,
    workflow:
      parsed.workflow && parsed.workflow.length ? parsed.workflow : base.workflow,
    notifications: parsed.notifications ?? base.notifications,
    audit: parsed.audit ?? base.audit,
    ioAudit: parsed.ioAudit ?? base.ioAudit,
    station: parsed.station ?? base.station,
    driverPositions: parsed.driverPositions ?? base.driverPositions,
    driverRoutes: parsed.driverRoutes ?? base.driverRoutes,
  };
  // Coerce legacy Cairo-specific L&F statuses persisted before the
  // airport-neutral rename into the current canonical values.
  if (state.cases?.length) {
    state = {
      ...state,
      cases: state.cases.map((c) => {
        const v = c.lfStatus as unknown as string | undefined;
        if (v === "In Transit to Cairo" || v === "Arrived at Cairo") {
          return { ...c, lfStatus: "Arrived at Airport" as LFStatus };
        }
        return c;
      }),
    };
  }
  listeners.forEach((l) => l());
}

function ensureBootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  // Note: we intentionally do NOT short-circuit on `/passenger/` here.
  // Passenger visitors are unauthenticated, so `initPersistence` won't
  // fetch or push the staff snapshot (session gate + RLS). Staff previewing
  // a case are authenticated and need the store hydrated to resolve the
  // token → case fallback in TokenPortal.
  bootstrapped = true;
  // Prime state to defaults so seed data is visible before auth completes;
  // once signed in, remote state (if any) replaces it.
  state = defaults();
  markRemoteApply(); // don't push the freshly-seeded defaults immediately
  listeners.forEach((l) => l());
  void initPersistence(applyRemote);
}

if (typeof window !== "undefined") {
  // Defer to after React's initial hydration so HTML doesn't mismatch.
  setTimeout(ensureBootstrap, 0);
}

function emit() {
  listeners.forEach((l) => l());
  scheduleRemotePush(() => state);
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

export function getWorkflow(deliveryId: string): WorkflowRecord | undefined {
  return state.workflow.find((w) => w.deliveryId === deliveryId);
}

export function findByToken(token: string): WorkflowRecord | undefined {
  return state.workflow.find((w) => w.token === token);
}

// Returns the passenger tracking token for a delivery, bootstrapping the
// workflow record on first access if it does not yet exist. Used by the
// internal Passenger Portal preview inside Delivery Management. Does not
// change status, emit notifications, or write audit.
export function ensurePassengerToken(deliveryId: string): string | undefined {
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) return undefined;
  const rec = ensureWorkflow(deliveryId);
  return rec.token;
}

// ---------- Workflow Engine ----------
function ensureWorkflow(deliveryId: string): WorkflowRecord {
  let rec = state.workflow.find((w) => w.deliveryId === deliveryId);
  if (rec) return rec;
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) throw new Error(`No delivery ${deliveryId}`);
  rec = {
    deliveryId,
    bagId: d.bagId,
    status: fromDeliveryStatus(d.status),
    token: generateTrackingToken(deliveryId),
    history: [
      {
        status: fromDeliveryStatus(d.status),
        at: new Date().toISOString(),
        actor: "system",
      },
    ],
  };
  state = { ...state, workflow: [...state.workflow, rec] };
  // Persist newly bootstrapped workflow (incl. passenger tracking token) to
  // Supabase via the same push path used by every other workflow update.
  emit();
  return rec;
}

function pushAudit(entry: Omit<AuditEntry, "id" | "at">) {
  const id = `AUD-${state.audit.length + 1}`;
  const full: AuditEntry = {
    ...entry,
    id,
    at: new Date().toISOString(),
  };
  state = { ...state, audit: [full, ...state.audit] };
}

function enqueueNotifications(deliveryId: string, status: WorkflowStatus) {
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) return;
  const rec = state.workflow.find((w) => w.deliveryId === deliveryId);
  const ctx: TemplateContext = {
    passengerName: d.passengerName,
    pirNumber: d.pirNumber,
    driverName: d.driver,
    otp: d.otpCode,
    trackingUrl: rec ? `/passenger/${rec.token}` : undefined,
  };
  const channels: NotificationChannel[] = ["sms", "whatsapp"];
  const events: NotificationEvent[] = [];
  for (const channel of channels) {
    for (const locale of ["en", "ar"] as const) {
      const msg = renderTemplate(status, channel, locale, ctx);
      if (!msg) continue;
      events.push({
        id: `NTF-${state.notifications.length + events.length + 1}`,
        deliveryId,
        status,
        channel,
        locale,
        to: d.mobile,
        message: msg,
        createdAt: new Date().toISOString(),
        status_: "queued",
        passengerName: d.passengerName,
        pirNumber: d.pirNumber,
        operator: "Workflow Engine",
      });
    }
  }
  if (events.length) {
    state = { ...state, notifications: [...events, ...state.notifications] };
    for (const e of events) {
      pushAudit({
        action: "notification.dispatch",
        actor: "system",
        entityType: "notification",
        entityId: e.id,
        note: `${e.channel}/${e.locale} → ${e.to}`,
      });
    }
  }
}

export function transitionWorkflow(
  deliveryId: string,
  next: WorkflowStatus,
  opts: { actor?: string; role?: Role; force?: boolean } = {},
) {
  ensureWorkflow(deliveryId);
  const current = state.workflow.find((w) => w.deliveryId === deliveryId)!;
  if (!opts.force && !canTransition(current.status, next)) return current;
  const from = current.status;
  const updated: WorkflowRecord = {
    ...current,
    status: next,
    history: [
      ...current.history,
      {
        status: next,
        at: new Date().toISOString(),
        actor: opts.actor ?? "system",
        role: opts.role,
      },
    ],
  };
  state = {
    ...state,
    workflow: state.workflow.map((w) => (w.deliveryId === deliveryId ? updated : w)),
  };
  // Mirror to legacy Delivery/Case shapes so existing UI keeps working.
  const legacyD = toDeliveryStatus(next);
  const legacyC = toCaseStatus(next);
  state = {
    ...state,
    deliveries: state.deliveries.map((d) =>
      d.deliveryId === deliveryId ? { ...d, status: legacyD } : d,
    ),
  };
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (d) {
    state = {
      ...state,
      cases: state.cases.map((c) =>
        c.bagId === d.bagId
          ? {
              ...c,
              status: legacyC,
              resolvedAt:
                legacyC === "Delivered"
                  ? c.resolvedAt ?? new Date().toISOString()
                  : c.resolvedAt,
            }
          : c,
      ),
    };
  }
  pushAudit({
    action: "workflow.transition",
    actor: opts.actor ?? "system",
    role: opts.role,
    entityType: "delivery",
    entityId: deliveryId,
    fromStatus: from,
    toStatus: next,
  });
  enqueueNotifications(deliveryId, next);
  emit();
  return updated;
}

export { WORKFLOW_STATUSES };

export function getState() {
  return state;
}

export function addCase(
  input: Omit<BaggageCase, "bagId" | "status" | "storage" | "createdAt"> & {
    initialLfStatus?: LFStatus;
  },
) {
  const nextNum =
    state.cases.reduce((max, c) => {
      const n = parseInt(c.bagId.replace("BAG-", ""), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 100000) + 1;
  const now = new Date().toISOString();
  const lfStatus: LFStatus = input.initialLfStatus ?? "Open";
  const newCase: BaggageCase = {
    ...input,
    bagId: `BAG-${nextNum}`,
    status: "Missing",
    storage: null,
    createdAt: now,
    updatedAt: now,
    lfStatus,
    documents: input.documents ?? [],
    lfHistory: [
      { status: lfStatus, at: now, actor: input.internal?.createdBy ?? "system", note: "Case created" },
    ],
  };
  state = { ...state, cases: [newCase, ...state.cases] };
  pushAudit({
    action: "case.create",
    actor: newCase.internal?.createdBy ?? "system",
    entityType: "case",
    entityId: newCase.bagId,
    note: `PIR ${newCase.pirNumber} — ${newCase.passengerName}`,
  });
  emit();
  return newCase;
}

export function updateCase(bagId: string, patch: Partial<BaggageCase>) {
  state = {
    ...state,
    cases: state.cases.map((c) =>
      c.bagId === bagId ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
    ),
  };
  emit();
}

// Enterprise edit: apply a patch, write an audit entry and (optionally) a
// lfHistory breadcrumb so Activity Timeline reflects the modification.
// Keeps Workflow Status unchanged unless the caller included lfStatus in the
// patch — status changes MUST still go through updateLfStatus / the Workflow
// Engine. Additive; leaves existing consumers of updateCase intact.
export function editCase(
  bagId: string,
  patch: Partial<BaggageCase>,
  opts: { actor?: string; role?: Role; note?: string } = {},
) {
  const before = state.cases.find((x) => x.bagId === bagId);
  if (!before) return;
  const now = new Date().toISOString();
  state = {
    ...state,
    cases: state.cases.map((c) =>
      c.bagId === bagId ? { ...c, ...patch, updatedAt: now } : c,
    ),
  };
  pushAudit({
    action: "case.update",
    actor: opts.actor ?? "system",
    role: opts.role,
    entityType: "case",
    entityId: bagId,
    note: opts.note ?? "Case edited",
  });
  emit();
}

// ---------- Lost & Found status engine ----------
// Update the canonical L&F status on a case, append to lfHistory, write an
// audit entry, and mirror into the central Workflow Engine when a matching
// delivery record exists so timeline / notifications / dashboard stay
// consistent without duplicating state.
export function updateLfStatus(
  bagId: string,
  next: LFStatus,
  opts: { actor?: string; role?: Role; note?: string; force?: boolean } = {},
) {
  const c = state.cases.find((x) => x.bagId === bagId);
  if (!c) return;
  const current = c.lfStatus ?? "Open";
  if (!opts.force && current !== next && !canTransitionLf(current, next)) return;
  const now = new Date().toISOString();
  state = {
    ...state,
    cases: state.cases.map((x) =>
      x.bagId === bagId
        ? {
            ...x,
            lfStatus: next,
            updatedAt: now,
            lfHistory: [
              ...(x.lfHistory ?? []),
              { status: next, at: now, actor: opts.actor ?? "system", note: opts.note },
            ],
            resolvedAt:
              next === "Delivered" || next === "Closed"
                ? x.resolvedAt ?? now
                : x.resolvedAt,
          }
        : x,
    ),
  };
  pushAudit({
    action: "case.update",
    actor: opts.actor ?? "system",
    role: opts.role,
    entityType: "case",
    entityId: bagId,
    note: `${current} → ${next}${opts.note ? ` · ${opts.note}` : ""}`,
  });
  // ---- Enterprise ownership hand-off ----
  // When the case reaches "Ready for Delivery" and no delivery record has
  // been created yet, bootstrap one automatically so Delivery Management
  // takes over ownership. Reuses the SAME bagId, PIR, passenger, address,
  // and priority — no duplicate records, no copied state. The Workflow
  // Engine mirror below then generates the tracking token and pushes the
  // status through the shared engine.
  if (next === "Ready for Delivery") {
    const already = state.deliveries.find((d) => d.bagId === bagId);
    if (!already) {
      const cc = state.cases.find((x) => x.bagId === bagId);
      if (cc) {
        const addr =
          cc.delivery?.fullAddress ??
          [
            cc.delivery?.building,
            cc.delivery?.street,
            cc.delivery?.district,
            cc.delivery?.city,
            cc.delivery?.governorate,
            cc.delivery?.country,
          ]
            .filter(Boolean)
            .join(", ");
        const otp = String(Math.floor(1000 + Math.random() * 9000));
        const eta = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        addDelivery({
          bagId,
          passengerName: cc.passengerName,
          address: addr || "—",
          mobile: cc.contact,
          pirNumber: cc.pirNumber,
          priority: cc.priority ?? cc.internal?.casePriority ?? "Normal",
          status: "Pending",
          driver: "—",
          eta,
          otpStatus: "Pending",
          otpCode: otp,
        });
        pushAudit({
          action: "delivery.bootstrap",
          actor: opts.actor ?? "system",
          role: opts.role,
          entityType: "case",
          entityId: bagId,
          note: "Delivery order created — ownership handed to Delivery Management",
        });
      }
    }
  }
  // Mirror to Workflow Engine when a delivery exists for this bag.
  const linkedDelivery = state.deliveries.find((d) => d.bagId === bagId);
  if (linkedDelivery) {
    const wf = LF_TO_WORKFLOW[next];
    if (wf) {
      // transitionWorkflow already handles legacy sync, audit, notifications.
      try {
        transitionWorkflow(linkedDelivery.deliveryId, wf, {
          actor: opts.actor,
          role: opts.role,
        });
      } catch {
        /* no-op */
      }
    }
  }
  emit();
}

export function addCaseDocument(
  bagId: string,
  doc: Omit<CaseDocument, "id" | "uploadedAt">,
) {
  const c = state.cases.find((x) => x.bagId === bagId);
  if (!c) return;
  const id = `DOC-${Date.now()}`;
  const full: CaseDocument = {
    ...doc,
    id,
    uploadedAt: new Date().toISOString(),
  };
  state = {
    ...state,
    cases: state.cases.map((x) =>
      x.bagId === bagId
        ? { ...x, documents: [...(x.documents ?? []), full], updatedAt: full.uploadedAt }
        : x,
    ),
  };
  pushAudit({
    action: "case.update",
    actor: doc.uploadedBy ?? "system",
    entityType: "case",
    entityId: bagId,
    note: `Document uploaded — ${doc.type}: ${doc.name}`,
  });
  emit();
  return full;
}

export function removeCaseDocument(bagId: string, docId: string) {
  state = {
    ...state,
    cases: state.cases.map((x) =>
      x.bagId === bagId
        ? { ...x, documents: (x.documents ?? []).filter((d) => d.id !== docId) }
        : x,
    ),
  };
  emit();
}

export function bulkUpdateCases(bagIds: string[], patch: Partial<BaggageCase>) {
  const now = new Date().toISOString();
  state = {
    ...state,
    cases: state.cases.map((c) =>
      bagIds.includes(c.bagId) ? { ...c, ...patch, updatedAt: now } : c,
    ),
  };
  emit();
}

// ----------------------------------------------------------------------
// Bulk hand-off from Lost & Found to Delivery Management.
// Drives each selected case through the SAME "Ready for Delivery"
// transition the PIR wizard uses, so the Workflow Engine remains the
// single source of truth: it bootstraps the Delivery record, mirrors
// the status through the workflow, and fires the automatic passenger
// notification. No manual notifications, no direct delivery mutations.
export function bulkAssignDelivery(
  bagIds: string[],
  opts: { actor?: string; role?: Role } = {},
): { handedOver: number; alreadyHandedOver: number; skipped: number } {
  let handedOver = 0;
  let alreadyHandedOver = 0;
  let skipped = 0;
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
    updateLfStatus(bagId, "Ready for Delivery", {
      actor: opts.actor,
      role: opts.role,
      note: "Bulk hand-off to Delivery Management",
      force: true,
    });
    handedOver++;
  }
  return { handedOver, alreadyHandedOver, skipped };
}

export function assignStorage(
  bagId: string,
  storage: { zone: string; shelf: string; position: string },
) {
  updateCase(bagId, { storage, status: "Stored" });
}

export function addDelivery(input: Omit<Delivery, "deliveryId">) {
  const next =
    state.deliveries.reduce((max, d) => {
      const n = parseInt(d.deliveryId.replace("DEL-", ""), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 50000) + 1;
  const newDel: Delivery = { ...input, deliveryId: `DEL-${next}` };
  state = { ...state, deliveries: [newDel, ...state.deliveries] };
  emit();
  return newDel;
}

// ---------- Delivery Management operational helpers ----------

export function getDeliveryStage(d: Delivery): DeliveryStage {
  return d.stage ?? stageFromLegacy(d);
}

function writeDeliveryPatch(deliveryId: string, patch: Partial<Delivery>) {
  state = {
    ...state,
    deliveries: state.deliveries.map((d) =>
      d.deliveryId === deliveryId
        ? { ...d, ...patch, lastUpdatedAt: new Date().toISOString() }
        : d,
    ),
  };
}

export function setDeliveryStage(
  deliveryId: string,
  stage: DeliveryStage,
  opts: { actor?: string; role?: Role; note?: string; failureReason?: FailureReason } = {},
) {
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) return;
  const now = new Date().toISOString();
  const patch: Partial<Delivery> = {
    stage,
    status: stageToLegacyStatus(stage),
  };
  if (stage === "Driver Accepted") patch.acceptedAt = now;
  if (stage === "Collected Bag") patch.collectedAt = now;
  if (stage === "Delivered") patch.deliveredAt = now;
  if (stage === "Delivery Failed" && opts.failureReason)
    patch.failureReason = opts.failureReason;
  if (stage === "Returned to Airport") {
    patch.driver = "—";
    patch.otpStatus = "Pending";
  }
  writeDeliveryPatch(deliveryId, patch);
  pushAudit({
    action: "delivery.update",
    actor: opts.actor ?? "system",
    role: opts.role,
    entityType: "delivery",
    entityId: deliveryId,
    note:
      opts.note ??
      `Stage → ${stage}${opts.failureReason ? ` · ${opts.failureReason}` : ""}`,
  });
  // Feed the Workflow Engine (which triggers Notifications + Timeline + Audit).
  const wf = stageToWorkflow(stage);
  const backward = stage === "Delivery Failed" || stage === "Returned to Airport";
  transitionWorkflow(deliveryId, wf, {
    actor: opts.actor ?? "system",
    role: opts.role,
    force: backward,
  });
  // Mirror the operational stage into the L&F case so Lost & Found and
  // Delivery Management never show conflicting statuses.
  if (d.bagId) {
    const lf = stageToLfStatus(stage);
    const c = state.cases.find((x) => x.bagId === d.bagId);
    if (c && c.lfStatus !== lf) {
      updateLfStatus(d.bagId, lf, {
        actor: opts.actor ?? "system",
        role: opts.role,
        note: opts.note ?? `Delivery stage → ${stage}`,
        force: true,
      });
    }
  }
  recomputeAllDriverRoutes();
  emit();
}

export function assignDriver(
  deliveryId: string,
  driver: string,
  opts: { actor?: string; role?: Role; note?: string } = {},
) {
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) return;
  const prev = d.driver && d.driver !== "—" ? d.driver : null;
  const wasAssigned = !!prev;
  // Auto-generate OTP (only visible in the Passenger Portal — never shown
  // to the driver or the dispatcher) and bootstrap the passenger tracking
  // token before we transition the workflow. Both must exist before the
  // DRIVER_ASSIGNED notification templates render, otherwise the SMS /
  // WhatsApp link would be missing.
  const otpCode = String(Math.floor(1000 + Math.random() * 9000));
  ensureWorkflow(deliveryId);
  writeDeliveryPatch(deliveryId, {
    driver,
    otpCode,
    otpStatus: "Sent",
  });
  pushAudit({
    action: "delivery.assign",
    actor: opts.actor ?? "system",
    role: opts.role,
    entityType: "delivery",
    entityId: deliveryId,
    note: wasAssigned
      ? `Delivery agent reassigned — changed from ${prev} to ${driver}`
      : `Assigned to ${driver}`,
  });
  pushAudit({
    action: "delivery.update",
    actor: "system",
    entityType: "delivery",
    entityId: deliveryId,
    note: "OTP generated automatically",
  });
  // Advance stage to Assigned via the Workflow Engine — this also fires
  // the DRIVER_ASSIGNED SMS + WhatsApp templates to the passenger,
  // including the secure Passenger Portal link.
  setDeliveryStage(deliveryId, "Assigned", {
    actor: opts.actor,
    role: opts.role,
    note: wasAssigned
      ? `Delivery agent changed from ${prev} to ${driver}`
      : `Delivery Agent: ${driver}`,
  });
  if (opts.note && opts.note.trim()) {
    addDeliveryNote(deliveryId, opts.note, { actor: opts.actor, role: opts.role });
  }
}

export function bulkAssignDriver(
  deliveryIds: string[],
  driver: string,
  opts: { actor?: string; role?: Role; note?: string } = {},
) {
  for (const id of deliveryIds) assignDriver(id, driver, opts);
}

// ----- Driver-side transitions (Delivery Management is the source of
// truth for the operational stage machine; Driver Portal UI is untouched
// and will consume these helpers when wired). -----

export function driverAccept(
  deliveryId: string,
  opts: { actor?: string; role?: Role } = {},
) {
  setDeliveryStage(deliveryId, "Driver Accepted", {
    ...opts,
    note: "Delivery agent accepted",
  });
}

export function driverReject(
  deliveryId: string,
  opts: { actor?: string; role?: Role; note?: string } = {},
) {
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) return;
  const previous = d.driver;
  // Clear driver and move back to Scheduled so a coordinator can reassign.
  writeDeliveryPatch(deliveryId, { driver: "—" });
  pushAudit({
    action: "delivery.assign",
    actor: opts.actor ?? previous ?? "system",
    role: opts.role,
    entityType: "delivery",
    entityId: deliveryId,
    note: `Delivery agent rejected — ${previous ?? "n/a"}${opts.note ? ` · ${opts.note}` : ""}`,
  });
  setDeliveryStage(deliveryId, "Scheduled", {
    actor: opts.actor,
    role: opts.role,
    note: "Rescheduled after driver rejection",
  });
}

export function driverCollect(
  deliveryId: string,
  opts: { actor?: string; role?: Role } = {},
) {
  setDeliveryStage(deliveryId, "Collected Bag", opts);
}

export function driverStartTrip(
  deliveryId: string,
  opts: { actor?: string; role?: Role } = {},
) {
  setDeliveryStage(deliveryId, "Out for Delivery", opts);
}

export function driverMarkDelivered(
  deliveryId: string,
  opts: { actor?: string; role?: Role } = {},
) {
  setDeliveryStage(deliveryId, "Delivered", opts);
}

export function markDeliveryFailed(
  deliveryId: string,
  reason: FailureReason,
  opts: { actor?: string; role?: Role } = {},
) {
  setDeliveryStage(deliveryId, "Delivery Failed", { ...opts, failureReason: reason });
}

export function markReturnedToAirport(
  deliveryId: string,
  opts: { actor?: string; role?: Role } = {},
) {
  setDeliveryStage(deliveryId, "Returned to Airport", opts);
}

export function rescheduleDelivery(
  deliveryId: string,
  opts: { actor?: string; role?: Role } = {},
) {
  // Returned/failed deliveries become available for scheduling again.
  writeDeliveryPatch(deliveryId, { failureReason: undefined, driver: "—" });
  setDeliveryStage(deliveryId, "Ready for Delivery", {
    ...opts,
    note: "Rescheduled — back in the queue",
  });
}

export function scheduleDelivery(
  deliveryId: string,
  eta: string,
  opts: { actor?: string; role?: Role } = {},
) {
  writeDeliveryPatch(deliveryId, { eta });
  setDeliveryStage(deliveryId, "Scheduled", {
    ...opts,
    note: `Scheduled for ${new Date(eta).toLocaleString("en-GB")}`,
  });
}

export function addDeliveryNote(
  deliveryId: string,
  text: string,
  opts: { actor?: string; role?: Role } = {},
) {
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d || !text.trim()) return;
  const note = {
    id: `NOTE-${Date.now()}`,
    at: new Date().toISOString(),
    actor: opts.actor ?? "system",
    text: text.trim(),
  };
  writeDeliveryPatch(deliveryId, { notes: [...(d.notes ?? []), note] });
  pushAudit({
    action: "delivery.update",
    actor: opts.actor ?? "system",
    role: opts.role,
    entityType: "delivery",
    entityId: deliveryId,
    note: `Note added: ${note.text.slice(0, 80)}`,
  });
  emit();
  return note;
}

export function generateOtp(deliveryId: string, opts: { actor?: string } = {}) {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  writeDeliveryPatch(deliveryId, { otpCode: code, otpStatus: "Sent" });
  pushAudit({
    action: "delivery.update",
    actor: opts.actor ?? "system",
    entityType: "delivery",
    entityId: deliveryId,
    note: "OTP generated",
  });
  emit();
  return code;
}

export function resendOtp(deliveryId: string, opts: { actor?: string } = {}) {
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) return;
  // If the OTP was cleared (e.g. expired / never generated), mint a new
  // one before resending. The dispatcher never sees the code — it is only
  // exposed in the Passenger Portal.
  const regenerated = !d.otpCode;
  const code = d.otpCode ?? String(Math.floor(1000 + Math.random() * 9000));
  writeDeliveryPatch(deliveryId, { otpCode: code, otpStatus: "Sent" });
  ensureWorkflow(deliveryId);
  pushAudit({
    action: "delivery.update",
    actor: opts.actor ?? "system",
    entityType: "delivery",
    entityId: deliveryId,
    note: regenerated ? "OTP regenerated and resent" : "OTP resent",
  });
  // Re-fire the DRIVER_ASSIGNED passenger notifications so the portal
  // link (and OTP inside it) reaches the passenger again.
  enqueueNotifications(deliveryId, "DRIVER_ASSIGNED");
  emit();
  return code;
}

export function closeDelivery(deliveryId: string, opts: { actor?: string; role?: Role } = {}) {
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (!d) return;
  pushAudit({
    action: "delivery.update",
    actor: opts.actor ?? "system",
    role: opts.role,
    entityType: "delivery",
    entityId: deliveryId,
    note: "Delivery closed",
  });
  transitionWorkflow(deliveryId, "CLOSED", { actor: opts.actor, role: opts.role, force: true });
  emit();
}

export function updateDelivery(deliveryId: string, patch: Partial<Delivery>) {
  const prev = state.deliveries.find((x) => x.deliveryId === deliveryId);
  state = {
    ...state,
    deliveries: state.deliveries.map((d) =>
      d.deliveryId === deliveryId ? { ...d, ...patch } : d,
    ),
  };
  // Sync underlying case status when delivery progresses
  const d = state.deliveries.find((x) => x.deliveryId === deliveryId);
  if (d) {
    const map: Record<DeliveryStatus, CaseStatus | null> = {
      Pending: null,
      Assigned: "Ready For Delivery",
      "Picked Up": "Out For Delivery",
      "Out For Delivery": "Out For Delivery",
      Delivered: "Delivered",
    };
    const next = map[d.status];
    if (next) {
      state = {
        ...state,
        cases: state.cases.map((c) =>
          c.bagId === d.bagId
            ? {
                ...c,
                status: next,
                resolvedAt:
                  next === "Delivered"
                    ? new Date().toISOString()
                    : c.resolvedAt,
              }
            : c,
        ),
      };
    }
  }
  emit();
  // Feed the central workflow engine when the delivery status changed so
  // notifications, audit, and passenger portal timeline stay in sync.
  if (prev && d && prev.status !== d.status) {
    transitionWorkflow(deliveryId, fromDeliveryStatus(d.status), {
      actor: patch.driver ?? "system",
    });
  }
}

export function addFeedback(input: Omit<Feedback, "id" | "at">) {
  const next =
    state.feedback.reduce((max, f) => {
      const n = parseInt(f.id.replace("FB-", ""), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 3000) + 1;
  const f: Feedback = { ...input, id: `FB-${next}`, at: new Date().toISOString() };
  state = { ...state, feedback: [f, ...state.feedback] };
  emit();
  return f;
}

export function addCallLog(input: Omit<CallLog, "id" | "at">) {
  const next =
    state.callLogs.reduce((max, l) => {
      const n = parseInt(l.id.replace("CL-", ""), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 9000) + 1;
  const log: CallLog = { ...input, id: `CL-${next}`, at: new Date().toISOString() };
  state = { ...state, callLogs: [log, ...state.callLogs] };
  emit();
  return log;
}

export function addQualityIncident(
  input: Omit<QualityIncident, "id" | "at">,
) {
  const next =
    state.qualityIncidents.reduce((max, i) => {
      const n = parseInt(i.id.replace("QI-", ""), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 4000) + 1;
  const incident: QualityIncident = {
    ...input,
    id: `QI-${next}`,
    at: new Date().toISOString(),
  };
  state = {
    ...state,
    qualityIncidents: [incident, ...state.qualityIncidents],
  };
  emit();
  return incident;
}

export { driverPool };

// ---------- Import/Export audit ----------
export function logIoAudit(entry: Omit<ImportAuditEntry, "id" | "at">) {
  const id = `IO-${state.ioAudit.length + 1}`;
  const full: ImportAuditEntry = {
    ...entry,
    id,
    at: new Date().toISOString(),
  };
  state = { ...state, ioAudit: [full, ...state.ioAudit] };
  emit();
  return full;
}

// ---------- Station configuration ----------
// Origin used by the route optimization engine. Editable from Settings ›
// Airport so the platform can be deployed at any airport.
export function setStation(patch: Partial<Station>) {
  state = { ...state, station: { ...state.station, ...patch } };
  recomputeAllDriverRoutes();
  emit();
  return state.station;
}

// ---------- Route Optimization Engine ----------
// The Workflow Engine owns route optimization. It runs whenever the
// inputs change: driver assignment, delivery stage, station config, or
// a new position report from the Driver Portal. Drivers only ever read
// `driverRoutes[driver]` — they never optimize their own routes.
import { optimizeRoute } from "./routing/optimize";

function computeDriverRoute(driver: string): DriverRoute | null {
  const open = state.deliveries.filter(
    (d) =>
      d.driver === driver &&
      getDeliveryStage(d) !== "Delivered" &&
      getDeliveryStage(d) !== "Delivery Failed" &&
      getDeliveryStage(d) !== "Returned to Airport",
  );
  if (!open.length) return null;
  const gps = state.driverPositions[driver];
  const lastCompleted = [...state.deliveries]
    .filter((d) => d.driver === driver && getDeliveryStage(d) === "Delivered")
    .sort((a, b) => (a.deliveredAt ?? "").localeCompare(b.deliveredAt ?? ""))
    .reverse()
    .find((d) => d.destination)?.destination;
  let origin: DriverRoute["origin"];
  if (gps) {
    origin = { lat: gps.lat, lng: gps.lng, source: "gps" };
  } else if (lastCompleted) {
    origin = { lat: lastCompleted.lat, lng: lastCompleted.lng, source: "lastStop" };
  } else {
    origin = { lat: state.station.lat, lng: state.station.lng, source: "station" };
  }
  const ordered = optimizeRoute(open, { lat: origin.lat, lng: origin.lng });
  return {
    driver,
    origin,
    stops: ordered.map((d) => d.deliveryId),
    computedAt: new Date().toISOString(),
  };
}

function affectedDrivers(): string[] {
  const set = new Set<string>();
  for (const d of state.deliveries) if (d.driver && d.driver !== "—") set.add(d.driver);
  for (const k of Object.keys(state.driverPositions)) set.add(k);
  for (const k of Object.keys(state.driverRoutes)) set.add(k);
  return [...set];
}

function recomputeAllDriverRoutes() {
  const next: Record<string, DriverRoute> = {};
  for (const driver of affectedDrivers()) {
    const r = computeDriverRoute(driver);
    if (r) next[driver] = r;
  }
  state = { ...state, driverRoutes: next };
}

// Called by the Driver Portal after acquiring / refreshing GPS. Throttling
// is the caller's responsibility — the store simply records the fix and
// triggers a recompute for that driver.
export function reportDriverPosition(
  driver: string,
  pos: { lat: number; lng: number; accuracy?: number },
) {
  if (!driver || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;
  state = {
    ...state,
    driverPositions: {
      ...state.driverPositions,
      [driver]: { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, at: new Date().toISOString() },
    },
  };
  const r = computeDriverRoute(driver);
  state = {
    ...state,
    driverRoutes: r
      ? { ...state.driverRoutes, [driver]: r }
      : Object.fromEntries(Object.entries(state.driverRoutes).filter(([k]) => k !== driver)),
  };
  emit();
}

// ---------- Notification helpers ----------
export function setNotificationStatus(
  id: string,
  status: NotificationEvent["status_"],
) {
  state = {
    ...state,
    notifications: state.notifications.map((n) =>
      n.id === id
        ? {
            ...n,
            status_: status,
            sentAt: status === "sent" ? new Date().toISOString() : n.sentAt,
          }
        : n,
    ),
  };
  emit();
}

export function createTestNotification(input: {
  deliveryId?: string;
  channel: NotificationChannel;
  workflowStatus?: WorkflowStatus;
  operator?: string;
}): NotificationEvent[] {
  const delivery =
    state.deliveries.find((d) => d.deliveryId === input.deliveryId) ??
    state.deliveries[0];
  if (!delivery) return [];
  const rec = state.workflow.find((w) => w.deliveryId === delivery.deliveryId);
  const workflowStatus: WorkflowStatus =
    input.workflowStatus ?? "OUT_FOR_DELIVERY";
  const ctx: TemplateContext = {
    passengerName: delivery.passengerName,
    pirNumber: delivery.pirNumber,
    driverName: delivery.driver,
    otp: delivery.otpCode,
    trackingUrl: rec ? `/passenger/${rec.token}` : undefined,
  };
  const events: NotificationEvent[] = [];
  for (const locale of ["en", "ar"] as const) {
    const msg = renderTemplate(workflowStatus, input.channel, locale, ctx);
    if (!msg) continue;
    events.push({
      id: `NTF-TEST-${Date.now()}-${locale}`,
      deliveryId: delivery.deliveryId,
      status: workflowStatus,
      channel: input.channel,
      locale,
      to: delivery.mobile,
      message: msg,
      createdAt: new Date().toISOString(),
      status_: "queued",
      passengerName: delivery.passengerName,
      pirNumber: delivery.pirNumber,
      operator: input.operator ?? "Test Operator",
    });
  }
  if (events.length) {
    state = { ...state, notifications: [...events, ...state.notifications] };
    emit();
  }
  return events;
}
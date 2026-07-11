import { useSyncExternalStore } from "react";

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

export type Priority = "Low" | "Normal" | "High" | "VIP";

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
}

interface State {
  cases: BaggageCase[];
  deliveries: Delivery[];
  callLogs: CallLog[];
  whatsapp: WhatsAppMessage[];
  feedback: Feedback[];
  qualityIncidents: QualityIncident[];
}

const STORAGE_KEY = "sbe-state-v5";

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
    otpCode: "481923",
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
    priority: "High",
    status: "Assigned",
    driver: "Karim El-Sayed",
    eta: "2026-06-23T21:00:00Z",
    otpStatus: "Pending",
    otpCode: "302145",
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
    otpCode: "775612",
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
    otpCode: "910044",
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
    lastMessage: "Driver is 10 min away. Please share OTP at handover.",
    unread: 0,
    at: "2026-06-23T18:40:00Z",
    thread: [
      { from: "Passenger", text: "Hi, any update on my bag?", at: "2026-06-23T14:00:00Z" },
      { from: "Agent", text: "Hello Mr. Hassan, your bag is out for delivery now.", at: "2026-06-23T14:05:00Z" },
      { from: "Agent", text: "Driver is 10 min away. Please share OTP at handover.", at: "2026-06-23T18:40:00Z" },
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
    comments: "Excellent service. Driver was punctual and very polite.",
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

function load(): State {
  const defaults: State = {
    cases: seedCases,
    deliveries: seedDeliveries,
    callLogs: seedCallLogs,
    whatsapp: seedWhatsapp,
    feedback: seedFeedback,
  };
  if (typeof window === "undefined") {
    return defaults;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      return { ...defaults, ...parsed };
    }
  } catch {}
  return defaults;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function emit() {
  persist();
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

export function addCase(
  input: Omit<BaggageCase, "bagId" | "status" | "storage" | "createdAt">,
) {
  const nextNum =
    state.cases.reduce((max, c) => {
      const n = parseInt(c.bagId.replace("BAG-", ""), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 100000) + 1;
  const newCase: BaggageCase = {
    ...input,
    bagId: `BAG-${nextNum}`,
    status: "Missing",
    storage: null,
    createdAt: new Date().toISOString(),
  };
  state = { ...state, cases: [newCase, ...state.cases] };
  emit();
  return newCase;
}

export function updateCase(bagId: string, patch: Partial<BaggageCase>) {
  state = {
    ...state,
    cases: state.cases.map((c) => (c.bagId === bagId ? { ...c, ...patch } : c)),
  };
  emit();
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

export function updateDelivery(deliveryId: string, patch: Partial<Delivery>) {
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

export { driverPool };
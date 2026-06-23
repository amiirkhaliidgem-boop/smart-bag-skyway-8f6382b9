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
  | "Out For Delivery"
  | "Delivered";

export type OtpStatus = "Pending" | "Sent" | "Verified" | "Failed";

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
  status: DeliveryStatus;
  driver: string;
  eta: string;
  otpStatus: OtpStatus;
  otpCode: string;
}

interface State {
  cases: BaggageCase[];
  deliveries: Delivery[];
}

const STORAGE_KEY = "sbe-state-v2";

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
    status: "Out For Delivery",
    driver: "Ahmed Mostafa",
    eta: "2026-06-23T19:30:00Z",
    otpStatus: "Sent",
    otpCode: "481923",
  },
  {
    deliveryId: "DEL-50013",
    bagId: "BAG-100232",
    passengerName: "Tarek Abdelrahman",
    address: "27 El-Nasr St, Nasr City, Cairo",
    status: "Assigned",
    driver: "Karim El-Sayed",
    eta: "2026-06-23T21:00:00Z",
    otpStatus: "Pending",
    otpCode: "302145",
  },
  {
    deliveryId: "DEL-50014",
    bagId: "BAG-100238",
    passengerName: "Omar Khaled",
    address: "8 Mohamed Mazhar, Zamalek, Cairo",
    status: "Pending",
    driver: "—",
    eta: "2026-06-24T10:00:00Z",
    otpStatus: "Pending",
    otpCode: "775612",
  },
  {
    deliveryId: "DEL-50011",
    bagId: "BAG-100231",
    passengerName: "Mariam Hossam",
    address: "55 El-Tahrir, Dokki, Giza",
    status: "Delivered",
    driver: "Youssef Hassan",
    eta: "2026-06-19T16:40:00Z",
    otpStatus: "Verified",
    otpCode: "910044",
  },
];

let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") {
    return { cases: seedCases, deliveries: seedDeliveries };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {}
  return { cases: seedCases, deliveries: seedDeliveries };
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
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector({ cases: seedCases, deliveries: seedDeliveries }),
  );
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

export { driverPool };
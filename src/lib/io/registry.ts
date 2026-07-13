import {
  addCase,
  getState,
  type BaggageCase,
  type CaseStatus,
} from "@/lib/store";
import type { DatasetSchema, FieldDef } from "./types";

// Priority mirrors delivery Priority type but decoupled here to keep the
// framework independent of consumer types.
const PRIORITY_VALUES = ["Low", "Normal", "High", "VIP"] as const;
const CASE_STATUS_VALUES: CaseStatus[] = [
  "Missing",
  "Located",
  "Stored",
  "Ready For Delivery",
  "Out For Delivery",
  "Delivered",
];

// ---------------- Lost & Found ----------------
const lostFoundFields: FieldDef[] = [
  { key: "pirNumber", label: "PIR Number", type: "string", required: true, unique: true, example: "CAIMS12045" },
  { key: "passengerFirstName", label: "Passenger First Name", type: "string", required: true, example: "Mariam" },
  { key: "passengerLastName", label: "Passenger Last Name", type: "string", required: true, example: "Hossam" },
  { key: "contact", label: "Mobile Number", type: "phone", required: true, example: "+20 100 234 5512" },
  { key: "email", label: "Email", type: "email", example: "passenger@example.com" },
  { key: "airline", label: "Airline", type: "airlineCode", required: true, example: "MS" },
  { key: "flightNumber", label: "Flight Number", type: "string", required: true, example: "MS985" },
  { key: "flightDate", label: "Flight Date", type: "date", required: true, example: "2026-06-18" },
  { key: "originAirport", label: "Origin Airport", type: "airportCode", example: "JFK" },
  { key: "destinationAirport", label: "Destination Airport", type: "airportCode", example: "CAI" },
  { key: "bagTagNumber", label: "Bag Tag Number", type: "string", required: true, unique: true, example: "MS548921" },
  { key: "numberOfBags", label: "Number Of Bags", type: "integer", example: "1" },
  { key: "bagColor", label: "Bag Color", type: "string", example: "Black" },
  { key: "bagType", label: "Bag Type", type: "string", example: "Hardshell" },
  { key: "deliveryRequired", label: "Delivery Required", type: "boolean", example: "true" },
  { key: "deliveryAddress", label: "Delivery Address", type: "string", example: "14 Road 9, Maadi" },
  { key: "city", label: "City", type: "string", example: "Cairo" },
  { key: "country", label: "Country", type: "string", example: "Egypt" },
  { key: "priority", label: "Priority", type: "enum", enumValues: PRIORITY_VALUES, example: "Normal" },
  { key: "currentStatus", label: "Current Status", type: "enum", enumValues: CASE_STATUS_VALUES, example: "Missing" },
  { key: "remarks", label: "Remarks", type: "string", example: "Silver Delsey cabin trolley" },
];

export const lostFoundSchema: DatasetSchema<BaggageCase> = {
  id: "lost-found",
  label: "Lost & Found",
  description: "PIR baggage cases — passenger, flight, tag, and status.",
  templateVersion: "1.0",
  fields: lostFoundFields,
  read: () => getState().cases,
  apply: (rows) => {
    const ids: string[] = [];
    let created = 0;
    for (const raw of rows as Record<string, unknown>[]) {
      const first = String(raw.passengerFirstName ?? "").trim();
      const last = String(raw.passengerLastName ?? "").trim();
      const description = [raw.bagColor, raw.bagType, raw.remarks]
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
        .join(" — ");
      const c = addCase({
        passengerName: `${first} ${last}`.trim(),
        flightNumber: String(raw.flightNumber ?? ""),
        pirNumber: String(raw.pirNumber ?? ""),
        bagTagNumber: String(raw.bagTagNumber ?? ""),
        arrivalDate: String(raw.flightDate ?? new Date().toISOString().slice(0, 10)),
        contact: String(raw.contact ?? ""),
        email: String(raw.email ?? ""),
        description,
      });
      ids.push(c.bagId);
      created++;
    }
    return { created, updated: 0, skipped: 0, ids };
  },
};

// ---------------- Read-only / export-first datasets ----------------
// Import for these will be wired in later phases via `apply`.
function readOnly<T>(
  id: string,
  label: string,
  description: string,
  fields: FieldDef[],
  read: () => T[],
): DatasetSchema<T> {
  return {
    id,
    label,
    description,
    templateVersion: "1.0",
    fields,
    read,
    apply: () => ({ created: 0, updated: 0, skipped: 0, ids: [] }),
  };
}

export const deliverySchema = readOnly(
  "delivery",
  "Delivery Management",
  "Home delivery orders — passenger, driver, ETA, OTP.",
  [
    { key: "deliveryId", label: "Delivery ID", type: "string", required: true, unique: true, example: "DEL-50012" },
    { key: "bagId", label: "Bag ID", type: "string", required: true, example: "BAG-100234" },
    { key: "passengerName", label: "Passenger Name", type: "string", required: true },
    { key: "pirNumber", label: "PIR Number", type: "string", required: true },
    { key: "mobile", label: "Mobile", type: "phone", required: true },
    { key: "address", label: "Address", type: "string", required: true },
    { key: "priority", label: "Priority", type: "enum", enumValues: PRIORITY_VALUES },
    { key: "driver", label: "Driver", type: "string" },
    { key: "eta", label: "ETA", type: "datetime" },
    { key: "status", label: "Status", type: "string" },
    { key: "otpStatus", label: "OTP Status", type: "string" },
  ],
  () => getState().deliveries as unknown[] as Record<string, unknown>[],
);

export const feedbackSchema = readOnly(
  "feedback",
  "Feedback",
  "Passenger feedback with ratings and comments.",
  [
    { key: "id", label: "Feedback ID", type: "string", required: true, unique: true },
    { key: "bagId", label: "Bag ID", type: "string", required: true },
    { key: "passengerName", label: "Passenger", type: "string", required: true },
    { key: "rating", label: "Rating", type: "integer", required: true },
    { key: "resolved", label: "Resolved", type: "boolean" },
    { key: "comments", label: "Comments", type: "string" },
    { key: "at", label: "Submitted At", type: "datetime" },
  ],
  () => getState().feedback as unknown[] as Record<string, unknown>[],
);

export const qualitySchema = readOnly(
  "quality",
  "Quality Incidents",
  "Operational quality incidents raised across the workflow.",
  [
    { key: "id", label: "Incident ID", type: "string", required: true, unique: true },
    { key: "bagId", label: "Bag ID", type: "string" },
    { key: "deliveryId", label: "Delivery ID", type: "string" },
    { key: "passengerName", label: "Passenger", type: "string" },
    { key: "driver", label: "Driver", type: "string" },
    { key: "category", label: "Category", type: "string", required: true },
    { key: "severity", label: "Severity", type: "string" },
    { key: "status", label: "Status", type: "string" },
    { key: "description", label: "Description", type: "string" },
    { key: "at", label: "Reported At", type: "datetime" },
  ],
  () => getState().qualityIncidents as unknown[] as Record<string, unknown>[],
);

export const storageSchema = readOnly(
  "storage",
  "Storage Control",
  "Bags currently stored across zones/shelves.",
  [
    { key: "bagId", label: "Bag ID", type: "string", required: true, unique: true },
    { key: "passengerName", label: "Passenger", type: "string" },
    { key: "pirNumber", label: "PIR Number", type: "string" },
    { key: "zone", label: "Zone", type: "string" },
    { key: "shelf", label: "Shelf", type: "string" },
    { key: "position", label: "Position", type: "string" },
    { key: "status", label: "Status", type: "string" },
  ],
  () =>
    getState()
      .cases.filter((c) => c.storage)
      .map((c) => ({
        bagId: c.bagId,
        passengerName: c.passengerName,
        pirNumber: c.pirNumber,
        zone: c.storage?.zone ?? "",
        shelf: c.storage?.shelf ?? "",
        position: c.storage?.position ?? "",
        status: c.status,
      })),
);

export const contactSchema = readOnly(
  "contact-center",
  "Contact Center",
  "Call log history across passenger touchpoints.",
  [
    { key: "id", label: "Call ID", type: "string", required: true, unique: true },
    { key: "passengerName", label: "Passenger", type: "string", required: true },
    { key: "phone", label: "Phone", type: "phone" },
    { key: "pirNumber", label: "PIR Number", type: "string" },
    { key: "agent", label: "Agent", type: "string" },
    { key: "direction", label: "Direction", type: "string" },
    { key: "durationSec", label: "Duration (sec)", type: "integer" },
    { key: "notes", label: "Notes", type: "string" },
    { key: "at", label: "Timestamp", type: "datetime" },
  ],
  () => getState().callLogs as unknown[] as Record<string, unknown>[],
);

export const driverSchema = readOnly(
  "driver-portal",
  "Driver Portal",
  "Deliveries currently assigned to drivers.",
  deliverySchema.fields,
  () =>
    (getState().deliveries as unknown[] as Record<string, unknown>[]).filter(
      (d) => d.driver && d.driver !== "—",
    ),
);

export const passengerTrackingSchema = readOnly(
  "passenger-tracking",
  "Passenger Tracking",
  "Live tracked deliveries with tokenised passenger portal.",
  [
    { key: "deliveryId", label: "Delivery ID", type: "string", required: true, unique: true },
    { key: "status", label: "Workflow Status", type: "string", required: true },
    { key: "bagId", label: "Bag ID", type: "string" },
    { key: "token", label: "Tracking Token", type: "string" },
  ],
  () => getState().workflow as unknown[] as Record<string, unknown>[],
);

import { useAdminStore } from "@/lib/admin/data";
import type { AdminState } from "@/lib/admin/data";

// The admin store isn't hydrated via getState; grab a stable read via the
// same store internals through the exported hook's snapshot.
function adminSnapshot(): AdminState {
  // useAdminStore is a hook, but the underlying `state` isn't exported.
  // We rely on the framework only calling read() at export time, from
  // components. As a pragmatic bridge, we access an internal accessor
  // provided by the admin module.
  return (globalThis as { __adminState__?: AdminState }).__adminState__ ??
    (useAdminStore as unknown as { getSnapshot?: () => AdminState }).getSnapshot?.() ?? {
      users: [],
      departments: [],
      stations: [],
      teams: [],
      activity: [],
    };
}

export const usersSchema = readOnly(
  "users",
  "Users",
  "Enterprise directory of ground-handling personnel.",
  [
    { key: "id", label: "Employee ID", type: "string", required: true, unique: true },
    { key: "fullName", label: "Full Name", type: "string", required: true },
    { key: "email", label: "Email", type: "email", required: true, unique: true },
    { key: "mobile", label: "Mobile", type: "phone" },
    { key: "department", label: "Department", type: "string", required: true },
    { key: "position", label: "Position", type: "string" },
    { key: "station", label: "Station", type: "string", required: true },
    { key: "role", label: "Role", type: "string", required: true },
    { key: "status", label: "Status", type: "string" },
  ],
  () => adminSnapshot().users as unknown[] as Record<string, unknown>[],
);

export const departmentsSchema = readOnly(
  "departments",
  "Departments",
  "Ground handling departments.",
  [
    { key: "id", label: "Department ID", type: "string", required: true, unique: true },
    { key: "name", label: "Name", type: "string", required: true },
    { key: "head", label: "Head", type: "string" },
    { key: "description", label: "Description", type: "string" },
  ],
  () => adminSnapshot().departments as unknown[] as Record<string, unknown>[],
);

export const stationsSchema = readOnly(
  "stations",
  "Stations",
  "Airport stations covered by the ecosystem.",
  [
    { key: "id", label: "Station ID", type: "string", required: true, unique: true },
    { key: "code", label: "IATA Code", type: "airportCode", required: true },
    { key: "name", label: "Name", type: "string", required: true },
    { key: "city", label: "City", type: "string" },
    { key: "country", label: "Country", type: "string" },
    { key: "active", label: "Active", type: "boolean" },
  ],
  () => adminSnapshot().stations as unknown[] as Record<string, unknown>[],
);

export const teamsSchema = readOnly(
  "teams",
  "Teams",
  "Operational teams grouped by department and station.",
  [
    { key: "id", label: "Team ID", type: "string", required: true, unique: true },
    { key: "name", label: "Name", type: "string", required: true },
    { key: "department", label: "Department", type: "string" },
    { key: "station", label: "Station", type: "string" },
    { key: "lead", label: "Lead", type: "string" },
    { key: "memberCount", label: "Members", type: "integer" },
  ],
  () => adminSnapshot().teams as unknown[] as Record<string, unknown>[],
);

export const reportsSchema = readOnly(
  "reports",
  "Reports",
  "Consolidated reporting snapshot across the ecosystem.",
  lostFoundFields.slice(0, 10),
  () => getState().cases as unknown[] as Record<string, unknown>[],
);

export const IO_REGISTRY: DatasetSchema<Record<string, unknown>>[] = [
  lostFoundSchema as unknown as DatasetSchema<Record<string, unknown>>,
  storageSchema,
  deliverySchema,
  driverSchema,
  passengerTrackingSchema,
  contactSchema,
  feedbackSchema,
  qualitySchema,
  reportsSchema,
  usersSchema,
  departmentsSchema,
  stationsSchema,
  teamsSchema,
];

export function getSchema(id: string) {
  return IO_REGISTRY.find((s) => s.id === id);
}
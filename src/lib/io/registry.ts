import { addCase, updateCase, getState, type CaseStatus } from "@/lib/store";
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
// Real airport ops: mandatory fields only. Everything else is optional and
// completed later by an agent. We never reject the whole case because a
// passport number or delivery address is missing at import time.
const lostFoundFields: FieldDef[] = [
  { key: "pirNumber", label: "PIR Number", type: "string", required: true, example: "CAIMS12045" },
  { key: "passengerFirstName", label: "Passenger First Name", type: "string", required: true, example: "Mariam" },
  { key: "passengerLastName", label: "Passenger Last Name", type: "string", required: true, example: "Hossam" },
  { key: "contact", label: "Mobile Number", type: "phone", required: true, example: "+20 100 234 5512" },
  { key: "email", label: "Email", type: "email", example: "passenger@example.com" },
  { key: "airline", label: "Airline", type: "airlineCode", required: true, example: "MS" },
  { key: "flightNumber", label: "Flight Number", type: "string", required: true, example: "MS985" },
  { key: "flightDate", label: "Flight Date", type: "date", required: true, example: "2026-06-18" },
  { key: "originAirport", label: "Origin Airport", type: "airportCode", required: true, example: "JFK" },
  { key: "destinationAirport", label: "Destination Airport", type: "airportCode", required: true, example: "CAI" },
  { key: "bagTagNumber", label: "Bag Tag Number", type: "string", required: true, example: "MS548921" },
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

// Optional fields the operator can complete after import. Missing values
// generate warnings only — never a rejection.
const LF_OPTIONAL_FIELDS: { key: string; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "numberOfBags", label: "Number of Bags" },
  { key: "bagColor", label: "Bag Color" },
  { key: "bagType", label: "Bag Type" },
  { key: "deliveryAddress", label: "Delivery Address" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "priority", label: "Priority" },
  { key: "remarks", label: "Remarks" },
];

function isBlank(v: unknown) {
  return v === undefined || v === null || String(v).trim() === "";
}

export const lostFoundSchema: DatasetSchema = {
  id: "lost-found",
  label: "Lost & Found",
  description: "PIR baggage cases — passenger, flight, tag, and status.",
  templateVersion: "1.1",
  fields: lostFoundFields,
  read: () => getState().cases as unknown as Record<string, unknown>[],
  apply: (rows: Record<string, unknown>[]) => {
    const ids: string[] = [];
    let created = 0;
    let updated = 0;
    let warnings = 0;
    const existing = getState().cases;
    for (const raw of rows) {
      const first = String(raw.passengerFirstName ?? "").trim();
      const last = String(raw.passengerLastName ?? "").trim();
      const description = [raw.bagColor, raw.bagType, raw.remarks]
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
        .join(" — ");
      const missingFields = LF_OPTIONAL_FIELDS
        .filter((f) => isBlank(raw[f.key]))
        .map((f) => f.label);
      const incomplete = missingFields.length > 0;
      if (incomplete) warnings++;

      const pirNumber = String(raw.pirNumber ?? "").trim();
      const dup = existing.find((c) => c.pirNumber && c.pirNumber === pirNumber);
      if (dup) {
        // Duplicate PIR → update existing case in place (never reject).
        updateCase(dup.bagId, {
          passengerName: `${first} ${last}`.trim() || dup.passengerName,
          flightNumber: String(raw.flightNumber ?? dup.flightNumber),
          bagTagNumber: String(raw.bagTagNumber ?? dup.bagTagNumber),
          arrivalDate: String(raw.flightDate ?? dup.arrivalDate),
          contact: String(raw.contact ?? dup.contact),
          email: String(raw.email ?? dup.email),
          description: description || dup.description,
          incomplete,
          missingFields: incomplete ? missingFields : undefined,
        });
        ids.push(dup.bagId);
        updated++;
        continue;
      }

      const c = addCase({
        passengerName: `${first} ${last}`.trim(),
        flightNumber: String(raw.flightNumber ?? ""),
        pirNumber,
        bagTagNumber: String(raw.bagTagNumber ?? ""),
        arrivalDate: String(raw.flightDate ?? new Date().toISOString().slice(0, 10)),
        contact: String(raw.contact ?? ""),
        email: String(raw.email ?? ""),
        description,
      });
      if (incomplete) {
        updateCase(c.bagId, { incomplete: true, missingFields });
      }
      ids.push(c.bagId);
      created++;
    }
    return { created, updated, skipped: 0, warnings, rejected: 0, ids };
  },
};

// ---------------- Read-only / export-first datasets ----------------
// Import for these will be wired in later phases via `apply`.
function readOnly(
  id: string,
  label: string,
  description: string,
  fields: FieldDef[],
  read: () => Record<string, unknown>[],
): DatasetSchema {
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

import { getAdminState } from "@/lib/admin/data";
function adminSnapshot() { return getAdminState(); }

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

export const IO_REGISTRY: DatasetSchema[] = [
  lostFoundSchema,
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
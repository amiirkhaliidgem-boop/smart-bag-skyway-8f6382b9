import * as XLSX from "xlsx";
import type { BaggageCase, Delivery } from "@/lib/store";
import type { SlaRegion } from "@/lib/settings/types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDate(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtDateTime(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Delivery_Dispatch_YYYY-MM-DD_HH-mm.xlsx (local time). */
function fileName() {
  const d = new Date();
  return `Delivery_Dispatch_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.xlsx`;
}

/** Operational reference: PIR number, falling back to the case/bag number. */
function caseRef(d: Delivery, c?: BaggageCase) {
  return (d.pirNumber || c?.pirNumber || "").trim() || c?.bagId || d.bagId || "";
}

/** All bag tags of the case in one cell, comma separated. One delivery = one row. */
function bagTags(c?: BaggageCase) {
  if (!c) return "";
  const tags = c.baggage?.bagTags?.length ? c.baggage.bagTags : c.bagTagNumber ? [c.bagTagNumber] : [];
  return tags.filter(Boolean).join(", ");
}

interface Ctx {
  cases: BaggageCase[];
  regions: SlaRegion[];
}

const COLUMNS: {
  header: string;
  get: (d: Delivery, c: BaggageCase | undefined, ctx: Ctx) => string | number;
}[] = [
  { header: "Delivery Number", get: (d) => d.deliveryId ?? "" },
  { header: "PIR / Case Reference", get: (d, c) => caseRef(d, c) },
  { header: "Bag Tag", get: (_d, c) => bagTags(c) },
  { header: "Passenger Name", get: (d, c) => d.passengerName || c?.passengerName || "" },
  { header: "Airline", get: (_d, c) => c?.flight?.airline ?? "" },
  {
    header: "Region",
    get: (_d, c, ctx) => {
      const id = c?.delivery?.regionId;
      if (!id) return "";
      return ctx.regions.find((r) => r.id === id)?.name ?? "";
    },
  },
  { header: "Delivery Address", get: (d, c) => d.address || c?.delivery?.fullAddress || "" },
  { header: "Delivery Agent", get: (d) => (d.driver && d.driver !== "—" ? d.driver : "") },
  { header: "OTP Status", get: (d) => d.otpStatus ?? "" },
  { header: "Date", get: (d) => fmtDate(d.createdAt) },
  { header: "Accepted At", get: (d) => fmtDateTime(d.acceptedAt) },
  { header: "Collected At", get: (d) => fmtDateTime(d.collectedAt) },
  { header: "Delivered At", get: (d) => fmtDateTime(d.deliveredAt) },
  { header: "Priority", get: (d, c) => d.priority ?? c?.priority ?? "Normal" },
  { header: "Created At", get: (d) => fmtDateTime(d.createdAt) },
];

export function exportDeliveriesToXlsx(
  deliveries: Delivery[],
  cases: BaggageCase[],
  regions: SlaRegion[],
) {
  const ctx: Ctx = { cases, regions };
  const byBag = new Map(cases.map((c) => [c.bagId, c]));
  const headers = COLUMNS.map((c) => c.header);
  const rows = deliveries.map((d) => {
    const c = byBag.get(d.bagId);
    return COLUMNS.map((col) => col.get(d, c, ctx));
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  for (let i = 0; i < headers.length; i++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
    if (cell) cell.s = { font: { bold: true } };
  }

  ws["!cols"] = headers.map((h, i) => {
    let max = h.length;
    for (const r of rows) {
      const len = r[i] == null ? 0 : String(r[i]).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(max + 2, 60) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Delivery Dispatch");
  XLSX.writeFile(wb, fileName());
  return rows.length;
}
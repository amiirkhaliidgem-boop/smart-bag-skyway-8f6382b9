import * as XLSX from "xlsx";
import type { BaggageCase } from "@/lib/store";
import { deriveLfFromCase } from "@/lib/lost-found/statuses";

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

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function fullAddress(c: BaggageCase): string {
  const d = c.delivery;
  if (!d) return "";
  if (d.fullAddress) return d.fullAddress;
  return [d.building, d.street, d.district, d.city, d.governorate, d.country]
    .filter(Boolean)
    .join(", ");
}

const COLUMNS: { header: string; get: (c: BaggageCase) => string | number }[] = [
  { header: "PIR Number", get: (c) => c.pirNumber ?? "" },
  { header: "Bag ID", get: (c) => c.bagId ?? "" },
  {
    header: "Bag Tag",
    get: (c) => (c.baggage?.bagTags?.length ? c.baggage.bagTags.join(", ") : c.bagTagNumber ?? ""),
  },
  { header: "Passenger Name", get: (c) => c.passengerName ?? "" },
  { header: "Mobile", get: (c) => c.contact ?? "" },
  { header: "Airline", get: (c) => c.flight?.airline ?? "" },
  { header: "Flight Number", get: (c) => c.flightNumber ?? "" },
  { header: "Flight Date", get: (c) => fmtDate(c.arrivalDate) },
  { header: "Origin", get: (c) => c.flight?.originAirport ?? "" },
  { header: "Destination", get: (c) => c.flight?.destinationAirport ?? "" },
  { header: "Delivery Method", get: (c) => c.delivery?.method ?? "" },
  { header: "Current Status", get: (c) => deriveLfFromCase(c) },
  { header: "Assigned Officer", get: (c) => c.internal?.assignedOfficer ?? "" },
  { header: "Priority", get: (c) => c.priority ?? c.internal?.casePriority ?? "Normal" },
  { header: "Created Date", get: (c) => fmtDate(c.createdAt) },
  { header: "Last Updated", get: (c) => fmtDateTime(c.updatedAt ?? c.createdAt) },
  { header: "Delivery Address", get: (c) => fullAddress(c) },
  { header: "Number of Bags", get: (c) => c.baggage?.numberOfBags ?? "" },
  { header: "Bag Color", get: (c) => c.baggage?.color ?? "" },
  { header: "Bag Type", get: (c) => c.baggage?.type ?? "" },
  { header: "Remarks", get: (c) => c.description ?? c.internal?.internalNotes ?? "" },
];

export function exportCasesToXlsx(cases: BaggageCase[]) {
  const headers = COLUMNS.map((c) => c.header);
  const rows = cases.map((c) => COLUMNS.map((col) => col.get(c)));
  const aoa: (string | number)[][] = [headers, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Bold header row
  for (let i = 0; i < headers.length; i++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: i });
    const cell = ws[addr];
    if (cell) cell.s = { font: { bold: true } };
  }

  // Auto-size columns
  ws["!cols"] = headers.map((h, i) => {
    let max = h.length;
    for (const r of rows) {
      const v = r[i];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(max + 2, 60) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lost & Found");
  XLSX.writeFile(wb, `lost-found-${stamp()}.xlsx`);
}
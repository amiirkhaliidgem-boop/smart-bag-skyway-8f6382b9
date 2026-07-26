import * as XLSX from "xlsx";

export interface FeedbackRow {
  id: string;
  passengerName: string;
  pirNumber: string;
  deliveryId: string;
  driver: string;
  airline: string;
  flightNumber: string;
  station: string;
  bagId: string;
  rating: number;
  resolved: boolean;
  comments: string;
  at: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function fmtDateTime(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const COLUMNS: { header: string; get: (f: FeedbackRow) => string | number }[] = [
  { header: "Feedback ID", get: (f) => f.id },
  { header: "Passenger", get: (f) => f.passengerName },
  { header: "PIR Number", get: (f) => f.pirNumber },
  { header: "Delivery ID", get: (f) => f.deliveryId },
  { header: "Bag ID", get: (f) => f.bagId },
  { header: "Delivery Agent", get: (f) => f.driver },
  { header: "Airline", get: (f) => f.airline },
  { header: "Flight", get: (f) => f.flightNumber },
  { header: "Station", get: (f) => f.station },
  { header: "Rating", get: (f) => f.rating },
  { header: "Resolved", get: (f) => (f.resolved ? "Yes" : "No") },
  { header: "Comment", get: (f) => f.comments },
  { header: "Submitted", get: (f) => fmtDateTime(f.at) },
];

export function exportFeedbackToXlsx(rows: FeedbackRow[]) {
  const headers = COLUMNS.map((c) => c.header);
  const body = rows.map((r) => COLUMNS.map((c) => c.get(r)));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);

  for (let i = 0; i < headers.length; i++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
    if (cell) cell.s = { font: { bold: true } };
  }

  ws["!cols"] = headers.map((h, i) => {
    let max = h.length;
    for (const r of body) {
      const len = r[i] == null ? 0 : String(r[i]).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(max + 2, 60) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customer Feedback");
  XLSX.writeFile(wb, `customer-feedback-${stamp()}.xlsx`);
}

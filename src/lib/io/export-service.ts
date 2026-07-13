import { download, toCSV } from "./csv";
import type { DatasetSchema, ExportFormat, ExportOptions } from "./types";

function pickRows(schema: DatasetSchema, opts: ExportOptions) {
  if (opts.rows) return opts.rows;
  return schema.read() as Record<string, unknown>[];
}

function rowsToRecords(schema: DatasetSchema, rows: Record<string, unknown>[]) {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const f of schema.fields) {
      const v = r[f.key];
      out[f.label] = v === undefined || v === null ? "" : v;
    }
    return out;
  });
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function exportDataset(schema: DatasetSchema, opts: ExportOptions) {
  const rows = pickRows(schema, opts);
  const records = rowsToRecords(schema, rows);
  const headers = schema.fields.map((f) => f.label);
  const base = `${schema.id}-${opts.scope}-${stamp()}`;

  switch (opts.format) {
    case "csv": {
      download(`${base}.csv`, "text/csv", toCSV(headers, records));
      return { count: rows.length };
    }
    case "xls": {
      // SpreadsheetML 2003 — opens natively in Excel, Numbers, LibreOffice.
      const xml = buildXls(headers, records, schema.label);
      download(`${base}.xls`, "application/vnd.ms-excel", xml);
      return { count: rows.length };
    }
    case "pdf": {
      // Print-optimised HTML fallback (opens in a new tab → Save as PDF).
      if (typeof window !== "undefined") {
        const w = window.open("", "_blank");
        if (w) { w.document.write(buildPrintHtml(headers, records, schema.label)); w.document.close(); }
      }
      return { count: rows.length };
    }
    case "rest": {
      // Placeholder for future REST push — logs the request contract.
      // Real integration will POST { schemaId, records } to configured endpoint.
      console.info("[export.rest]", { schemaId: schema.id, count: rows.length });
      return { count: rows.length };
    }
  }
}

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildXls(headers: string[], rows: Record<string, unknown>[], title: string) {
  const head = headers.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join("");
  const body = rows
    .map((r) => `<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(String(r[h] ?? ""))}</Data></Cell>`).join("")}</Row>`) 
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(title).slice(0, 30)}"><Table><Row>${head}</Row>${body}</Table></Worksheet>
</Workbook>`;
}

function buildPrintHtml(headers: string[], rows: Record<string, unknown>[], title: string) {
  const th = headers.map((h) => `<th>${h}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${String(r[h] ?? "")}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;padding:24px;color:#0f172a}
h1{font-size:16px;margin:0 0 12px}table{border-collapse:collapse;width:100%;font-size:11px}
th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
th{background:#1e3a8a;color:#fff}</style></head><body>
<h1>${title} — IAB Smart Baggage Ecosystem</h1>
<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
<script>setTimeout(()=>window.print(),150)</script></body></html>`;
}

export function formatLabel(f: ExportFormat) {
  return { csv: "CSV", xls: "Excel", pdf: "PDF", rest: "REST API" }[f];
}
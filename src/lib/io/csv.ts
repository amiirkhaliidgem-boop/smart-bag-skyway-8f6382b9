// RFC-4180 compliant CSV parser/serializer. Handles quoted fields,
// embedded newlines, and CRLF line endings.

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, ""); // strip BOM
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && clean[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.some((c) => c !== "")) rows.push(cur);
        cur = [];
      } else field += ch;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); if (cur.some((c) => c !== "")) rows.push(cur); }
  const headers = (rows.shift() ?? []).map((h) => h.trim());
  const out: Record<string, string>[] = rows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
    return obj;
  });
  return { headers, rows: out };
}

function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\r\n");
}

export function download(filename: string, mime: string, content: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob(["\uFEFF" + content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
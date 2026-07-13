import { parseCSV } from "./csv";
import { validateField } from "./validation";
import { detectDuplicates } from "./duplicate";
import type {
  ApplyContext,
  ApplyResult,
  DatasetSchema,
  ParsedRow,
  ValidationReport,
} from "./types";

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function buildValidationReport(
  schema: DatasetSchema,
  fileName: string,
  text: string,
): ValidationReport {
  const { headers, rows: raw } = parseCSV(text);

  // Header mapping — accept label or key, case/space-insensitive.
  const headerToField: Record<string, string> = {};
  for (const f of schema.fields) {
    headerToField[normalizeHeader(f.label)] = f.key;
    headerToField[normalizeHeader(f.key)] = f.key;
  }
  const presentKeys = new Set<string>();
  const unknownColumns: string[] = [];
  for (const h of headers) {
    if (normalizeHeader(h) === normalizeHeader("Template Version")) continue;
    const k = headerToField[normalizeHeader(h)];
    if (k) presentKeys.add(k);
    else if (h) unknownColumns.push(h);
  }
  const missingColumns = schema.fields
    .filter((f) => f.required && !presentKeys.has(f.key))
    .map((f) => f.label);

  const parsed: ParsedRow[] = raw.map((rec, idx) => {
    const data: Record<string, unknown> = {};
    const issues: ParsedRow["issues"] = [];
    // Skip the template-version marker row if user kept the sample line
    // untouched (all values empty except Template Version).
    for (const f of schema.fields) {
      // Find matching header
      let value = "";
      for (const h of headers) {
        if (headerToField[normalizeHeader(h)] === f.key) { value = rec[h] ?? ""; break; }
      }
      const r = validateField(f, value, data);
      if (r.value !== undefined) data[f.key] = r.value;
      issues.push(...r.issues);
    }
    const rejected = missingColumns.length > 0 || issues.some((i) => i.level === "error");
    return { row: idx + 2, raw: rec, data, issues, rejected, duplicate: false };
  });

  if (!missingColumns.length) detectDuplicates(schema, parsed);

  const report: ValidationReport = {
    fileName,
    totalRows: parsed.length,
    acceptedRows: parsed.filter((r) => !r.rejected).length,
    rejectedRows: parsed.filter((r) => r.rejected).length,
    warningRows: parsed.filter((r) => !r.rejected && r.issues.some((i) => i.level === "warning")).length,
    duplicateRows: parsed.filter((r) => r.duplicate).length,
    missingColumns,
    unknownColumns,
    rows: parsed,
  };
  return report;
}

export function commitImport(
  schema: DatasetSchema,
  report: ValidationReport,
  ctx: ApplyContext,
): ApplyResult {
  const accepted = report.rows.filter((r) => !r.rejected).map((r) => r.data);
  const result = schema.apply(accepted as never, ctx);
  return result;
}
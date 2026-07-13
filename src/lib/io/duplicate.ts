import type { DatasetSchema, ParsedRow } from "./types";

export function detectDuplicates(
  schema: DatasetSchema,
  rows: ParsedRow[],
): void {
  const uniqueFields = schema.fields.filter((f) => f.unique);
  if (!uniqueFields.length) return;
  const existing: Record<string, Set<string>> = {};
  for (const f of uniqueFields) existing[f.key] = new Set();
  for (const rec of schema.read() as Record<string, unknown>[]) {
    for (const f of uniqueFields) {
      const v = rec[f.key];
      if (v !== undefined && v !== null && v !== "") existing[f.key].add(String(v));
    }
  }
  const seenInFile: Record<string, Set<string>> = {};
  for (const f of uniqueFields) seenInFile[f.key] = new Set();
  for (const row of rows) {
    for (const f of uniqueFields) {
      const v = row.data[f.key];
      if (v === undefined || v === null || v === "") continue;
      const key = String(v);
      if (existing[f.key].has(key)) {
        row.duplicate = true;
        row.issues.push({ field: f.key, level: "error", message: `Duplicate ${f.label}: already exists in system.` });
      } else if (seenInFile[f.key].has(key)) {
        row.duplicate = true;
        row.issues.push({ field: f.key, level: "error", message: `Duplicate ${f.label}: appears twice in file.` });
      } else {
        seenInFile[f.key].add(key);
      }
    }
    if (row.issues.some((i) => i.level === "error")) row.rejected = true;
  }
}
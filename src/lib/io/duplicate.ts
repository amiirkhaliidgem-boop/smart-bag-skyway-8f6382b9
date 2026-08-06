import type { DatasetSchema, FieldDef, ParsedRow } from "./types";

/** Splits a cell into the individual values a unique field occupies. */
function cellValues(field: FieldDef, value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  const raw = String(value);
  const parts = field.multiValueSeparator
    ? raw.split(field.multiValueSeparator)
    : [raw];
  return parts.map((p) => p.trim()).filter(Boolean);
}

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
      const values = f.existingValues ? f.existingValues(rec) : cellValues(f, rec[f.key]);
      for (const v of values) if (v) existing[f.key].add(v);
    }
  }
  const seenInFile: Record<string, Set<string>> = {};
  for (const f of uniqueFields) seenInFile[f.key] = new Set();
  for (const row of rows) {
    for (const f of uniqueFields) {
      const values = cellValues(f, row.data[f.key]);
      const withinCell = new Set<string>();
      for (const key of values) {
        if (withinCell.has(key)) {
          row.duplicate = true;
          row.issues.push({ field: f.key, level: "error", message: `Duplicate ${f.label} "${key}": repeated in the same cell.` });
        } else if (existing[f.key].has(key)) {
          row.duplicate = true;
          row.issues.push({ field: f.key, level: "error", message: `Duplicate ${f.label} "${key}": already exists in system.` });
        } else if (seenInFile[f.key].has(key)) {
          row.duplicate = true;
          row.issues.push({ field: f.key, level: "error", message: `Duplicate ${f.label} "${key}": appears twice in file.` });
        } else {
          seenInFile[f.key].add(key);
        }
        withinCell.add(key);
      }
    }
    if (row.issues.some((i) => i.level === "error")) row.rejected = true;
  }
}
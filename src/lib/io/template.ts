import { download, toCSV } from "./csv";
import type { DatasetSchema } from "./types";

export function generateTemplate(schema: DatasetSchema): string {
  // No "Template Version" column — operators fill a clean sheet of real
  // operational columns only.
  const headers = schema.fields.map((f) => f.label);
  const sample: Record<string, unknown> = {};
  for (const f of schema.fields) sample[f.label] = f.example ?? "";
  return toCSV(headers, [sample]);
}

export function downloadTemplate(schema: DatasetSchema) {
  const csv = generateTemplate(schema);
  download(`${schema.id}-import-template-v${schema.templateVersion}.csv`, "text/csv", csv);
}
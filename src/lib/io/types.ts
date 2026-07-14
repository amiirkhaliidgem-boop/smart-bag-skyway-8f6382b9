// Enterprise Data Import / Export Framework — Core Types.
// This module is intentionally domain-agnostic. Every business module
// (Lost & Found, Storage, Delivery, Feedback, Quality, Admin…) plugs in
// by registering a DatasetSchema. The engines never hard-code fields.

export type FieldType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "email"
  | "phone"
  | "enum"
  | "airportCode"
  | "airlineCode";

export interface FieldDef {
  /** Canonical field key (matches record property). */
  key: string;
  /** Human-readable header used in templates and exports. */
  label: string;
  type: FieldType;
  required?: boolean;
  /** Enum values (for type === "enum"). */
  enumValues?: readonly string[];
  /** Example value shown in the CSV template comment row. */
  example?: string;
  /** Optional custom validator returning an error message or null. */
  validate?: (value: unknown, row: Record<string, unknown>) => string | null;
  /** Optional value transformer applied after parsing. */
  transform?: (value: string) => unknown;
  /** Marks a field that must be unique across imported data + existing store. */
  unique?: boolean;
}

export interface DatasetSchema {
  /** Stable module id (e.g. "lost-found"). */
  id: string;
  /** Display name shown in the Import/Export Center. */
  label: string;
  /** Short description shown next to the module card. */
  description: string;
  /** Template file version — bumped when field shape changes. */
  templateVersion: string;
  /** Field definitions. Order defines template + export column order. */
  fields: FieldDef[];
  /** Reads current records from the store (for export + duplicate detection). */
  read: () => Record<string, unknown>[];
  /** Applies validated rows to the store. MUST route through workflow/audit
   *  when the module has workflow semantics. */
  apply: (rows: Record<string, unknown>[], ctx: ApplyContext) => ApplyResult;
}

export interface ApplyContext {
  actor: string;
  fileName: string;
}

export interface ApplyResult {
  created: number;
  updated: number;
  skipped: number;
  /** Records imported but flagged as incomplete (missing optional fields). */
  warnings?: number;
  /** Records rejected during commit (e.g. mandatory operational fields
   *  missing) even though the row passed CSV parsing. */
  rejected?: number;
  ids: string[];
}

export type IssueLevel = "error" | "warning";

export interface RowIssue {
  field?: string;
  level: IssueLevel;
  message: string;
}

export interface ParsedRow {
  /** 1-based row number in the source file (excluding header). */
  row: number;
  raw: Record<string, string>;
  data: Record<string, unknown>;
  issues: RowIssue[];
  /** True when at least one issue is an error → row will be skipped. */
  rejected: boolean;
  /** True when this row duplicates an existing record or another row. */
  duplicate: boolean;
}

export interface ValidationReport {
  fileName: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  warningRows: number;
  duplicateRows: number;
  missingColumns: string[];
  unknownColumns: string[];
  rows: ParsedRow[];
}

export type ExportFormat = "csv" | "xls" | "pdf" | "rest";

export interface ExportOptions {
  scope: "all" | "filtered" | "selected" | "page";
  format: ExportFormat;
  /** Optional pre-filtered rows (from the calling module). */
  rows?: Record<string, unknown>[];
}
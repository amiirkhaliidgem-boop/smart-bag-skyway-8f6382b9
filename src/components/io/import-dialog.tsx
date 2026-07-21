import { useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { buildValidationReport, commitImport } from "@/lib/io/import-service";
import { downloadTemplate } from "@/lib/io/template";
import { logIoAudit } from "@/lib/store";
import { download, toCSV } from "@/lib/io/csv";
import type { DatasetSchema, ParsedRow, ValidationReport } from "@/lib/io/types";

type Phase = "idle" | "reading" | "preview" | "importing" | "done";

interface Props {
  schema: DatasetSchema;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actor?: string;
  onImported?: (result: { created: number; ids: string[] }) => void;
}

export function ImportDialog({ schema, open, onOpenChange, actor = "Operator", onImported }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [result, setResult] = useState<
    { created: number; updated: number; skipped: number; warnings: number; ids: string[] } | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase("idle"); setProgress(0); setFile(null); setReport(null); setResult(null);
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const readFile = async (f: File) => {
    setFile(f);
    setPhase("reading");
    for (let p = 10; p <= 80; p += 10) {
      await new Promise((r) => setTimeout(r, 40));
      setProgress(p);
    }
    const text = await f.text();
    const rep = buildValidationReport(schema, f.name, text);
    setProgress(100);
    setReport(rep);
    setPhase("preview");
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) {
      toast.error("Unsupported file", { description: "Please upload a .csv file." });
      return;
    }
    void readFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void readFile(f);
  };

  const runImport = async () => {
    if (!report) return;
    setPhase("importing");
    setProgress(0);
    for (let p = 15; p <= 85; p += 10) {
      await new Promise((r) => setTimeout(r, 60));
      setProgress(p);
    }
    const res = commitImport(schema, report, { actor, fileName: report.fileName });
    logIoAudit({
      action: "import.commit",
      actor,
      moduleId: schema.id,
      moduleLabel: schema.label,
      fileName: report.fileName,
      totalRows: report.totalRows,
      accepted: report.acceptedRows,
      rejected: report.rejectedRows,
      warnings: report.warningRows,
      duplicates: report.duplicateRows,
    });
    setProgress(100);
    setResult({
      created: res.created,
      updated: res.updated ?? 0,
      skipped: res.skipped ?? 0,
      warnings: res.warnings ?? 0,
      ids: res.ids,
    });
    setPhase("done");
    onImported?.({ created: res.created, ids: res.ids });
    const total = res.created + (res.updated ?? 0);
    toast.success(`${schema.label}: ${total} record(s) processed`, {
      description: `${res.created} created · ${res.updated ?? 0} updated`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Import — {schema.label}
          </DialogTitle>
          <DialogDescription>
            Enterprise CSV import · validation, duplicate detection, preview, and audited commit.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <DropZone
            onPick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onTemplate={() => downloadTemplate(schema)}
          />
        )}

        {(phase === "reading" || phase === "importing") && (
          <div className="py-10 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="text-sm">
                <p className="font-medium">
                  {phase === "reading" ? "Reading & validating file…" : "Committing to workflow engine…"}
                </p>
                <p className="text-xs text-muted-foreground">{file?.name}</p>
              </div>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {phase === "preview" && report && (
          <PreviewView schema={schema} report={report} />
        )}

        {phase === "done" && result && report && (
          <SummaryView schema={schema} report={report} result={result} />
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onPick}
        />

        <DialogFooter>
          {phase === "idle" && (
            <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          )}
          {phase === "preview" && report && (
            <>
              <Button variant="outline" onClick={reset}>Choose another file</Button>
              {report.rejectedRows > 0 && (
                <Button variant="outline" className="gap-2" onClick={() => downloadErrorReport(report)}>
                  <Download className="h-4 w-4" /> Error Report
                </Button>
              )}
              <Button
                onClick={runImport}
                disabled={report.missingColumns.length > 0 || report.acceptedRows === 0}
              >
                Import {report.acceptedRows} Case(s)
              </Button>
            </>
          )}
          {phase === "done" && (
            <>
              {report && report.rejectedRows > 0 && (
                <Button variant="outline" className="gap-2" onClick={() => downloadErrorReport(report)}>
                  <Download className="h-4 w-4" /> Error Report
                </Button>
              )}
              <Button onClick={() => close(false)}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function downloadErrorReport(report: ValidationReport) {
  const failed = report.rows.filter((r) => r.rejected);
  const headers = ["Row", "Issues", ...Object.keys(failed[0]?.raw ?? {})];
  const rows = failed.map((r) => ({
    Row: r.row,
    Issues: r.issues.map((i) => `[${i.level}] ${i.message}`).join(" | "),
    ...r.raw,
  }));
  const csv = toCSV(headers, rows);
  const base = report.fileName.replace(/\.[^.]+$/, "");
  download(`${base}-errors.csv`, "text/csv", csv);
}

function DropZone({ onPick, onDrop, onTemplate }: { onPick: () => void; onDrop: (e: React.DragEvent) => void; onTemplate: () => void }) {
  return (
    <div className="space-y-4 py-2">
      <div
        onClick={onPick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center mb-3">
          <Upload className="h-6 w-6" />
        </div>
        <p className="font-semibold">Drop CSV file here, or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Supports .csv files up to 20MB. UTF-8 encoded.</p>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/40">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>Need the enterprise template?</span>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={onTemplate}>
          <Download className="h-4 w-4" /> Download Template
        </Button>
      </div>
    </div>
  );
}

function PreviewView({ schema, report }: { schema: DatasetSchema; report: ValidationReport }) {
  const cards = [
    { label: "Total Rows", value: report.totalRows, tone: "" as const },
    { label: "Accepted", value: report.acceptedRows, tone: "ok" as const },
    { label: "Warnings", value: report.warningRows, tone: "warn" as const },
    { label: "Rejected", value: report.rejectedRows, tone: "err" as const },
    { label: "Duplicates", value: report.duplicateRows, tone: "err" as const },
  ];

  const previewRows = useMemo(() => report.rows.slice(0, 25), [report]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {cards.map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-lg border p-3",
              c.tone === "ok" && "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
              c.tone === "warn" && "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
              c.tone === "err" && "border-rose-300 bg-rose-50 dark:bg-rose-950/30",
            )}
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      {(report.missingColumns.length > 0 || report.unknownColumns.length > 0) && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm space-y-1">
          {report.missingColumns.length > 0 && (
            <p><AlertTriangle className="inline h-4 w-4 mr-1 text-rose-600" />
              <strong>Missing required columns:</strong> {report.missingColumns.join(", ")}
            </p>
          )}
          {report.unknownColumns.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Unknown columns ignored: {report.unknownColumns.join(", ")}
            </p>
          )}
        </div>
      )}

      <ScrollArea className="h-72 rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="text-left px-2 py-2 w-16">Row</th>
              <th className="text-left px-2 py-2 w-24">Status</th>
              {schema.fields.slice(0, 6).map((f) => (
                <th key={f.key} className="text-left px-2 py-2">{f.label}</th>
              ))}
              <th className="text-left px-2 py-2">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {previewRows.map((r) => (
              <PreviewRow key={r.row} row={r} schema={schema} />
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {report.rows.length > previewRows.length && (
        <p className="text-xs text-muted-foreground">
          Showing first {previewRows.length} of {report.rows.length} rows.
        </p>
      )}
    </div>
  );
}

function PreviewRow({ row, schema }: { row: ParsedRow; schema: DatasetSchema }) {
  const tone = row.rejected ? "bg-rose-50 dark:bg-rose-950/20" : row.issues.some((i) => i.level === "warning") ? "bg-amber-50 dark:bg-amber-950/20" : "";
  return (
    <tr className={tone}>
      <td className="px-2 py-1.5 font-mono text-muted-foreground">{row.row}</td>
      <td className="px-2 py-1.5">
        {row.rejected ? (
          <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>
        ) : row.issues.some((i) => i.level === "warning") ? (
          <Badge className="bg-amber-500 text-white gap-1"><AlertTriangle className="h-3 w-3" /> Warning</Badge>
        ) : (
          <Badge className="bg-emerald-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Ready</Badge>
        )}
      </td>
      {schema.fields.slice(0, 6).map((f) => (
        <td key={f.key} className="px-2 py-1.5 truncate max-w-[160px]">
          {String(row.data[f.key] ?? row.raw[f.label] ?? "—")}
        </td>
      ))}
      <td className="px-2 py-1.5 text-xs">
        {row.issues.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="space-y-0.5">
            {row.issues.slice(0, 3).map((i, idx) => (
              <li key={idx} className={i.level === "error" ? "text-rose-600" : "text-amber-600"}>• {i.message}</li>
            ))}
            {row.issues.length > 3 && <li className="text-muted-foreground">+{row.issues.length - 3} more</li>}
          </ul>
        )}
      </td>
    </tr>
  );
}

function SummaryView({
  schema,
  report,
  result,
}: {
  schema: DatasetSchema;
  report: ValidationReport;
  result: { created: number; updated?: number; skipped?: number; warnings?: number; ids: string[] };
}) {
  const created = result.created;
  const updated = result.updated ?? 0;
  const warnings = result.warnings ?? 0;
  const skipped = result.skipped ?? 0;
  const rejected = report.rejectedRows;
  const clean = Math.max(0, created - warnings);
  return (
    <div className="py-4 space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-4">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
        <div>
          <p className="font-semibold">Import complete</p>
          <p className="text-sm text-muted-foreground">
            {created + updated} record(s) processed for {schema.label}. Every record was routed through
            the Workflow Engine, Timeline, and Audit Log. Cases with missing optional data were created
            as “Incomplete” and can be completed later — airport operations never stop for missing data.
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
        <Item label="Imported Successfully" value={clean} />
        <Item label="Imported with Warnings" value={warnings} />
        <Item label="Updated Existing" value={updated} />
        <Item label="Skipped" value={skipped} />
        <Item label="Rejected" value={rejected} />
      </dl>
      <p className="text-xs text-muted-foreground">
        File: <span className="font-medium">{report.fileName}</span> · Total rows: {report.totalRows}
      </p>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Copy className="h-3 w-3" /> Audit reference logged under Activity Timeline → Import events.
      </p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-semibold truncate">{value}</p>
    </div>
  );
}
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, FileCode2, Cloud } from "lucide-react";
import { toast } from "sonner";
import { exportDataset } from "@/lib/io/export-service";
import { logIoAudit } from "@/lib/store";
import type { DatasetSchema, ExportFormat } from "@/lib/io/types";

interface Props {
  schema: DatasetSchema;
  /** Optional pre-filtered rows (current-page / selected / filtered view). */
  rows?: Record<string, unknown>[];
  scope?: "all" | "filtered" | "selected" | "page";
  size?: "sm" | "default";
  actor?: string;
  disabled?: boolean;
}

export function ExportMenu({
  schema,
  rows,
  scope = "all",
  size = "default",
  actor = "Operator",
  disabled,
}: Props) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = (format: ExportFormat) => {
    setBusy(format);
    try {
      const res = exportDataset(schema, { format, scope, rows });
      logIoAudit({
        action: "export.run",
        actor,
        moduleId: schema.id,
        moduleLabel: schema.label,
        format,
        accepted: res.count,
        totalRows: res.count,
      });
      toast.success(`${schema.label} exported`, {
        description: `${res.count} record(s) · ${format.toUpperCase()} · scope: ${scope}`,
      });
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-2" disabled={disabled || !!busy}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Format</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => run("csv")}>
          <FileText className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("xls")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xls)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("pdf")}>
          <FileText className="h-4 w-4 mr-2" /> PDF Report
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            toast.info("REST export queued", {
              description: "Endpoint will be wired via Integrations once configured.",
            })
          }
        >
          <Cloud className="h-4 w-4 mr-2" /> REST API
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            toast.info(`Scope: ${scope}`, {
              description: `${rows?.length ?? schema.read().length} record(s) will be included.`,
            })
          }
        >
          <FileCode2 className="h-4 w-4 mr-2" /> View scope
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

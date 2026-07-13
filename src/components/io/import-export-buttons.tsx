import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { ImportDialog } from "./import-dialog";
import { ExportMenu } from "./export-menu";
import type { DatasetSchema } from "@/lib/io/types";

interface Props {
  schema: DatasetSchema;
  rows?: Record<string, unknown>[];
  scope?: "all" | "filtered" | "selected" | "page";
  actor?: string;
  size?: "sm" | "default";
  showImport?: boolean;
}

export function ImportExportButtons({
  schema,
  rows,
  scope = "all",
  actor = "Operator",
  size = "default",
  showImport = true,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {showImport && (
        <Button variant="outline" size={size} className="gap-2" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4" /> Import
        </Button>
      )}
      <ExportMenu schema={schema} rows={rows} scope={scope} size={size} actor={actor} />
      {showImport && (
        <ImportDialog schema={schema} open={open} onOpenChange={setOpen} actor={actor} />
      )}
    </div>
  );
}
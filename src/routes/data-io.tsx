import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Database, Search, ArrowRightLeft } from "lucide-react";
import { IO_REGISTRY } from "@/lib/io/registry";
import { downloadTemplate } from "@/lib/io/template";
import { ImportDialog } from "@/components/io/import-dialog";
import { ExportMenu } from "@/components/io/export-menu";
import { useStore } from "@/lib/store";
import type { DatasetSchema } from "@/lib/io/types";

export const Route = createFileRoute("/data-io")({
  head: () => ({
    meta: [
      { title: "Import / Export Center — IAB Smart Baggage Ecosystem" },
      { name: "description", content: "Enterprise data import and export across every operational module." },
    ],
  }),
  component: DataIoPage,
});

function DataIoPage() {
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState<DatasetSchema | null>(null);
  const ioAudit = useStore((s) => s.ioAudit);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return IO_REGISTRY;
    return IO_REGISTRY.filter(
      (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [query]);

  const kpis = useMemo(() => {
    const imports = ioAudit.filter((a) => a.action === "import.commit");
    const exports = ioAudit.filter((a) => a.action === "export.run");
    const totalImported = imports.reduce((n, a) => n + (a.accepted ?? 0), 0);
    return {
      modules: IO_REGISTRY.length,
      imports: imports.length,
      exports: exports.length,
      totalImported,
    };
  }, [ioAudit]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <ArrowRightLeft className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Import / Export Center</h1>
          <p className="text-sm text-muted-foreground">
            Reusable enterprise data framework — CSV & Excel today, PDF and REST-ready for tomorrow.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Modules Connected" value={kpis.modules} icon={<Database className="h-4 w-4" />} />
        <Kpi label="Imports Executed" value={kpis.imports} icon={<Upload className="h-4 w-4" />} />
        <Kpi label="Records Imported" value={kpis.totalImported} icon={<Upload className="h-4 w-4" />} />
        <Kpi label="Exports Executed" value={kpis.exports} icon={<Download className="h-4 w-4" />} />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search modules…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((schema) => (
          <ModuleCard key={schema.id} schema={schema} onImport={() => setImporting(schema)} />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Import / Export Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Module</th>
                  <th className="text-left px-4 py-3 font-medium">Actor</th>
                  <th className="text-left px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ioAudit.slice(0, 15).map((a) => (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(a.at).toLocaleString("en-GB")}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={a.action === "import.commit" ? "default" : "secondary"}>
                        {a.action === "import.commit" ? "Import" : "Export"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{a.moduleLabel}</td>
                    <td className="px-4 py-2 text-xs">{a.actor}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {a.action === "import.commit"
                        ? `${a.accepted ?? 0} accepted · ${a.rejected ?? 0} rejected · ${a.fileName ?? ""}`
                        : `${a.accepted ?? 0} rows · ${(a.format ?? "").toUpperCase()}`}
                    </td>
                  </tr>
                ))}
                {ioAudit.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No import or export events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {importing && (
        <ImportDialog
          schema={importing}
          open={!!importing}
          onOpenChange={(v) => { if (!v) setImporting(null); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className="text-primary">{icon}</span>
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function ModuleCard({ schema, onImport }: { schema: DatasetSchema; onImport: () => void }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{schema.label}</h3>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              v{schema.templateVersion}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{schema.description}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          {schema.fields.length} fields · {schema.read().length} current record(s)
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadTemplate(schema)}>
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
          <Button size="sm" className="gap-2" onClick={onImport}>
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <ExportMenu schema={schema} scope="all" size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}
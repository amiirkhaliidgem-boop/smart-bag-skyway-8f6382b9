import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, FileCode2, Cloud } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/export-center")({
  head: () => ({ meta: [{ title: "Export Center — IAB Smart Baggage Ecosystem" }] }),
  component: ExportCenterPage,
});

const MODULES = [
  "Lost & Found",
  "Storage Control",
  "Delivery Management",
  "Driver Portal",
  "Passenger Tracking",
  "Contact Center",
  "Feedback",
  "Quality Incidents",
  "Notification Center",
  "Workflow Monitor",
  "Activity Timeline",
  "Audit Logs",
];

const FORMATS = [
  { key: "csv", label: "CSV", desc: "Comma-separated values for spreadsheets and data pipelines.", Icon: FileText },
  { key: "xlsx", label: "Excel (XLSX)", desc: "Native Microsoft Excel workbook with formatting.", Icon: FileSpreadsheet },
  { key: "pdf", label: "PDF Report", desc: "Enterprise-branded PDF export for archival and printing.", Icon: FileText },
  { key: "api", label: "REST API Export", desc: "Streaming endpoint for downstream systems (Odoo, BI).", Icon: FileCode2 },
] as const;

function ExportCenterPage() {
  const [module, setModule] = useState("Delivery Management");
  const [station, setStation] = useState("all");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Export Center</h1>
          <p className="text-sm text-muted-foreground">Centralized exports for every operational module. Configure filters and choose a delivery format.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Export Filters</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Module</label>
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Station</label>
              <Select value={station} onValueChange={setStation}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stations</SelectItem>
                  <SelectItem value="CAI">Cairo (CAI)</SelectItem>
                  <SelectItem value="HRG">Hurghada (HRG)</SelectItem>
                  <SelectItem value="SSH">Sharm El Sheikh (SSH)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Department</label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="lost-found">Lost & Found</SelectItem>
                  <SelectItem value="delivery">Delivery Ops</SelectItem>
                  <SelectItem value="contact">Contact Center</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {FORMATS.map((f) => (
          <Card key={f.key}>
            <CardContent className="p-5 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <f.Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() =>
                  toast.success(`${f.label} export queued`, {
                    description: `${module} · ${station} · ${status}`,
                  })
                }
              >
                Queue {f.label}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" /> Export Destinations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>• Local download (default)</li>
            <li>• Odoo ERP scheduled sync (ready for integration)</li>
            <li>• Email delivery to authorised stakeholders</li>
            <li>• Secure API push to BI warehouse</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
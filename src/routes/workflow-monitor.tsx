import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { WORKFLOW_LABELS, WORKFLOW_STATUSES, type WorkflowStatus } from "@/lib/workflow/statuses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch, Clock, AlertTriangle, PackageCheck, Truck, Warehouse, RotateCcw, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/workflow-monitor")({
  head: () => ({ meta: [{ title: "Workflow Monitor — IAB Smart Baggage Ecosystem" }] }),
  component: WorkflowMonitorPage,
});

const SLA_MINUTES: Record<WorkflowStatus, number> = {
  PIR_CREATED: 60,
  HOME_DELIVERY_REQUESTED: 30,
  DELIVERY_APPROVED: 30,
  DRIVER_ASSIGNED: 20,
  READY_FOR_COLLECTION: 30,
  CLAIMED_ON_HAND: 15,
  OUT_FOR_DELIVERY: 120,
  DRIVER_ARRIVED: 10,
  OTP_VERIFIED: 5,
  DELIVERED: 0,
  FEEDBACK_SUBMITTED: 0,
  CLOSED: 0,
};

function WorkflowMonitorPage() {
  const workflow = useStore((s) => s.workflow);
  const deliveries = useStore((s) => s.deliveries);
  const incidents = useStore((s) => s.qualityIncidents);

  const [station, setStation] = useState<string>("all");
  const [driver, setDriver] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return workflow
      .map((w) => {
        const del = deliveries.find((d) => d.deliveryId === w.deliveryId);
        const last = w.history[w.history.length - 1];
        const elapsedMin = last ? Math.floor((Date.now() - new Date(last.at).getTime()) / 60000) : 0;
        const sla = SLA_MINUTES[w.status] || 0;
        const nextIdx = WORKFLOW_STATUSES.indexOf(w.status) + 1;
        const nextStep = nextIdx < WORKFLOW_STATUSES.length ? WORKFLOW_STATUSES[nextIdx] : null;
        return { w, del, last, elapsedMin, sla, breached: sla > 0 && elapsedMin > sla, nextStep };
      })
      .filter((r) => {
        if (station !== "all" && r.del && !r.del.address.includes(station)) return false;
        if (driver !== "all" && r.del?.driver !== driver) return false;
        if (statusFilter !== "all" && r.w.status !== statusFilter) return false;
        if (q) {
          const s = q.toLowerCase();
          const bag = r.del ? `${r.del.deliveryId} ${r.del.pirNumber} ${r.del.passengerName}`.toLowerCase() : r.w.deliveryId.toLowerCase();
          if (!bag.includes(s)) return false;
        }
        return true;
      });
  }, [workflow, deliveries, station, driver, statusFilter, q]);

  const kpis = useMemo(() => {
    const bySt = (s: WorkflowStatus) => workflow.filter((w) => w.status === s).length;
    const delayed = rows.filter((r) => r.breached).length;
    return [
      { label: "Cases Waiting", value: bySt("PIR_CREATED") + bySt("HOME_DELIVERY_REQUESTED"), icon: Clock, tone: "amber" },
      { label: "In Storage", value: deliveries.filter((d) => d.status === "Pending" || d.status === "Assigned").length, icon: Warehouse, tone: "indigo" },
      { label: "Ready for Delivery", value: bySt("READY_FOR_COLLECTION") + bySt("CLAIMED_ON_HAND"), icon: PackageCheck, tone: "primary" },
      { label: "Out for Delivery", value: bySt("OUT_FOR_DELIVERY") + bySt("DRIVER_ARRIVED"), icon: Truck, tone: "primary" },
      { label: "Delivered", value: bySt("DELIVERED") + bySt("CLOSED") + bySt("FEEDBACK_SUBMITTED"), icon: PackageCheck, tone: "emerald" },
      { label: "Delayed", value: delayed, icon: AlertTriangle, tone: "rose" },
      { label: "Quality Alerts", value: incidents.filter((i) => i.status !== "Resolved").length, icon: ShieldAlert, tone: "rose" },
      { label: "Returned", value: 0, icon: RotateCcw, tone: "amber" },
    ];
  }, [workflow, deliveries, rows, incidents]);

  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    indigo: "bg-indigo-100 text-indigo-700",
    rose: "bg-rose-100 text-rose-700",
  };

  const drivers = Array.from(new Set(deliveries.map((d) => d.driver))).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <GitBranch className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Workflow Monitor</h1>
          <p className="text-sm text-muted-foreground">Real-time operational board across the full delivery lifecycle.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className={`h-9 w-9 rounded-lg grid place-items-center ${tones[k.tone]}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-xl font-bold tabular-nums">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live Workflow Board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="Search PIR, delivery ID or passenger…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={station} onValueChange={setStation}>
              <SelectTrigger><SelectValue placeholder="Station" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stations</SelectItem>
                <SelectItem value="Cairo">Cairo (CAI)</SelectItem>
                <SelectItem value="Giza">Giza</SelectItem>
                <SelectItem value="Alexandria">Alexandria</SelectItem>
              </SelectContent>
            </Select>
            <Select value={driver} onValueChange={setDriver}>
              <SelectTrigger><SelectValue placeholder="Driver" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drivers</SelectItem>
                {drivers.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {WORKFLOW_STATUSES.map((s) => <SelectItem key={s} value={s}>{WORKFLOW_LABELS[s].en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Delivery</th>
                  <th className="text-left px-4 py-3 font-medium">Passenger / PIR</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Driver</th>
                  <th className="text-left px-4 py-3 font-medium">Elapsed</th>
                  <th className="text-left px-4 py-3 font-medium">SLA</th>
                  <th className="text-left px-4 py-3 font-medium">Next Step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">No workflow records match the current filters.</td></tr>
                )}
                {rows.map(({ w, del, elapsedMin, sla, breached, nextStep }) => (
                  <tr key={w.deliveryId} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs">{w.deliveryId}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{del?.passengerName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{del?.pirNumber ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                        {WORKFLOW_LABELS[w.status].en}
                      </span>
                    </td>
                    <td className="px-4 py-3">{del?.driver ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{elapsedMin}m</td>
                    <td className="px-4 py-3 text-xs">
                      {sla ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${breached ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {breached ? "Breached" : "On Track"} · {sla}m
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">{nextStep ? WORKFLOW_LABELS[nextStep].en : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type {
  BaggageCase,
  Delivery,
  Feedback,
  NotificationEvent,
  QualityIncident,
  WorkflowRecord,
} from "@/lib/store";
import type { AuditEntry } from "@/lib/audit/log";
import { WORKFLOW_LABELS, type WorkflowStatus } from "@/lib/workflow/statuses";
import { triggerLabel, triggerWorkflowStatus } from "@/lib/notifications/templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPin,
  MessageSquare,
  Package,
  QrCode,
  ShieldAlert,
  Star,
  Truck,
  UserCheck,
  Warehouse,
  X,
} from "lucide-react";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Activity Timeline — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Enterprise chronological history of every baggage case, delivery, notification, and quality incident across the IAB Smart Baggage Ecosystem.",
      },
    ],
  }),
  component: TimelinePage,
});

type ModuleSource =
  | "Workflow"
  | "Notifications"
  | "Passenger"
  | "Driver"
  | "Quality"
  | "Storage"
  | "Audit"
  | "Feedback"
  | "LostFound"
  | "Delivery";

interface TimelineEvent {
  id: string;
  at: string;
  title: string;
  description: string;
  user: string;
  role: string;
  module: ModuleSource;
  workflowStatus?: WorkflowStatus;
  deliveryId?: string;
  pirNumber?: string;
  bagId?: string;
  driver?: string;
  passengerName?: string;
  icon: typeof Activity;
  raw: unknown;
}

// Display-only module labels. Stored module keys are unchanged.
const MODULE_LABELS: Partial<Record<ModuleSource, string>> = {
  Driver: "Delivery Agent",
};

function moduleLabel(m: ModuleSource): string {
  return MODULE_LABELS[m] ?? m;
}

const MODULE_STYLES: Record<ModuleSource, { badge: string; ring: string; dot: string }> = {
  Workflow: {
    badge: "bg-primary/10 text-primary border-primary/20",
    ring: "ring-primary/30",
    dot: "bg-primary",
  },
  Notifications: {
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    ring: "ring-sky-300",
    dot: "bg-sky-500",
  },
  Passenger: {
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    ring: "ring-violet-300",
    dot: "bg-violet-500",
  },
  Driver: {
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    ring: "ring-indigo-300",
    dot: "bg-indigo-500",
  },
  Quality: {
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    ring: "ring-rose-300",
    dot: "bg-rose-500",
  },
  Storage: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    ring: "ring-amber-300",
    dot: "bg-amber-500",
  },
  Audit: {
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    ring: "ring-slate-300",
    dot: "bg-slate-500",
  },
  Feedback: {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-300",
    dot: "bg-emerald-500",
  },
  LostFound: {
    badge: "bg-teal-100 text-teal-700 border-teal-200",
    ring: "ring-teal-300",
    dot: "bg-teal-500",
  },
  Delivery: {
    badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
    ring: "ring-cyan-300",
    dot: "bg-cyan-500",
  },
};

const STATUS_META: Record<
  WorkflowStatus,
  { title: string; icon: typeof Activity; module: ModuleSource; description: string }
> = {
  PIR_CREATED: {
    title: "PIR Created",
    icon: FileText,
    module: "LostFound",
    description: "Property Irregularity Report opened for the passenger.",
  },
  HOME_DELIVERY_REQUESTED: {
    title: "Home Delivery Requested",
    icon: ClipboardList,
    module: "Delivery",
    description: "Passenger requested home baggage delivery service.",
  },
  DELIVERY_APPROVED: {
    title: "Delivery Approved",
    icon: CheckCircle2,
    module: "Delivery",
    description: "Home delivery request approved by baggage coordinator.",
  },
  DRIVER_ASSIGNED: {
    title: "Delivery Agent Assigned",
    icon: UserCheck,
    module: "Delivery",
    description: "Delivery assigned to a delivery agent for dispatch.",
  },
  READY_FOR_COLLECTION: {
    title: "Ready for Collection",
    icon: Package,
    module: "Storage",
    description: "Baggage staged and ready for delivery agent pickup at storage.",
  },
  CLAIMED_ON_HAND: {
    title: "Baggage Claimed On Hand",
    icon: Package,
    module: "Driver",
    description: "Delivery agent collected the baggage from storage.",
  },
  OUT_FOR_DELIVERY: {
    title: "Out For Delivery",
    icon: Truck,
    module: "Driver",
    description: "Delivery agent en route to the passenger address.",
  },
  DRIVER_ARRIVED: {
    title: "Delivery Agent Arrived",
    icon: MapPin,
    module: "Driver",
    description: "Delivery agent arrived at the passenger delivery location.",
  },
  OTP_VERIFIED: {
    title: "OTP Verified",
    icon: ShieldAlert,
    module: "Passenger",
    description: "One-time password confirmed at handover.",
  },
  DELIVERED: {
    title: "Passenger Received Baggage",
    icon: CheckCircle2,
    module: "Passenger",
    description: "Baggage successfully delivered and received.",
  },
  FEEDBACK_SUBMITTED: {
    title: "Passenger Submitted Feedback",
    icon: Star,
    module: "Feedback",
    description: "Passenger completed the post-delivery satisfaction survey.",
  },
  CLOSED: {
    title: "Case Closed",
    icon: CheckCircle2,
    module: "Audit",
    description: "Case archived and closed in the operations ledger.",
  },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function buildEvents(
  cases: BaggageCase[],
  deliveries: Delivery[],
  workflow: WorkflowRecord[],
  notifications: NotificationEvent[],
  feedback: Feedback[],
  incidents: QualityIncident[],
  audit: AuditEntry[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const deliveryByBag = new Map(deliveries.map((d) => [d.bagId, d]));
  const workflowByDelivery = new Map(workflow.map((w) => [w.deliveryId, w]));

  // Cases → PIR + Storage + QR
  for (const c of cases) {
    events.push({
      id: `EV-PIR-${c.bagId}`,
      at: c.createdAt,
      title: "PIR Created",
      description: `PIR ${c.pirNumber} opened for ${c.passengerName} — flight ${c.flightNumber}.`,
      user: "Lost & Found Desk",
      role: "Lost & Found Agent",
      module: "LostFound",
      workflowStatus: "PIR_CREATED",
      bagId: c.bagId,
      pirNumber: c.pirNumber,
      passengerName: c.passengerName,
      icon: FileText,
      raw: c,
    });
    if (c.storage) {
      events.push({
        id: `EV-STORE-${c.bagId}`,
        at: c.createdAt,
        title: "Bag Registered in Storage",
        description: `Stored at Zone ${c.storage.zone} · Shelf ${c.storage.shelf} · Position ${c.storage.position}.`,
        user: "Storage Controller",
        role: "Baggage Supervisor",
        module: "Storage",
        bagId: c.bagId,
        pirNumber: c.pirNumber,
        passengerName: c.passengerName,
        icon: Warehouse,
        raw: c,
      });
      events.push({
        id: `EV-QR-${c.bagId}`,
        at: c.createdAt,
        title: "QR Code Generated",
        description: `Unique QR code generated for ${c.bagId} and linked to ${c.pirNumber}.`,
        user: "System",
        role: "System",
        module: "Storage",
        bagId: c.bagId,
        pirNumber: c.pirNumber,
        passengerName: c.passengerName,
        icon: QrCode,
        raw: c,
      });
    }
    if (c.status !== "Missing") {
      events.push({
        id: `EV-LOCATED-${c.bagId}`,
        at: c.createdAt,
        title: "Bag Located",
        description: `Bag ${c.bagId} matched and located at Cairo International Airport.`,
        user: "Baggage Tracing",
        role: "Lost & Found Agent",
        module: "LostFound",
        bagId: c.bagId,
        pirNumber: c.pirNumber,
        passengerName: c.passengerName,
        icon: Package,
        raw: c,
      });
    }
  }

  // Workflow history per delivery
  for (const w of workflow) {
    const d = deliveries.find((x) => x.deliveryId === w.deliveryId);
    for (let i = 0; i < w.history.length; i++) {
      const h = w.history[i];
      const meta = STATUS_META[h.status];
      if (!meta) continue;
      events.push({
        id: `EV-WF-${w.deliveryId}-${i}-${h.status}`,
        at: h.at,
        title: meta.title,
        description: meta.description,
        user: h.actor || "system",
        role: h.role ?? meta.module,
        module: meta.module,
        workflowStatus: h.status,
        deliveryId: w.deliveryId,
        bagId: w.bagId,
        pirNumber: d?.pirNumber,
        driver: d?.driver,
        passengerName: d?.passengerName,
        icon: meta.icon,
        raw: h,
      });
    }
  }

  // Notifications
  for (const n of notifications) {
    const d = deliveries.find((x) => x.deliveryId === n.deliveryId);
    events.push({
      id: `EV-NTF-${n.id}`,
      at: n.createdAt,
      title: `${n.channel.toUpperCase()} Notification (${n.locale.toUpperCase()})`,
      description: `${n.message.subject ?? n.message.body.slice(0, 80)} → ${n.to}`,
      user: n.operator ?? "Notification Engine",
      role: "Delivery Coordinator",
      module: "Notifications",
      workflowStatus: triggerWorkflowStatus(n.status),
      deliveryId: n.deliveryId,
      pirNumber: n.pirNumber,
      passengerName: n.passengerName,
      driver: d?.driver,
      bagId: d?.bagId,
      icon: Bell,
      raw: n,
    });
  }

  // Feedback
  for (const f of feedback) {
    const d = deliveryByBag.get(f.bagId);
    events.push({
      id: `EV-FB-${f.id}`,
      at: f.at,
      title: "Passenger Submitted Feedback",
      description: `Rating ${f.rating}/5 · ${f.resolved ? "Issue resolved" : "Issue unresolved"} — "${f.comments.slice(0, 80)}"`,
      user: f.passengerName,
      role: "Passenger",
      module: "Feedback",
      workflowStatus: "FEEDBACK_SUBMITTED",
      deliveryId: d?.deliveryId,
      bagId: f.bagId,
      pirNumber: d?.pirNumber,
      passengerName: f.passengerName,
      icon: Star,
      raw: f,
    });
  }

  // Quality Incidents
  for (const q of incidents) {
    events.push({
      id: `EV-QI-${q.id}`,
      at: q.at,
      title: `Quality Incident Created · ${q.category}`,
      description: `${q.severity} severity — ${q.description}`,
      user: "Quality Team",
      role: "Quality Team",
      module: "Quality",
      deliveryId: q.deliveryId,
      bagId: q.bagId,
      driver: q.driver,
      passengerName: q.passengerName,
      icon: AlertTriangle,
      raw: q,
    });
  }

  // Audit — supplement with entries not already surfaced
  for (const a of audit) {
    if (a.action === "workflow.transition") continue; // already surfaced via history
    if (a.action === "notification.dispatch") continue; // already surfaced via notifications
    events.push({
      id: `EV-AUD-${a.id}`,
      at: a.at,
      title: `Audit · ${a.action}`,
      description: a.note ?? `${a.entityType} ${a.entityId}`,
      user: a.actor,
      role: a.role ?? "System",
      module: "Audit",
      workflowStatus: a.toStatus,
      deliveryId: a.entityType === "delivery" ? a.entityId : undefined,
      icon: ClipboardList,
      raw: a,
    });
  }

  // Synthesize QR Scan events for out-for-delivery / delivered deliveries
  for (const d of deliveries) {
    const w = workflowByDelivery.get(d.deliveryId);
    if (!w) continue;
    if (
      w.status === "OUT_FOR_DELIVERY" ||
      w.status === "DELIVERED" ||
      w.status === "CLOSED"
    ) {
      const anchor = w.history.find((h) => h.status === "CLAIMED_ON_HAND") ??
        w.history[0];
      events.push({
        id: `EV-QRSCAN-${d.deliveryId}`,
        at: anchor.at,
        title: "QR Code Scanned",
        description: `Delivery agent scanned ${d.bagId} at collection — chain of custody handoff.`,
        user: d.driver,
        role: "Driver",
        module: "Driver",
        deliveryId: d.deliveryId,
        bagId: d.bagId,
        pirNumber: d.pirNumber,
        driver: d.driver,
        passengerName: d.passengerName,
        icon: QrCode,
        raw: d,
      });
    }
    if (d.otpStatus === "Sent" || d.otpStatus === "Verified") {
      events.push({
        id: `EV-OTPGEN-${d.deliveryId}`,
        at: w.history[0].at,
        title: "OTP Generated",
        description: `Delivery OTP issued to ${d.passengerName} on ${d.mobile}.`,
        user: "Notification Engine",
        role: "System",
        module: "Notifications",
        deliveryId: d.deliveryId,
        bagId: d.bagId,
        pirNumber: d.pirNumber,
        passengerName: d.passengerName,
        icon: ShieldAlert,
        raw: d,
      });
    }
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events;
}

function TimelinePage() {
  const cases = useStore((s) => s.cases);
  const deliveries = useStore((s) => s.deliveries);
  const workflow = useStore((s) => s.workflow);
  const notifications = useStore((s) => s.notifications);
  const feedback = useStore((s) => s.feedback);
  const incidents = useStore((s) => s.qualityIncidents);
  const audit = useStore((s) => s.audit);

  const events = useMemo(
    () =>
      buildEvents(cases, deliveries, workflow, notifications, feedback, incidents, audit),
    [cases, deliveries, workflow, notifications, feedback, incidents, audit],
  );

  const drivers = useMemo(
    () => Array.from(new Set(deliveries.map((d) => d.driver).filter((x) => x && x !== "—"))),
    [deliveries],
  );
  const passengers = useMemo(
    () => Array.from(new Set(cases.map((c) => c.passengerName))),
    [cases],
  );
  const employees = useMemo(
    () => Array.from(new Set(events.map((e) => e.user))).sort(),
    [events],
  );

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fStatus, setFStatus] = useState<"all" | WorkflowStatus>("all");
  const [fModule, setFModule] = useState<"all" | ModuleSource>("all");
  const [fDelivery, setFDelivery] = useState("all");
  const [fPIR, setFPIR] = useState("all");
  const [fEmployee, setFEmployee] = useState("all");
  const [fDriver, setFDriver] = useState("all");
  const [fPassenger, setFPassenger] = useState("all");
  const [selected, setSelected] = useState<TimelineEvent | null>(null);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (q) {
        const hay = [
          e.title,
          e.description,
          e.user,
          e.deliveryId,
          e.pirNumber,
          e.bagId,
          e.passengerName,
          e.driver,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (dateFrom && new Date(e.at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(e.at) > end) return false;
      }
      if (fStatus !== "all" && e.workflowStatus !== fStatus) return false;
      if (fModule !== "all" && e.module !== fModule) return false;
      if (fDelivery !== "all" && e.deliveryId !== fDelivery) return false;
      if (fPIR !== "all" && e.pirNumber !== fPIR) return false;
      if (fEmployee !== "all" && e.user !== fEmployee) return false;
      if (fDriver !== "all" && e.driver !== fDriver) return false;
      if (fPassenger !== "all" && e.passengerName !== fPassenger) return false;
      return true;
    });
  }, [events, q, dateFrom, dateTo, fStatus, fModule, fDelivery, fPIR, fEmployee, fDriver, fPassenger]);

  const kpis = useMemo(() => {
    const byModule = new Map<ModuleSource, number>();
    for (const e of filtered) byModule.set(e.module, (byModule.get(e.module) ?? 0) + 1);
    return {
      total: filtered.length,
      workflow: byModule.get("Workflow") ?? 0,
      notifications: byModule.get("Notifications") ?? 0,
      quality: byModule.get("Quality") ?? 0,
    };
  }, [filtered]);

  function resetFilters() {
    setQ("");
    setDateFrom("");
    setDateTo("");
    setFStatus("all");
    setFModule("all");
    setFDelivery("all");
    setFPIR("all");
    setFEmployee("all");
    setFDriver("all");
    setFPassenger("all");
  }

  const uniqueDeliveries = Array.from(new Set(deliveries.map((d) => d.deliveryId)));
  const uniquePIRs = Array.from(new Set(cases.map((c) => c.pirNumber)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Activity Timeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Single source of truth — every workflow, notification, driver, passenger, quality, and
            audit event across the ecosystem.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live feed · {events.length.toLocaleString()} events indexed
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Activity} label="Events (filtered)" value={kpis.total} tone="text-primary bg-primary/10" />
        <KpiCard icon={Truck} label="Workflow Transitions" value={kpis.workflow} tone="text-cyan-700 bg-cyan-100" />
        <KpiCard icon={Bell} label="Notifications" value={kpis.notifications} tone="text-sky-700 bg-sky-100" />
        <KpiCard icon={AlertTriangle} label="Quality Incidents" value={kpis.quality} tone="text-rose-700 bg-rose-100" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Filters</span>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">
              Reset
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
            <Label className="text-xs">Search</Label>
            <Input
              placeholder="Search events, PIR, delivery, driver, passenger…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9"
            />
          </div>
          <FieldDate label="From" value={dateFrom} onChange={setDateFrom} />
          <FieldDate label="To" value={dateTo} onChange={setDateTo} />
          <FieldSelect
            label="Module"
            value={fModule}
            onChange={(v) => setFModule(v as "all" | ModuleSource)}
            options={[
              { v: "all", l: "All modules" },
              ...(Object.keys(MODULE_STYLES) as ModuleSource[]).map((m) => ({ v: m, l: m })),
            ]}
          />
          <FieldSelect
            label="Workflow Status"
            value={fStatus}
            onChange={(v) => setFStatus(v as "all" | WorkflowStatus)}
            options={[
              { v: "all", l: "All statuses" },
              ...(Object.keys(WORKFLOW_LABELS) as WorkflowStatus[]).map((s) => ({
                v: s,
                l: WORKFLOW_LABELS[s].en,
              })),
            ]}
          />
          <FieldSelect
            label="Delivery ID"
            value={fDelivery}
            onChange={setFDelivery}
            options={[
              { v: "all", l: "All deliveries" },
              ...uniqueDeliveries.map((d) => ({ v: d, l: d })),
            ]}
          />
          <FieldSelect
            label="PIR Number"
            value={fPIR}
            onChange={setFPIR}
            options={[
              { v: "all", l: "All PIRs" },
              ...uniquePIRs.map((p) => ({ v: p, l: p })),
            ]}
          />
          <FieldSelect
            label="Employee"
            value={fEmployee}
            onChange={setFEmployee}
            options={[
              { v: "all", l: "All employees" },
              ...employees.map((e) => ({ v: e, l: e })),
            ]}
          />
          <FieldSelect
            label="Delivery Agent"
            value={fDriver}
            onChange={setFDriver}
            options={[
              { v: "all", l: "All delivery agents" },
              ...drivers.map((d) => ({ v: d, l: d })),
            ]}
          />
          <FieldSelect
            label="Passenger"
            value={fPassenger}
            onChange={setFPassenger}
            options={[
              { v: "all", l: "All passengers" },
              ...passengers.map((p) => ({ v: p, l: p })),
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Chronological Timeline · {filtered.length.toLocaleString()} events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No events match your filters.
              </p>
            ) : (
              <ol className="relative border-l-2 border-border ml-3 space-y-4">
                {filtered.slice(0, 200).map((e) => {
                  const styles = MODULE_STYLES[e.module];
                  const dt = fmtDate(e.at);
                  const Icon = e.icon;
                  const isSel = selected?.id === e.id;
                  return (
                    <li key={e.id} className="ml-4">
                      <span
                        className={cn(
                          "absolute -left-[11px] mt-1.5 h-5 w-5 rounded-full ring-4 ring-background grid place-items-center",
                          styles.dot,
                        )}
                      >
                        <Icon className="h-3 w-3 text-white" />
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelected(e)}
                        className={cn(
                          "w-full text-left rounded-lg border p-3 transition-colors bg-card hover:bg-muted/40",
                          isSel
                            ? "border-primary/50 ring-2 " + styles.ring
                            : "border-border",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide",
                              styles.badge,
                            )}
                          >
                            {moduleLabel(e.module)}
                          </span>
                          {e.workflowStatus && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-border bg-background text-[10px] font-medium text-muted-foreground">
                              {WORKFLOW_LABELS[e.workflowStatus].en}
                            </span>
                          )}
                          <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                            {dt.date} · {dt.time}
                          </span>
                        </div>
                        <p className="text-sm font-semibold">{e.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>
                            <span className="text-foreground/80 font-medium">{e.user}</span>
                            <span className="opacity-60"> · {e.role}</span>
                          </span>
                          {e.deliveryId && <span className="font-mono">{e.deliveryId}</span>}
                          {e.pirNumber && <span className="font-mono">{e.pirNumber}</span>}
                          {e.bagId && <span className="font-mono">{e.bagId}</span>}
                        </div>
                      </button>
                    </li>
                  );
                })}
                {filtered.length > 200 && (
                  <li className="ml-4 text-xs text-muted-foreground py-2">
                    Showing latest 200 of {filtered.length.toLocaleString()} — refine filters to see
                    more.
                  </li>
                )}
              </ol>
            )}
          </CardContent>
        </Card>

        <DetailPanel
          event={selected}
          onClose={() => setSelected(null)}
          notifications={notifications}
          feedback={feedback}
          incidents={incidents}
          audit={audit}
        />
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg grid place-items-center", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}

function DetailPanel({
  event,
  onClose,
  notifications,
  feedback,
  incidents,
  audit,
}: {
  event: TimelineEvent | null;
  onClose: () => void;
  notifications: NotificationEvent[];
  feedback: Feedback[];
  incidents: QualityIncident[];
  audit: AuditEntry[];
}) {
  if (!event) {
    return (
      <Card className="h-fit sticky top-20">
        <CardHeader>
          <CardTitle className="text-sm">Event Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select any event on the timeline to inspect full details, related notifications,
            feedback, and quality incidents.
          </p>
        </CardContent>
      </Card>
    );
  }

  const dt = fmtDate(event.at);
  const styles = MODULE_STYLES[event.module];
  const relNotifs = notifications.filter(
    (n) => event.deliveryId && n.deliveryId === event.deliveryId,
  );
  const relFeedback = feedback.filter((f) => event.bagId && f.bagId === event.bagId);
  const relIncidents = incidents.filter(
    (q) =>
      (event.bagId && q.bagId === event.bagId) ||
      (event.deliveryId && q.deliveryId === event.deliveryId),
  );
  const relAudit = audit.filter(
    (a) => event.deliveryId && a.entityId === event.deliveryId,
  );

  return (
    <Card className="h-fit sticky top-20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide",
                styles.badge,
              )}
            >
              {moduleLabel(event.module)}
            </span>
            <CardTitle className="text-base mt-2">{event.title}</CardTitle>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {dt.date} · {dt.time}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted"
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{event.description}</p>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Field label="User" value={event.user} />
          <Field label="Role" value={event.role === "Driver" ? "Delivery Agent" : event.role} />
          {event.workflowStatus && (
            <Field label="Workflow" value={WORKFLOW_LABELS[event.workflowStatus].en} mono />
          )}
          {event.deliveryId && <Field label="Delivery ID" value={event.deliveryId} mono />}
          {event.pirNumber && <Field label="PIR Number" value={event.pirNumber} mono />}
          {event.bagId && <Field label="Bag ID" value={event.bagId} mono />}
          {event.driver && <Field label="Delivery Agent" value={event.driver} />}
          {event.passengerName && <Field label="Passenger" value={event.passengerName} />}
        </div>

        <Section title={`Related Notifications (${relNotifs.length})`} icon={Bell}>
          {relNotifs.slice(0, 4).map((n) => (
            <MiniRow
              key={n.id}
              title={`${n.channel.toUpperCase()} · ${n.locale.toUpperCase()}`}
              subtitle={`${triggerLabel(n.status)} — ${n.status_}`}
              at={n.createdAt}
            />
          ))}
          {relNotifs.length === 0 && <Empty>No related notifications.</Empty>}
        </Section>

        <Section title={`Related Feedback (${relFeedback.length})`} icon={Star}>
          {relFeedback.map((f) => (
            <MiniRow
              key={f.id}
              title={`Rating ${f.rating}/5 · ${f.resolved ? "Resolved" : "Unresolved"}`}
              subtitle={f.comments}
              at={f.at}
            />
          ))}
          {relFeedback.length === 0 && <Empty>No related feedback.</Empty>}
        </Section>

        <Section title={`Related Quality Incidents (${relIncidents.length})`} icon={AlertTriangle}>
          {relIncidents.map((q) => (
            <MiniRow
              key={q.id}
              title={`${q.id} · ${q.category}`}
              subtitle={`${q.severity} — ${q.status}`}
              at={q.at}
            />
          ))}
          {relIncidents.length === 0 && <Empty>No related incidents.</Empty>}
        </Section>

        <Section title={`Related Audit Entries (${relAudit.length})`} icon={ClipboardList}>
          {relAudit.slice(0, 6).map((a) => (
            <MiniRow
              key={a.id}
              title={a.action}
              subtitle={a.note ?? `${a.entityType} ${a.entityId}`}
              at={a.at}
            />
          ))}
          {relAudit.length === 0 && <Empty>No related audit entries.</Empty>}
        </Section>

        <details className="rounded-md border border-border bg-muted/30 p-2">
          <summary className="text-xs font-medium cursor-pointer flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" /> Raw event payload
          </summary>
          <pre className="mt-2 text-[10px] leading-relaxed overflow-x-auto font-mono">
            {JSON.stringify(event.raw, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-xs", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold flex items-center gap-2 text-foreground/80">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function MiniRow({ title, subtitle, at }: { title: string; subtitle: string; at: string }) {
  const dt = fmtDate(at);
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium truncate">{title}</p>
        <p className="text-[10px] font-mono text-muted-foreground shrink-0">
          {dt.date} · {dt.time}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground italic">{children}</p>;
}
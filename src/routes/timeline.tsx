import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, useOpsLoading } from "@/lib/store";
import type {
  BaggageCase,
  Delivery,
  Feedback,
  NotificationEvent,
  QualityIncident,
  WorkflowRecord,
  CallLog,
} from "@/lib/store";
import type { TimelineEntry } from "@/lib/ops.mapping";
import type { AuditEntry, ImportAuditEntry } from "@/lib/audit/log";
import { lfStatusLabel } from "@/lib/lost-found/statuses";
import { WORKFLOW_LABELS, type WorkflowStatus } from "@/lib/workflow/statuses";
import { triggerLabel, triggerWorkflowStatus } from "@/lib/notifications/templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
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
  PhoneCall,
  ShieldAlert,
  StickyNote,
  Star,
  Truck,
  UploadCloud,
  UserCheck,
  Warehouse,
  X,
} from "lucide-react";
import { PageLoading } from "@/components/ops-skeleton";

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
  | "Delivery"
  | "ContactCenter"
  | "DataIO";

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
  LostFound: "Lost & Found",
  ContactCenter: "Contact Center",
  DataIO: "Data Import / Export",
};

function moduleLabel(m: ModuleSource): string {
  return MODULE_LABELS[m] ?? m;
}

/** `timeline_events.module` (DB enum) → UI module bucket. */
const DB_MODULE_MAP: Record<string, ModuleSource> = {
  lost_found: "LostFound",
  delivery: "Delivery",
  agent_portal: "Driver",
  passenger_portal: "Passenger",
  workflow: "Workflow",
  notification: "Notifications",
  otp: "Notifications",
  feedback: "Feedback",
  quality: "Quality",
  admin: "Audit",
  system: "Audit",
};

function dbModule(m: string): ModuleSource {
  return DB_MODULE_MAP[m] ?? "Workflow";
}

const MODULE_ICONS: Partial<Record<ModuleSource, typeof Activity>> = {
  LostFound: ClipboardList,
  Delivery: Truck,
  Driver: Truck,
  Passenger: MapPin,
  Notifications: Bell,
  Feedback: CheckCircle2,
  Quality: AlertTriangle,
  Audit: Activity,
  Workflow: Activity,
};

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
  ContactCenter: {
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    ring: "ring-orange-300",
    dot: "bg-orange-500",
  },
  DataIO: {
    badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    ring: "ring-fuchsia-300",
    dot: "bg-fuchsia-500",
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
  READY_FOR_AIRPORT_PICKUP: {
    title: "Ready for Airport Pickup",
    icon: Package,
    module: "LostFound",
    description: "Baggage cleared and waiting for the passenger at the airport office.",
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
  PASSENGER_PICKED_UP: {
    title: "Passenger Collected Baggage",
    icon: CheckCircle2,
    module: "Passenger",
    description: "Passenger collected the baggage at the airport office.",
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
  callLogs: CallLog[],
  ioAudit: ImportAuditEntry[],
  timeline: TimelineEntry[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const deliveryByBag = new Map(deliveries.map((d) => [d.bagId, d]));
  const caseByBag = new Map(cases.map((c) => [c.bagId, c]));

  // Canonical engine log. Every module journals through the Workflow Engine
  // (wf_journal / wf_journal_event), so `timeline_events` is the authoritative
  // record — including Lost & Found transitions (Tracing, Located, …) and
  // officer assignments. Client-side synthesis only fills the gaps for
  // browser-local activity (Data I/O, contact centre).
  for (const t of timeline) {
    events.push({
      id: `EV-DB-${t.id}`,
      at: t.at,
      title: t.title || t.module,
      description: t.detail || t.title || "",
      user: t.actor || "System",
      role: dbModule(t.module),
      module: dbModule(t.module),
      workflowStatus: (WORKFLOW_LABELS as Record<string, unknown>)[t.status]
        ? (t.status as WorkflowStatus)
        : undefined,
      deliveryId: t.deliveryId,
      bagId: t.bagId,
      pirNumber: t.pirNumber,
      passengerName: t.passengerName,
      icon: MODULE_ICONS[dbModule(t.module)] ?? Activity,
      raw: t,
    });
  }

  // Lost & Found — PIR creation + status transitions, only while the engine
  // log has not landed yet (first paint / activity tier still loading).
  for (const c of timeline.length > 0 ? [] : cases) {
    events.push({
      id: `EV-PIR-${c.bagId}`,
      at: c.createdAt,
      title: "PIR Created",
      description: `PIR ${c.pirNumber} opened for ${c.passengerName} — flight ${c.flightNumber}.`,
      user: c.internal?.createdBy || c.internal?.assignedOfficer || "Lost & Found Desk",
      role: "Lost & Found Agent",
      module: "LostFound",
      workflowStatus: "PIR_CREATED",
      bagId: c.bagId,
      pirNumber: c.pirNumber,
      passengerName: c.passengerName,
      icon: FileText,
      raw: c,
    });
    for (let i = 0; i < (c.lfHistory?.length ?? 0); i++) {
      const h = c.lfHistory![i];
      events.push({
        id: `EV-LFH-${c.bagId}-${i}-${h.status}`,
        at: h.at,
        title: `Lost & Found · ${lfStatusLabel(h.status)}`,
        description:
          h.note?.trim() || `Case ${c.bagId} moved to ${lfStatusLabel(h.status)} in Lost & Found.`,
        user: h.actor || "Lost & Found Desk",
        role: "Lost & Found Agent",
        module: "LostFound",
        bagId: c.bagId,
        pirNumber: c.pirNumber,
        passengerName: c.passengerName,
        deliveryId: deliveryByBag.get(c.bagId)?.deliveryId,
        icon: ClipboardList,
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

  // Contact Center — real call logs (incl. portal-generated callbacks).
  for (const cl of callLogs) {
    const d = cl.bagId ? deliveryByBag.get(cl.bagId) : undefined;
    events.push({
      id: `EV-CALL-${cl.id}`,
      at: cl.at,
      title: `Contact Center · ${cl.direction}`,
      description: `${cl.notes || "Call logged"} — ${cl.phone}${
        cl.durationSec ? ` · ${Math.round(cl.durationSec / 60)} min` : ""
      }`,
      user: cl.agent,
      role: "Contact Center Agent",
      module: "ContactCenter",
      bagId: cl.bagId,
      pirNumber: cl.pirNumber ?? d?.pirNumber,
      deliveryId: d?.deliveryId,
      passengerName: cl.passengerName,
      icon: PhoneCall,
      raw: cl,
    });
  }

  // Data Import / Export audit entries.
  for (const io of ioAudit) {
    events.push({
      id: `EV-IO-${io.id}`,
      at: io.at,
      title: `${io.action === "import.commit" ? "Import Committed" : "Export Generated"} · ${io.moduleLabel}`,
      description:
        io.action === "import.commit"
          ? `${io.fileName ?? "file"} — ${io.accepted ?? 0} accepted, ${io.warnings ?? 0} with warnings, ${io.duplicates ?? 0} duplicates, ${io.rejected ?? 0} rejected of ${io.totalRows ?? 0} rows.`
          : `${io.format ?? "file"} export generated for ${io.moduleLabel}.`,
      user: io.actor,
      role: "Operations",
      module: "DataIO",
      icon: UploadCloud,
      raw: io,
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

  // Delivery Management — only real recorded milestones and notes.
  for (const d of deliveries) {
    const kase = caseByBag.get(d.bagId);
    const base = {
      deliveryId: d.deliveryId,
      bagId: d.bagId,
      pirNumber: d.pirNumber || kase?.pirNumber,
      driver: d.driver && d.driver !== "—" ? d.driver : undefined,
      passengerName: d.passengerName,
    };
    const milestones: {
      key: string;
      at?: string;
      title: string;
      description: string;
      actor: string;
      role: string;
      module: ModuleSource;
      icon: typeof Activity;
    }[] = [
      {
        key: "CREATED",
        at: d.createdAt,
        title: "Delivery Order Created",
        description: `Delivery ${d.deliveryId} created for ${d.passengerName}.`,
        actor: "Delivery Management",
        role: "Delivery Coordinator",
        module: "Delivery",
        icon: Package,
      },
      {
        key: "ACCEPTED",
        at: d.acceptedAt,
        title: "Delivery Agent Accepted",
        description: `${d.driver} accepted delivery ${d.deliveryId}.`,
        actor: d.driver,
        role: "Delivery Agent",
        module: "Driver",
        icon: UserCheck,
      },
      {
        key: "COLLECTED",
        at: d.collectedAt,
        title: "Baggage Collected",
        description: `${d.driver} collected ${d.bagId} from storage.`,
        actor: d.driver,
        role: "Delivery Agent",
        module: "Storage",
        icon: Warehouse,
      },
      {
        key: "DELIVERED",
        at: d.deliveredAt,
        title: "Baggage Delivered",
        description: `${d.bagId} handed over to ${d.passengerName}${
          d.otpStatus === "Verified" ? " after OTP verification" : ""
        }.`,
        actor: d.driver,
        role: "Delivery Agent",
        module: "Passenger",
        icon: CheckCircle2,
      },
    ];
    for (const m of milestones) {
      if (!m.at) continue;
      events.push({
        ...base,
        id: `EV-DEL-${d.deliveryId}-${m.key}`,
        at: m.at,
        title: m.title,
        description: m.description,
        user: m.actor || "Delivery Management",
        role: m.role,
        module: m.module,
        icon: m.icon,
        raw: d,
      });
    }
    for (const n of d.notes ?? []) {
      events.push({
        ...base,
        id: `EV-NOTE-${n.id}`,
        at: n.at,
        title: "Internal Note Added",
        description: n.text,
        user: n.actor,
        role: "Delivery Coordinator",
        module: "Delivery",
        icon: StickyNote,
        raw: n,
      });
    }
  }

  const byId = new Map<string, TimelineEvent>();
  for (const e of events) if (e.at) byId.set(e.id, e);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

function TimelinePage() {
  const cases = useStore((s) => s.cases);
  const deliveries = useStore((s) => s.deliveries);
  const workflow = useStore((s) => s.workflow);
  const notifications = useStore((s) => s.notifications);
  const feedback = useStore((s) => s.feedback);
  const incidents = useStore((s) => s.qualityIncidents);
  const audit = useStore((s) => s.audit);
  const callLogs = useStore((s) => s.callLogs);
  const ioAudit = useStore((s) => s.ioAudit);
  const dbTimeline = useStore((s) => s.timeline);
  const loading = useOpsLoading();

  const events = useMemo(
    () =>
      buildEvents(
        cases,
        deliveries,
        workflow,
        notifications,
        feedback,
        incidents,
        audit,
        callLogs,
        ioAudit,
        dbTimeline,
      ),
    [
      cases,
      deliveries,
      workflow,
      notifications,
      feedback,
      incidents,
      audit,
      callLogs,
      ioAudit,
      dbTimeline,
    ],
  );

  const drivers = useMemo(
    () => Array.from(new Set(deliveries.map((d) => d.driver).filter((x) => x && x !== "—"))),
    [deliveries],
  );
  const employees = useMemo(() => Array.from(new Set(events.map((e) => e.user))).sort(), [events]);

  // Universal reference index — lets the global Search box resolve an event
  // by any operational reference (bag tag, PNR, tracking token, …).
  const refIndex = useMemo(() => {
    const caseRefs = new Map<string, string>();
    for (const c of cases) {
      caseRefs.set(
        c.bagId,
        [c.bagTagNumber, ...(c.baggage?.bagTags ?? []), c.passenger?.pnr, c.flightNumber, c.contact]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      );
    }
    const deliveryRefs = new Map<string, string>();
    for (const w of workflow) deliveryRefs.set(w.deliveryId, (w.token ?? "").toLowerCase());
    return { caseRefs, deliveryRefs };
  }, [cases, workflow]);

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fStatus, setFStatus] = useState<"all" | WorkflowStatus>("all");
  const [fModule, setFModule] = useState<"all" | ModuleSource>("all");
  const [fEmployee, setFEmployee] = useState("all");
  const [fDriver, setFDriver] = useState("all");
  const [selected, setSelected] = useState<TimelineEvent | null>(null);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (q) {
        const hay = [
          e.title,
          e.description,
          e.user,
          e.role,
          moduleLabel(e.module),
          e.workflowStatus ? WORKFLOW_LABELS[e.workflowStatus].en : "",
          e.deliveryId,
          e.pirNumber,
          e.bagId,
          e.passengerName,
          e.driver,
          e.bagId ? refIndex.caseRefs.get(e.bagId) : "",
          e.deliveryId ? refIndex.deliveryRefs.get(e.deliveryId) : "",
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
      if (fEmployee !== "all" && e.user !== fEmployee) return false;
      if (fDriver !== "all" && e.driver !== fDriver) return false;
      return true;
    });
  }, [events, q, dateFrom, dateTo, fStatus, fModule, fEmployee, fDriver, refIndex]);

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
    setFEmployee("all");
    setFDriver("all");
  }


  // Progressive loading: render the page shell with placeholders while this
  // screen's data tier is still in flight, instead of showing empty values.
  if (loading.activity && events.length === 0)
    return <PageLoading title={"Activity Timeline"} subtitle={"Single source of truth across the ecosystem."} kpis={0} />;

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
        <KpiCard
          icon={Activity}
          label="Events (filtered)"
          value={kpis.total}
          tone="text-primary bg-primary/10"
        />
        <KpiCard
          icon={Truck}
          label="Workflow Transitions"
          value={kpis.workflow}
          tone="text-cyan-700 bg-cyan-100"
        />
        <KpiCard
          icon={Bell}
          label="Notifications"
          value={kpis.notifications}
          tone="text-sky-700 bg-sky-100"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Quality Incidents"
          value={kpis.quality}
          tone="text-rose-700 bg-rose-100"
        />
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
              placeholder="Search any reference — PIR, delivery ID, bag tag, passenger, agent…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <DateRangeFilter
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
            />
          </div>
          <FieldSelect
            label="Module"
            value={fModule}
            onChange={(v) => setFModule(v as "all" | ModuleSource)}
            options={[
              { v: "all", l: "All modules" },
              ...(Object.keys(MODULE_STYLES) as ModuleSource[]).map((m) => ({
                v: m,
                l: moduleLabel(m),
              })),
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
            label="Employee"
            value={fEmployee}
            onChange={setFEmployee}
            options={[{ v: "all", l: "All employees" }, ...employees.map((e) => ({ v: e, l: e }))]}
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
                          isSel ? "border-primary/50 ring-2 " + styles.ring : "border-border",
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
  const relAudit = audit.filter((a) => event.deliveryId && a.entityId === event.deliveryId);

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
          <SourceFields event={event} />
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

// Extra read-only fields taken straight from the originating record, so the
// selected event shows its complete operational detail.
function SourceFields({ event }: { event: TimelineEvent }) {
  const raw = event.raw as Record<string, unknown>;
  const get = (k: string) => {
    const v = raw?.[k];
    return v === undefined || v === null || v === "" ? undefined : String(v);
  };
  switch (event.module) {
    case "Notifications": {
      const n = event.raw as NotificationEvent;
      if (!n?.channel) return null;
      return (
        <>
          <Field label="Channel" value={n.channel.toUpperCase()} />
          <Field label="Delivery State" value={n.status_} />
          {n.provider && <Field label="Provider" value={n.provider} mono />}
          {n.attempts !== undefined && <Field label="Attempts" value={String(n.attempts)} />}
          {n.failureReason && <Field label="Last Failure" value={n.failureReason} />}
        </>
      );
    }
    case "ContactCenter": {
      const c = event.raw as CallLog;
      if (!c?.direction) return null;
      return (
        <>
          <Field label="Direction" value={c.direction} />
          <Field label="Phone" value={c.phone} mono />
          <Field label="Duration" value={`${c.durationSec}s`} />
        </>
      );
    }
    case "Quality": {
      const q = event.raw as QualityIncident;
      if (!q?.category) return null;
      return (
        <>
          <Field label="Category" value={q.category} />
          <Field label="Severity" value={q.severity} />
          <Field label="Incident Status" value={q.status} />
        </>
      );
    }
    case "Feedback": {
      const f = event.raw as Feedback;
      if (f?.rating === undefined) return null;
      return (
        <>
          <Field label="Rating" value={`${f.rating}/5`} />
          <Field label="Resolved" value={f.resolved ? "Yes" : "No"} />
        </>
      );
    }
    default: {
      const stage = get("stage");
      const otp = get("otpStatus");
      return (
        <>
          {stage && <Field label="Stage" value={stage} />}
          {otp && <Field label="OTP Status" value={otp} />}
        </>
      );
    }
  }
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

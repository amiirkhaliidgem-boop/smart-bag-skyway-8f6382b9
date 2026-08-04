import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  getDeliveryStage,
  useStore,
  useOpsLoading,
  type BaggageCase,
  type Delivery,
  type WorkflowRecord,
} from "@/lib/store";
import { useSystemSettings } from "@/lib/settings/use-settings";
import type { SlaRegion } from "@/lib/settings/types";
import {
  DELIVERY_STAGES,
  STAGE_LABELS,
  STAGE_ORDER,
  stageToWorkflow,
  type DeliveryStage,
} from "@/lib/delivery/stages";
import {
  LF_OWNED_STATUSES,
  LF_STATUS_COLOR,
  LF_STATUS_LABEL,
  LF_TO_WORKFLOW,
  lfPathStatuses,
  type LFStatus,
} from "@/lib/lost-found/statuses";
import type { WorkflowStatus } from "@/lib/workflow/statuses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateRangeFilter, defaultDateRange } from "@/components/filters/date-range-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GitBranch,
  Clock,
  AlertTriangle,
  PackageCheck,
  Truck,
  Warehouse,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { PageLoading } from "@/components/ops-skeleton";
import { PageHeader, DataTable, type DataColumn } from "@/components/layout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workflow-monitor")({
  head: () => ({
    meta: [
      { title: "Workflow Monitor — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Live operational board across the full baggage lifecycle — Lost & Found, Delivery, Delivery Agent and Passenger journey.",
      },
      { property: "og:title", content: "Workflow Monitor — IAB Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content: "Real-time monitoring of every baggage case across the Smart Baggage Ecosystem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkflowMonitorPage,
});

const TERMINAL_STATUSES: WorkflowStatus[] = [
  "DELIVERED",
  "PASSENGER_PICKED_UP",
  "FEEDBACK_SUBMITTED",
  "CLOSED",
];

const LF_STATUS_KEY = (s: LFStatus) => `lf:${s}`;
const STAGE_KEY = (s: DeliveryStage) => `stage:${s}`;

interface MonitorRow {
  key: string;
  bagId: string;
  pirNumber: string;
  passengerName: string;
  phase: "Lost & Found" | "Delivery";
  deliveryId?: string;
  statusKey: string;
  statusLabel: string;
  statusColor: string;
  agent: string;
  workflowStatus: WorkflowStatus;
  lastAt?: string;
  elapsedMin: number;
  sla: number;
  breached: boolean;
  nextStep: string;
  feedbackSubmitted: boolean;
  inStorage: boolean;
}

function lastTimestamp(
  kase?: BaggageCase,
  del?: Delivery,
  wf?: WorkflowRecord,
): string | undefined {
  const candidates = [
    wf?.history?.[wf.history.length - 1]?.at,
    del?.lastUpdatedAt,
    del?.createdAt,
    kase?.updatedAt,
    kase?.createdAt,
  ].filter(Boolean) as string[];
  if (!candidates.length) return undefined;
  return candidates.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}

function WorkflowMonitorPage() {
  const cases = useStore((s) => s.cases);
  const deliveries = useStore((s) => s.deliveries);
  const workflow = useStore((s) => s.workflow);
  const feedback = useStore((s) => s.feedback);
  const incidents = useStore((s) => s.qualityIncidents);
  const loading = useOpsLoading();
  // SLA thresholds are configured by administrators in System Settings.
  const { settings } = useSystemSettings();
  const regions: SlaRegion[] = settings.regions;
  const lfSlaHours: number = settings.sla.lf_sla_hours;

  const [driver, setDriver] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(() => defaultDateRange().from);
  const [to, setTo] = useState(() => defaultDateRange().to);

  // Keep Elapsed / SLA badges accurate without a manual refresh. Live data
  // itself arrives through the store's Supabase realtime subscription.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const allRows = useMemo<MonitorRow[]>(() => {
    void tick;
    const now = Date.now();
    const delByBag = new Map(deliveries.map((d) => [d.bagId, d]));
    const wfByDelivery = new Map(workflow.map((w) => [w.deliveryId, w]));
    const feedbackBags = new Set(feedback.map((f) => f.bagId));
    const seenDeliveries = new Set<string>();

    const build = (kase: BaggageCase | undefined, del: Delivery | undefined): MonitorRow => {
      const wf = del ? wfByDelivery.get(del.deliveryId) : undefined;
      const lfStatus = (kase?.lfStatus ?? "Open") as LFStatus;
      const stage = del ? getDeliveryStage(del) : undefined;

      const statusKey = stage ? STAGE_KEY(stage) : LF_STATUS_KEY(lfStatus);
      const statusLabel = stage ? STAGE_LABELS[stage] : (LF_STATUS_LABEL[lfStatus] ?? lfStatus);
      const statusColor = stage
        ? "bg-primary/10 text-primary border-primary/20"
        : (LF_STATUS_COLOR[lfStatus] ?? "bg-muted text-muted-foreground border-border");

      const workflowStatus: WorkflowStatus =
        wf?.status ??
        (stage ? stageToWorkflow(stage) : (LF_TO_WORKFLOW[lfStatus] ?? "PIR_CREATED"));

      const lastAt = lastTimestamp(kase, del, wf);
      const elapsedMin = lastAt
        ? Math.max(0, Math.floor((now - new Date(lastAt).getTime()) / 60000))
        : 0;
      const regionHours = del
        ? (regions.find((r) => r.id === kase?.delivery?.regionId)?.sla_hours ??
          regions.find((r) => r.is_default)?.sla_hours ??
          24)
        : lfSlaHours;
      const sla = TERMINAL_STATUSES.includes(workflowStatus) ? 0 : regionHours * 60;

      let nextStep = "—";
      if (stage) {
        const idx = STAGE_ORDER[stage];
        const terminal = stage === "Delivered" || stage === "Returned to Airport";
        nextStep = terminal ? "—" : (STAGE_LABELS[DELIVERY_STAGES[idx + 1]] ?? "—");
      } else {
        // Follow the case's own operational path: an Airport Pickup case is
        // owned by Lost & Found end to end and never hands over to Delivery.
        const path = lfPathStatuses(kase?.delivery?.method);
        const pickup = path !== (LF_OWNED_STATUSES as ReadonlyArray<LFStatus>);
        const idx = path.indexOf(lfStatus);
        const next = idx >= 0 ? path[idx + 1] : undefined;
        nextStep = next ? (LF_STATUS_LABEL[next] ?? next) : pickup ? "—" : "Hand over to Delivery";
      }

      const bagId = kase?.bagId ?? del?.bagId ?? "—";

      return {
        key: del?.deliveryId ?? bagId,
        bagId,
        pirNumber: kase?.pirNumber ?? del?.pirNumber ?? "—",
        passengerName: kase?.passengerName ?? del?.passengerName ?? "—",
        phase: del ? "Delivery" : "Lost & Found",
        deliveryId: del?.deliveryId,
        statusKey,
        statusLabel,
        statusColor,
        agent: del?.driver && del.driver !== "—" ? del.driver : "—",
        workflowStatus,
        lastAt,
        elapsedMin,
        sla,
        breached: sla > 0 && elapsedMin > sla,
        nextStep,
        feedbackSubmitted: feedbackBags.has(bagId) || workflowStatus === "FEEDBACK_SUBMITTED",
        inStorage: Boolean(kase?.storage) && !del,
      };
    };

    const rows = cases.map((kase) => {
      const del = delByBag.get(kase.bagId);
      if (del) seenDeliveries.add(del.deliveryId);
      return build(kase, del);
    });

    // Deliveries whose L&F case is not present locally still belong on the board.
    for (const del of deliveries) {
      if (seenDeliveries.has(del.deliveryId)) continue;
      rows.push(build(undefined, del));
    }

    return rows.sort(
      (a, b) => new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime(),
    );
  }, [cases, deliveries, workflow, feedback, tick, regions, lfSlaHours]);

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (driver !== "all" && r.agent !== driver) return false;
      if (statusFilter !== "all" && r.statusKey !== statusFilter) return false;
      if (from || to) {
        const day = r.lastAt ? new Date(r.lastAt).toISOString().slice(0, 10) : "";
        if (!day) return false;
        if (from && day < from) return false;
        if (to && day > to) return false;
      }
      if (q) {
        const s = q.toLowerCase();
        const hay =
          `${r.bagId} ${r.pirNumber} ${r.passengerName} ${r.deliveryId ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [allRows, driver, statusFilter, q, from, to]);

  const wfColumns: DataColumn<(typeof rows)[number]>[] = [
    {
      id: "ref",
      header: "Case / Delivery",
      minWidth: "150px",
      sortValue: (r) => r.deliveryId ?? r.bagId,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-mono text-xs">{r.deliveryId ?? r.bagId}</div>
          <div className="text-[11px] text-muted-foreground">{r.phase}</div>
        </div>
      ),
    },
    {
      id: "passenger",
      header: "Passenger / PIR",
      minWidth: "160px",
      sortValue: (r) => r.passengerName,
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{r.passengerName}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{r.pirNumber}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (r) => r.statusLabel,
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            r.statusColor,
          )}
        >
          {r.statusLabel}
        </span>
      ),
    },
    {
      id: "agent",
      header: "Delivery Agent",
      hideBelow: "md",
      sortValue: (r) => r.agent,
      cell: (r) => <span className="text-sm">{r.agent}</span>,
    },
    {
      id: "elapsed",
      header: "Elapsed",
      hideBelow: "lg",
      sortValue: (r) => r.elapsedMin,
      cell: (r) => <span className="text-xs tabular-nums">{r.elapsedMin}m</span>,
    },
    {
      id: "sla",
      header: "SLA",
      hideBelow: "md",
      sortValue: (r) => (r.breached ? 1 : 0),
      cell: (r) =>
        r.sla ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              r.breached ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
            )}
          >
            {r.breached ? "Breached" : "On Track"} · {r.sla}m
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "next",
      header: "Next Step",
      hideBelow: "xl",
      cell: (r) => <span className="text-xs">{r.nextStep}</span>,
    },
    {
      id: "feedback",
      header: "Feedback",
      hideBelow: "xl",
      sortValue: (r) => (r.feedbackSubmitted ? 1 : 0),
      cell: (r) =>
        r.feedbackSubmitted ? (
          <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            Submitted
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const kpis = useMemo(() => {
    const stageCount = (...stages: DeliveryStage[]) =>
      allRows.filter((r) => stages.some((s) => r.statusKey === STAGE_KEY(s))).length;
    return [
      {
        label: "Cases Waiting",
        value: allRows.filter((r) => r.phase === "Lost & Found").length,
        icon: Clock,
        tone: "amber",
      },
      {
        label: "In Storage",
        value: allRows.filter((r) => r.inStorage).length,
        icon: Warehouse,
        tone: "indigo",
      },
      {
        label: "Ready for Delivery",
        value: stageCount("Ready for Delivery", "Scheduled"),
        icon: PackageCheck,
        tone: "primary",
      },
      {
        label: "Out for Delivery",
        value: stageCount("Assigned", "Driver Accepted", "Collected Bag", "Out for Delivery"),
        icon: Truck,
        tone: "primary",
      },
      { label: "Delivered", value: stageCount("Delivered"), icon: PackageCheck, tone: "emerald" },
      {
        label: "Delayed",
        value: allRows.filter((r) => r.breached).length,
        icon: AlertTriangle,
        tone: "rose",
      },
      {
        label: "Quality Alerts",
        value: incidents.filter((i) => i.status !== "Resolved").length,
        icon: ShieldAlert,
        tone: "rose",
      },
      {
        label: "Returned",
        value: stageCount("Returned to Airport"),
        icon: RotateCcw,
        tone: "amber",
      },
    ];
  }, [allRows, incidents]);

  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-warning/15 text-warning",
    emerald: "bg-success/10 text-success",
    indigo: "bg-info/10 text-info",
    rose: "bg-destructive/10 text-destructive",
  };

  const agents = Array.from(new Set(allRows.map((r) => r.agent))).filter((d) => d && d !== "—");

  // Progressive loading: render the page shell with placeholders while this
  // screen's data tier is still in flight, instead of showing empty values.
  if (loading.core && workflow.length === 0)
    return (
      <PageLoading
        title={"Workflow Monitor"}
        subtitle={"Real-time operational board across the full delivery lifecycle."}
        kpis={5}
      />
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Workflow Monitor" icon={<GitBranch />} />

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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              placeholder="Search PIR, case, delivery ID or passenger…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9"
            />
            <Select value={driver} onValueChange={setDriver}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Delivery Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Delivery Agents</SelectItem>
                {agents.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {LF_OWNED_STATUSES.map((s) => (
                  <SelectItem key={LF_STATUS_KEY(s)} value={LF_STATUS_KEY(s)}>
                    Lost &amp; Found · {LF_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
                {DELIVERY_STAGES.map((s) => (
                  <SelectItem key={STAGE_KEY(s)} value={STAGE_KEY(s)}>
                    Delivery · {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

          <DataTable
            data={rows}
            columns={wfColumns}
            rowId={(r) => r.key}
            ariaLabel="Live workflow cases"
            searchText={(r) =>
              [r.deliveryId, r.bagId, r.passengerName, r.pirNumber, r.statusLabel, r.agent].join(
                " ",
              )
            }
            searchPlaceholder="Search live cases…"
            emptyTitle="No live cases"
            emptyDescription="No live cases match the current filters."
            pageSize={25}
          />
        </CardContent>
      </Card>
    </div>
  );
}

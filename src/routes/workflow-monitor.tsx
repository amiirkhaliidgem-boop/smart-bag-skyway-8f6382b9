import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getDeliveryStage, useStore, useOpsLoading, type BaggageCase, type Delivery, type WorkflowRecord } from "@/lib/store";
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
  type LFStatus,
} from "@/lib/lost-found/statuses";
import type { WorkflowStatus } from "@/lib/workflow/statuses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function lastTimestamp(kase?: BaggageCase, del?: Delivery, wf?: WorkflowRecord): string | undefined {
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

  const [driver, setDriver] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");

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
        wf?.status ?? (stage ? stageToWorkflow(stage) : (LF_TO_WORKFLOW[lfStatus] ?? "PIR_CREATED"));

      const lastAt = lastTimestamp(kase, del, wf);
      const elapsedMin = lastAt ? Math.max(0, Math.floor((now - new Date(lastAt).getTime()) / 60000)) : 0;
      const sla = SLA_MINUTES[workflowStatus] ?? 0;

      let nextStep = "—";
      if (stage) {
        const idx = STAGE_ORDER[stage];
        const terminal = stage === "Delivered" || stage === "Returned to Airport";
        nextStep = terminal ? "—" : (STAGE_LABELS[DELIVERY_STAGES[idx + 1]] ?? "—");
      } else {
        const idx = LF_OWNED_STATUSES.indexOf(lfStatus as (typeof LF_OWNED_STATUSES)[number]);
        const next = idx >= 0 ? LF_OWNED_STATUSES[idx + 1] : undefined;
        nextStep = next ? (LF_STATUS_LABEL[next] ?? next) : "Hand over to Delivery";
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

    return rows.sort((a, b) => new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime());
  }, [cases, deliveries, workflow, feedback, tick]);

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (driver !== "all" && r.agent !== driver) return false;
      if (statusFilter !== "all" && r.statusKey !== statusFilter) return false;
      if (q) {
        const s = q.toLowerCase();
        const hay = `${r.bagId} ${r.pirNumber} ${r.passengerName} ${r.deliveryId ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [allRows, driver, statusFilter, q]);

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
      { label: "In Storage", value: allRows.filter((r) => r.inStorage).length, icon: Warehouse, tone: "indigo" },
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
      { label: "Delayed", value: allRows.filter((r) => r.breached).length, icon: AlertTriangle, tone: "rose" },
      {
        label: "Quality Alerts",
        value: incidents.filter((i) => i.status !== "Resolved").length,
        icon: ShieldAlert,
        tone: "rose",
      },
      { label: "Returned", value: stageCount("Returned to Airport"), icon: RotateCcw, tone: "amber" },
    ];
  }, [allRows, incidents]);

  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    indigo: "bg-indigo-100 text-indigo-700",
    rose: "bg-rose-100 text-rose-700",
  };

  const agents = Array.from(new Set(allRows.map((r) => r.agent))).filter((d) => d && d !== "—");


  // Progressive loading: render the page shell with placeholders while this
  // screen's data tier is still in flight, instead of showing empty values.
  if (loading.core && workflow.length === 0)
    return <PageLoading title={"Workflow Monitor"} subtitle={"Real-time operational board across the full delivery lifecycle."} kpis={5} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <GitBranch className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Workflow Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Real-time operational board across the full delivery lifecycle.
          </p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Search PIR, case, delivery ID or passenger…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Select value={driver} onValueChange={setDriver}>
              <SelectTrigger>
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
              <SelectTrigger>
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

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Case / Delivery</th>
                  <th className="text-left px-4 py-3 font-medium">Passenger / PIR</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Delivery Agent</th>
                  <th className="text-left px-4 py-3 font-medium">Elapsed</th>
                  <th className="text-left px-4 py-3 font-medium">SLA</th>
                  <th className="text-left px-4 py-3 font-medium">Next Step</th>
                  <th className="text-left px-4 py-3 font-medium">Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                      No live cases match the current filters.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs">{r.deliveryId ?? r.bagId}</div>
                      <div className="text-[11px] text-muted-foreground">{r.phase}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.passengerName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.pirNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${r.statusColor}`}
                      >
                        {r.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.agent}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{r.elapsedMin}m</td>
                    <td className="px-4 py-3 text-xs">
                      {r.sla ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${r.breached ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
                        >
                          {r.breached ? "Breached" : "On Track"} · {r.sla}m
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.nextStep}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.feedbackSubmitted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                          Submitted
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
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

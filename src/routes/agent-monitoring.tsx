// Delivery Agent Monitoring — READ-ONLY operations surface.
//
// This screen never mutates anything: no assignment, no stage changes, no
// notifications. It projects data that already exists in the operational
// snapshot (deliveries, agent positions, engine-optimized routes) and reads
// its activity feed straight from the canonical Workflow Engine timeline
// (public.timeline_events) — there is no separate driver history.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  useStore,
  useOpsLoading,
  getDeliveryStage,
  refreshOpsSecondary,
  refreshOpsActivity,
  type Delivery,
  type DriverPosition,
  type DriverRoute,
} from "@/lib/store";
import type { TimelineEntry } from "@/lib/ops.mapping";
import { useDeliveryAgents } from "@/lib/admin/agents";
import { STAGE_LABELS, STAGE_STYLES, type DeliveryStage } from "@/lib/delivery/stages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoading } from "@/components/ops-skeleton";
import { cn } from "@/lib/utils";
import { Activity, MapPin, Radar, Route as RouteIcon, Truck, UserCheck } from "lucide-react";

export const Route = createFileRoute("/agent-monitoring")({
  head: () => ({
    meta: [
      { title: "Delivery Agent Monitoring — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Read-only live monitoring of delivery agents: status, current route, remaining stops, GPS position and Workflow Engine activity.",
      },
      { property: "og:title", content: "Delivery Agent Monitoring — IAB Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content:
          "Live operations view of delivery agent status, routes, GPS positions and workflow activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    driver: typeof search.driver === "string" && search.driver ? search.driver : undefined,
  }),
  component: AgentMonitoringPage,
});

const ACTIVE_STAGES: DeliveryStage[] = [
  "Assigned",
  "Driver Accepted",
  "Collected Bag",
  "Out for Delivery",
];

const ONLINE_WINDOW_MS = 10 * 60 * 1000;

type AgentStatus = "Online" | "Busy" | "Offline";

const STATUS_STYLES: Record<AgentStatus, string> = {
  Online: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Busy: "bg-amber-100 text-amber-700 border-amber-200",
  Offline: "bg-slate-100 text-slate-600 border-slate-200",
};

interface AgentView {
  name: string;
  employeeId?: string;
  status: AgentStatus;
  position?: DriverPosition;
  route?: DriverRoute;
  current?: Delivery;
  remaining: Delivery[];
  completedToday: number;
}

function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

function ago(iso?: string) {
  if (!iso) return "no update";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

function isToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function AgentMonitoringPage() {
  const { driver } = Route.useSearch();
  const navigate = useNavigate();
  const loading = useOpsLoading();
  const deliveries = useStore((s) => s.deliveries);
  const timeline = useStore((s) => s.timeline);
  const driverPositions = useStore((s) => s.driverPositions);
  const driverRoutes = useStore((s) => s.driverRoutes);
  const { names } = useDeliveryAgents();

  // Live updates without a manual refresh: the store already reloads on the
  // realtime `deliveries` channel; GPS positions and the engine timeline are
  // polled on a light interval while this screen is open.
  useEffect(() => {
    const id = setInterval(() => {
      void refreshOpsSecondary();
      void refreshOpsActivity();
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const agentNames = useMemo(() => {
    // Roster comes strictly from the Delivery Agent directory
    // (`list_delivery_agents` → active users holding the delivery_agent role).
    // Deliveries and GPS rows only enrich these agents — they never add names,
    // so admins/officers/coordinators can't leak into this screen.
    const set = new Set<string>(names.filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [names]);

  const selected = driver && agentNames.includes(driver) ? [driver] : agentNames;

  const views: AgentView[] = useMemo(
    () =>
      selected.map((name) => {
        const mine = deliveries.filter((d) => d.driver === name);
        const active = mine.filter((d) => ACTIVE_STAGES.includes(getDeliveryStage(d)));
        const route = driverRoutes[name];
        const position = driverPositions[name];
        const ordered = route
          ? (route.stops
              .map((no) => active.find((d) => d.deliveryId === no))
              .filter(Boolean) as Delivery[])
          : active;
        const current =
          ordered.find((d) => getDeliveryStage(d) === "Out for Delivery") ?? ordered[0];
        const fresh = position ? Date.now() - new Date(position.at).getTime() < ONLINE_WINDOW_MS : false;
        const status: AgentStatus = active.length > 0 ? "Busy" : fresh ? "Online" : "Offline";
        return {
          name,
          employeeId: undefined,
          status,
          position,
          route,
          current,
          remaining: ordered.filter((d) => d.deliveryId !== current?.deliveryId),
          completedToday: mine.filter(
            (d) => getDeliveryStage(d) === "Delivered" && isToday(d.deliveredAt ?? d.lastUpdatedAt),
          ).length,
        };
      }),
    [selected, deliveries, driverRoutes, driverPositions],
  );

  const monitoredDeliveryIds = useMemo(() => {
    const set = new Set<string>();
    deliveries.forEach((d) => {
      if (d.driver && selected.includes(d.driver)) set.add(d.deliveryId);
    });
    return set;
  }, [deliveries, selected]);

  const activity: TimelineEntry[] = useMemo(
    () =>
      timeline
        .filter((t) => !!t.deliveryId && monitoredDeliveryIds.has(t.deliveryId))
        .slice(0, 120),
    [timeline, monitoredDeliveryIds],
  );

  if (loading.core && deliveries.length === 0) {
    return <PageLoading title="Delivery Agent Monitoring" subtitle="Loading live agent operations…" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" /> Delivery Agent Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only operations view. Live agent status, routes and Workflow Engine activity.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Auto-refresh · every 15s
        </span>
      </header>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-72">
            <Label className="text-xs">Delivery Agent</Label>
            <UISelect
              value={driver ?? "__all__"}
              onValueChange={(v) =>
                navigate({
                  to: "/agent-monitoring",
                  search: { driver: v === "__all__" ? undefined : v },
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="All Delivery Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Delivery Agents</SelectItem>
                {agentNames.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </UISelect>
          </div>
          <p className="text-xs text-muted-foreground pb-2">
            Monitoring {views.length} agent{views.length === 1 ? "" : "s"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {views.map((v) => (
          <AgentCard key={v.name} view={v} />
        ))}
        {views.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No delivery agents to monitor.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Agent Activity Timeline
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Sourced from the central Workflow Engine timeline — the same log used across the system.
          </p>
        </CardHeader>
        <CardContent>
          {loading.activity && activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading activity…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No agent activity recorded for the current selection.
            </p>
          ) : (
            <ol className="relative border-l border-border pl-5 space-y-4">
              {activity.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.status && (
                      <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t.status}
                      </span>
                    )}
                  </div>
                  {t.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">{t.detail}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                    {t.deliveryId ?? t.reference} · {t.actor} · {fmtDateTime(t.at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentCard({ view }: { view: AgentView }) {
  const stage = view.current ? getDeliveryStage(view.current) : undefined;
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2 truncate">
            <UserCheck className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{view.name}</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {view.completedToday} delivered today · {view.remaining.length} remaining stop
            {view.remaining.length === 1 ? "" : "s"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] font-medium",
            STATUS_STYLES[view.status],
          )}
        >
          {view.status}
        </span>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md border border-border p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Current Delivery
          </p>
          {view.current ? (
            <div className="space-y-1">
              <p className="font-mono text-xs">{view.current.deliveryId}</p>
              <p className="text-sm">{view.current.passengerName}</p>
              <p className="text-xs text-muted-foreground">
                PIR {view.current.pirNumber || view.current.bagId}
              </p>
              {stage && (
                <span
                  className={cn(
                    "inline-block rounded border px-1.5 py-0.5 text-[11px]",
                    STAGE_STYLES[stage],
                  )}
                >
                  {STAGE_LABELS[stage]}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active delivery.</p>
          )}
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
            <RouteIcon className="h-3.5 w-3.5" /> Current Route
          </p>
          {view.route ? (
            <>
              <p className="text-xs text-muted-foreground">
                Optimized {fmtDateTime(view.route.computedAt)} · origin {view.route.origin.source}
              </p>
              <ol className="mt-1.5 space-y-1">
                {view.route.stops.map((s, i) => (
                  <li key={s} className="text-xs font-mono text-muted-foreground">
                    {i + 1}. {s}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No optimized route assigned.</p>
          )}
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Live GPS Position
          </p>
          {view.position ? (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-mono text-foreground">
                {view.position.lat.toFixed(5)}, {view.position.lng.toFixed(5)}
              </p>
              <p>
                Last update {fmtDateTime(view.position.at)} ({ago(view.position.at)})
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No position reported.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
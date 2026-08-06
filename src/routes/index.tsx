import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Luggage, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  Line,
  ComposedChart,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { KpiSkeletonGrid, ChartSkeleton, ListSkeleton } from "@/components/ops-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { loadExecutiveDashboard } from "@/lib/dashboard.functions";
import type { ExecutiveDashboard, KpiValue } from "@/lib/dashboard.server";
import { PageHeader, ErrorState } from "@/components/layout";
import {
  resolveDashboardKpis,
  formatKpiValue,
  type DashboardKpiDescriptor,
} from "@/lib/dashboard/kpis";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Executive Dashboard — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Live operational KPIs, carrier analytics and workflow trends across airport baggage operations.",
      },
      { property: "og:title", content: "Executive Dashboard — IAB Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content: "Real-time baggage operations intelligence sourced from the Workflow Engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

/* ------------------------------------------------------------------ helpers */

const iso = (d: Date) => d.toISOString().slice(0, 10);

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  return { from: iso(from), to: iso(to) };
}

const STATUS_COLORS: Record<string, string> = {
  Open: "#ef4444",
  Tracing: "#f97316",
  Located: "#f59e0b",
  "Arrived at Airport": "#3b82f6",
  "Waiting Customs Clearance": "#6366f1",
  "Ready for Delivery": "#8b5cf6",
  "Out for Delivery": "#06b6d4",
  Delivered: "#10b981",
  "Returned to Airport": "#f43f5e",
  "Ready for Airport Pickup": "#14b8a6",
  "Passenger Picked Up": "#0d9488",
};

const colorFor = (status: string) => STATUS_COLORS[status] ?? "#94a3b8";

function Delta({ delta }: { delta: number | null }) {
  if (delta === null || delta === undefined || Number.isNaN(delta))
    return <span className="text-xs font-medium text-muted-foreground">—</span>;
  const up = delta >= 0;
  return (
    <span
      className={`text-xs font-medium inline-flex items-center gap-0.5 ${
        up ? "text-[var(--success)]" : "text-destructive"
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(delta)}%
    </span>
  );
}

function KpiCard({
  label,
  kpi,
  icon: Icon,
  color,
  format,
}: {
  label: string;
  kpi: KpiValue;
  icon: typeof Luggage;
  color: string;
  format?: (v: number) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className={`h-9 w-9 rounded-lg bg-muted grid place-items-center ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <Delta delta={kpi?.delta ?? null} />
        </div>
        <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight">
          {format ? format(Number(kpi?.value ?? 0)) : Number(kpi?.value ?? 0)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------------- page */

function Index() {
  const init = useMemo(defaultRange, []);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [grain, setGrain] = useState<"day" | "week" | "month">("day");

  const fetchDashboard = useServerFn(loadExecutiveDashboard);
  const queryClient = useQueryClient();

  // The dashboard server fn requires a bearer token. During SSR and before the
  // Supabase session is restored there is none, so the query stays disabled.
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setHasSession(!!s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["executive-dashboard", from, to, grain],
    queryFn: () =>
      fetchDashboard({
        data: {
          from: new Date(`${from}T00:00:00.000Z`).toISOString(),
          // exclusive upper bound: include the whole "to" day
          to: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000).toISOString(),
          grain,
        },
      }) as Promise<ExecutiveDashboard>,
    staleTime: 30_000,
    enabled: hasSession,
  });

  // The Workflow Engine writes to these tables on every transition; any change
  // invalidates the aggregate so the dashboard reflects the new state with no
  // manual refresh logic anywhere in the UI.
  useEffect(
    () =>
      subscribeRealtime(
        [
          "baggage_cases",
          "deliveries",
          "workflow_events",
          "quality_incidents",
          "passenger_feedback",
        ],
        () => queryClient.invalidateQueries({ queryKey: ["executive-dashboard"] }),
      ),
    [queryClient],
  );

  const k = data?.kpis;
  // Registry-driven KPI cards: descriptors are merged with the keys the
  // backend actually returned, so new Workflow Engine statuses appear here
  // without any layout work.
  const kpiCards: DashboardKpiDescriptor[] = useMemo(
    () => resolveDashboardKpis(k as unknown as Record<string, unknown> | undefined),
    [k],
  );
  const statusData = (data?.byStatus ?? []).map((s) => ({ ...s, fill: colorFor(s.status) }));
  const carrierData = data?.byCarrier ?? [];
  // One unified operational pipeline across Lost & Found, Delivery and
  // Airport Pickup — the labels are the canonical lifecycle statuses.
  const funnel = (data?.funnel ?? []).map((f) => ({ ...f, label: f.status }));
  const trends = data?.trends ?? [];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        actions={
          <>
            <DateRangeFilter
              from={from}
              to={to}
              onFromChange={setFrom}
              onToChange={setTo}
              grain={grain}
              onGrainChange={setGrain}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              aria-label="Refresh dashboard"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["executive-dashboard"] })}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
      />

      {isError ? (
        <ErrorState
          title="The dashboard could not be loaded"
          description={(error as Error)?.message}
        />
      ) : null}

      {isLoading || !k ? (
        <KpiSkeletonGrid count={16} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {kpiCards.map((d) => (
            <KpiCard
              key={d.key}
              label={d.label}
              kpi={(k as unknown as Record<string, KpiValue>)[d.key]}
              icon={d.icon}
              color={d.tone}
              format={(v) => formatKpiValue(v, d.format)}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Baggage Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                    <XAxis
                      dataKey="status"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {statusData.map((d) => (
                        <Cell key={d.status} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData.filter((d) => d.count > 0)}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {statusData.map((d) => (
                        <Cell key={d.status} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cases by Carrier</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartSkeleton height="h-64" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carrierData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="airline" type="category" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey="count" fill="#1e40af" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cases Opened vs Completed Journeys</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height="h-64" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="opened"
                      name="Opened"
                      stroke="#1e40af"
                      fill="#1e40af"
                      fillOpacity={0.15}
                    />
                    <Area
                      type="monotone"
                      dataKey="delivered"
                      name="Delivered"
                      stackId="done"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.15}
                    />
                    <Area
                      type="monotone"
                      dataKey="pickedUp"
                      name="Passenger Picked Up"
                      stackId="done"
                      stroke="#0d9488"
                      fill="#0d9488"
                      fillOpacity={0.15}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Success & Quality Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height="h-64" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      yAxisId="left"
                      dataKey="incidents"
                      name="Incidents"
                      fill="#f43f5e"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="successPct"
                      name="Success %"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CSAT Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height="h-64" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="csat"
                      name="CSAT"
                      stroke="#e11d48"
                      fill="#e11d48"
                      fillOpacity={0.12}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unified Operational Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton rows={6} />
            ) : (
              <div className="space-y-2">
                {funnel.map((f) => (
                  <div key={f.status} className="flex items-center gap-3">
                    <div className="w-40 text-xs text-muted-foreground truncate">{f.label}</div>
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(f.count / funnelMax) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-right text-xs font-semibold tabular-nums">
                      {f.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

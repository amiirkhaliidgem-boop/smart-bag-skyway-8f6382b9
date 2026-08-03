import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  PackageCheck,
  RotateCcw,
  ShieldAlert,
  Star,
  Timer,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { PageLoading } from "@/components/ops-skeleton";
import { useStaffOfficers } from "@/lib/admin/officers";
import { useRole } from "@/lib/rbac";
import { loadOperationalReport, callQualityRpc } from "@/lib/reports.functions";
import type { OperationalReport } from "@/lib/reports.server";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Operational Reports — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Management reporting across delivery, Lost & Found, passenger experience and quality — sourced live from the Workflow Engine.",
      },
      { property: "og:title", content: "Operational Reports — IAB Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content: "Executive, operational and quality intelligence for airport baggage operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

/* ------------------------------------------------------------------ helpers */

const iso = (d: Date) => d.toISOString().slice(0, 10);

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  return { from: iso(from), to: iso(to) };
}

const SEVERITY_TONE: Record<string, string> = {
  High: "bg-rose-100 text-rose-700 border-rose-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATE_TONE: Record<string, string> = {
  Open: "bg-rose-100 text-rose-700 border-rose-200",
  Assigned: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Investigating: "bg-amber-100 text-amber-700 border-amber-200",
  "Under Review": "bg-amber-100 text-amber-700 border-amber-200",
  Resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const SOURCE_LABEL: Record<string, string> = {
  sla: "SLA breach",
  return: "Return to airport",
  otp: "Code lockout",
  csat: "Low rating",
  passenger: "Passenger report",
  manual: "Raised by staff",
};

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString("en-GB", { timeZone: "UTC", hour12: false }) : "—";

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Activity;
  tone?: string;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`h-9 w-9 rounded-lg grid place-items-center ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {hint ? <p className="text-[11px] text-muted-foreground mt-1">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: (string | number)[][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-4 py-3 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-4 py-8 text-center text-muted-foreground text-sm">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/40">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-4 py-2.5 ${j === 0 ? "" : "text-right tabular-nums"}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------- page */

function ReportsPage() {
  const init = useMemo(defaultRange, []);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [grain, setGrain] = useState<"day" | "week" | "month">("day");
  const [journey, setJourney] = useState<string>("all");

  const fetchReport = useServerFn(loadOperationalReport);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["operational-report", from, to, grain, journey],
    queryFn: () =>
      fetchReport({
        data: {
          from: new Date(`${from}T00:00:00.000Z`).toISOString(),
          // exclusive upper bound: include the whole "to" day
          to: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000).toISOString(),
          grain,
          journey,
        },
      }) as Promise<OperationalReport>,
    staleTime: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["operational-report"] });

  const preset = (days: number) => {
    const end = new Date();
    setTo(iso(end));
    setFrom(iso(new Date(end.getTime() - (days - 1) * 86_400_000)));
  };

  if (isLoading && !data)
    return (
      <PageLoading
        title="Operational Reports"
        subtitle="Management intelligence across the Smart Baggage Ecosystem."
        kpis={5}
      />
    );

  if (isError)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Operational Reports</h1>
        <Card>
          <CardContent className="p-6 text-sm text-rose-600">
            Could not load the report: {(error as Error)?.message ?? "unknown error"}
          </CardContent>
        </Card>
      </div>
    );

  const r = data!;
  const ex = r.executive;
  const life = r.lifecycle;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Operational Reports</h1>
            <p className="text-sm text-muted-foreground">
              Every figure is calculated by the Workflow Engine in the database — no local statistics.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => preset(1)}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => preset(7)}>
            7 days
          </Button>
          <Button variant="outline" size="sm" onClick={() => preset(30)}>
            30 days
          </Button>
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          <Select value={journey} onValueChange={setJourney}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All journeys</SelectItem>
              <SelectItem value="Home Delivery">Home Delivery</SelectItem>
              <SelectItem value="Airport Pickup">Airport Pickup</SelectItem>
            </SelectContent>
          </Select>
          <Select value={grain} onValueChange={(v) => setGrain(v as typeof grain)}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ------------------------------------------------------- executive */}
      <Section
        title="Executive Summary"
        description="Headline performance for the selected period."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <Kpi label="Cases Registered" value={ex.cases} icon={Activity} />
          <Kpi
            label="Completed Journeys"
            value={life.totals.completed}
            icon={CheckCircle2}
            tone="emerald"
            hint="Delivered + Passenger Picked Up"
          />
          <Kpi label="Delivered" value={life.totals.delivered} icon={PackageCheck} tone="emerald" />
          <Kpi
            label="Passenger Picked Up"
            value={life.totals.pickedUp}
            icon={CheckCircle2}
            tone="indigo"
          />
          <Kpi
            label="Delivery Success"
            value={`${life.totals.deliverySuccessPct}%`}
            icon={CheckCircle2}
            tone="emerald"
            hint="Home Delivery: delivered ÷ (delivered + returned)"
          />
          <Kpi
            label="Airport Pickup Success"
            value={`${life.totals.pickupSuccessPct}%`}
            icon={CheckCircle2}
            tone="indigo"
            hint="Picked up ÷ all Airport Pickup cases"
          />
          <Kpi
            label="SLA Compliance"
            value={`${ex.slaCompliancePct}%`}
            icon={Timer}
            tone={ex.slaCompliancePct >= 90 ? "emerald" : "amber"}
            hint="Deliveries with no SLA breach"
          />
          <Kpi label="CSAT" value={`${ex.csat}/5`} icon={Star} tone="amber" hint="Passenger feedback" />
          <Kpi label="Returned to Airport" value={life.totals.returned} icon={RotateCcw} tone="amber" />
          <Kpi label="Open Incidents" value={ex.openIncidents} icon={ShieldAlert} tone="rose" />
          <Kpi
            label="Avg Hours to Deliver"
            value={ex.avgHoursToDeliver}
            icon={Clock}
            tone="indigo"
            hint="Delivery created → delivered"
          />
        </div>
      </Section>

      {/* --------------------------------------------------------- trends */}
      <Section title="Trends" description="Volume, completion and quality over time.">
        <Card>
          <CardContent className="pt-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={r.trends}>
                  <defs>
                    <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e40af" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="d" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="cases" name="Cases" stroke="#1e40af" fill="url(#c)" />
                  <Area
                    type="monotone"
                    dataKey="delivered"
                    name="Delivered"
                    stackId="done"
                    stroke="#10b981"
                    fill="url(#d)"
                  />
                  <Area
                    type="monotone"
                    dataKey="pickedUp"
                    name="Passenger Picked Up"
                    stackId="done"
                    stroke="#0d9488"
                    fill="#0d9488"
                    fillOpacity={0.25}
                  />
                  <Line type="monotone" dataKey="incidents" name="Incidents" stroke="#e11d48" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* ------------------------------------------------ unified pipeline */}
      <Section
        title="Operational Pipeline"
        description="One pipeline across Lost & Found, Delivery Management and Airport Pickup."
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Current Pipeline by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={life.pipeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-20}
                    height={70}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Cases" fill="#1e40af" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* ------------------------------------------------------- delivery */}
      <Section
        title="Home Delivery Operations"
        description="Dispatch throughput and stage timing for the Home Delivery journey."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="On Time" value={r.delivery.onTime} icon={CheckCircle2} tone="emerald" />
          <Kpi label="SLA Breaches" value={r.delivery.breached} icon={AlertTriangle} tone="rose" />
          <Kpi label="First-Attempt Success" value={`${r.delivery.firstAttemptPct}%`} icon={PackageCheck} />
          <Kpi label="Deliveries Created" value={ex.deliveries} icon={Activity} tone="indigo" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Home Delivery Stages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.delivery.byStage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                    <XAxis dataKey="stage" tick={{ fontSize: 10 }} interval={0} angle={-20} height={60} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Deliveries" fill="#1e40af" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Average Minutes per Stage</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SimpleTable
                head={["Stage", "Avg minutes"]}
                rows={r.delivery.avgStageMinutes.map((s) => [s.stage, s.minutes])}
                empty="No stage transitions in this period."
              />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Return to Airport — Reasons</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SimpleTable
              head={["Reason", "Occurrences"]}
              rows={r.delivery.returnReasons.map((x) => [x.reason, x.count])}
              empty="No deliveries were returned in this period."
            />
          </CardContent>
        </Card>
      </Section>

      {/* ----------------------------------------------------- lost & found */}
      <Section title="Lost & Found" description="Intake quality and hand-over speed.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Cases Registered" value={r.lostFound.intake} icon={Activity} />
          <Kpi
            label="Incomplete Records"
            value={`${r.lostFound.incompletePct}%`}
            icon={AlertTriangle}
            tone={r.lostFound.incompletePct > 20 ? "rose" : "amber"}
          />
          <Kpi label="VIP Share" value={`${r.lostFound.vipPct}%`} icon={Star} tone="indigo" />
          <Kpi
            label="Avg Hours to Hand-Over"
            value={r.lostFound.avgHoursToReady}
            icon={Clock}
            hint="Case created → Ready for Delivery"
          />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cases by Lifecycle Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SimpleTable
              head={["Status", "Cases"]}
              rows={life.pipeline.map((x) => [x.status, x.count])}
              empty="No cases registered."
            />
          </CardContent>
        </Card>
      </Section>

      {/* --------------------------------------------- passenger experience */}
      <Section
        title="Passenger Experience"
        description="CSAT is calculated automatically from feedback submitted after delivery."
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="CSAT" value={`${r.experience.csat}/5`} icon={Star} tone="amber" />
          <Kpi label="Responses" value={r.experience.responses} icon={Activity} />
          <Kpi label="Response Rate" value={`${r.experience.responseRatePct}%`} icon={CheckCircle2} tone="indigo" />
          <Kpi label="Issue Resolved" value={`${r.experience.resolvedPct}%`} icon={CheckCircle2} tone="emerald" />
          <Kpi label="Tracking Link Opened" value={`${r.experience.linkViewRatePct}%`} icon={Activity} tone="indigo" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.experience.ratings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                    <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Responses" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notification Delivery</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SimpleTable
                head={["Channel", "Sent", "Failed", "Pending"]}
                rows={r.experience.notifications.map((n) => [n.channel, n.sent, n.failed, n.pending])}
                empty="No passenger notifications were queued in this period."
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* --------------------------------------------------------- quality */}
      <QualitySection report={r} onChanged={refresh} />

      {/* ----------------------------------------------------- performance */}
      <Section title="Performance" description="League tables across agents, officers and airlines.">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Delivery Agents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SimpleTable
                head={["Agent", "Delivered", "Returned", "CSAT", "Incidents"]}
                rows={r.performance.agents.map((a) => [
                  a.name,
                  a.delivered,
                  a.returned,
                  a.csat || "—",
                  a.incidents,
                ])}
                empty="No agent activity in this period."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Lost &amp; Found Officers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SimpleTable
                head={["Officer", "Cases", "Progressed", "Avg hrs"]}
                rows={r.performance.officers.map((o) => [o.name, o.cases, o.progressed, o.avg_hours])}
                empty="No cases were assigned to an officer in this period."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Airlines</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SimpleTable
                head={["Airline", "Cases", "Delivered", "CSAT", "Incidents"]}
                rows={r.performance.airlines.map((a) => [
                  a.name,
                  a.cases,
                  a.delivered,
                  a.csat || "—",
                  a.incidents,
                ])}
                empty="No airline activity in this period."
              />
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------- quality management */

function QualitySection({
  report,
  onChanged,
}: {
  report: OperationalReport;
  onChanged: () => void;
}) {
  const { role } = useRole();
  const canManage = role === "admin" || role === "coordinator" || role === "agent";
  const officers = useStaffOfficers();
  const callRpc = useServerFn(callQualityRpc);

  const [stateFilter, setStateFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [active, setActive] = useState<OperationalReport["quality"]["incidents"][number] | null>(null);

  const mutate = useMutation({
    mutationFn: (v: { fn: string; args: Record<string, unknown> }) => callRpc({ data: v }),
    onSuccess: () => {
      onChanged();
      setActive(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incidents = report.quality.incidents.filter((i) => {
    if (stateFilter === "open" && i.state === "Resolved") return false;
    if (stateFilter !== "open" && stateFilter !== "all" && i.state !== stateFilter) return false;
    if (severityFilter !== "all" && i.severity !== severityFilter) return false;
    if (sourceFilter !== "all" && i.source !== sourceFilter) return false;
    return true;
  });

  return (
    <Section
      title="Quality Management"
      description="Incidents are raised automatically by the Workflow Engine on SLA breaches, returns to airport, one-time-code lockouts and low passenger ratings — plus anything staff raise manually."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Raised in Period" value={report.quality.raised} icon={ShieldAlert} tone="rose" />
        <Kpi label="Currently Open" value={report.quality.open} icon={AlertTriangle} tone="amber" />
        <Kpi label="Resolved in Period" value={report.quality.resolved} icon={CheckCircle2} tone="emerald" />
        <Kpi label="Avg Hours to Resolve" value={report.quality.avgResolveHours} icon={Clock} tone="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Category</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SimpleTable
              head={["Category", "Count"]}
              rows={report.quality.byCategory.map((x) => [x.label, x.count])}
              empty="No incidents raised."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Severity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SimpleTable
              head={["Severity", "Count"]}
              rows={report.quality.bySeverity.map((x) => [x.label, x.count])}
              empty="No incidents raised."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Source</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SimpleTable
              head={["Source", "Count"]}
              rows={report.quality.bySource.map((x) => [SOURCE_LABEL[x.label] ?? x.label, x.count])}
              empty="No incidents raised."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Incident Register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open &amp; in progress</SelectItem>
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Assigned">Assigned</SelectItem>
                <SelectItem value="Investigating">Investigating</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Incident</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Reference</th>
                  <th className="text-left px-4 py-3 font-medium">Severity</th>
                  <th className="text-left px-4 py-3 font-medium">State</th>
                  <th className="text-left px-4 py-3 font-medium">Owner</th>
                  <th className="text-left px-4 py-3 font-medium">Raised</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {incidents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                      No quality incidents match the current filters.
                    </td>
                  </tr>
                )}
                {incidents.map((i) => (
                  <tr key={i.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs">{i.incident_no}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {SOURCE_LABEL[i.source] ?? i.source}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{i.category}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs">{i.delivery_no || i.reference || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{i.airline || "—"}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={SEVERITY_TONE[i.severity]}>
                        {i.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={STATE_TONE[i.state]}>
                        {i.state}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{i.assignee || "Unassigned"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(i.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => setActive(i)}>
                        {canManage ? "Manage" : "View"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <IncidentDialog
        incident={active}
        canManage={canManage}
        officers={officers}
        busy={mutate.isPending}
        onClose={() => setActive(null)}
        onAction={(fn, args) => mutate.mutate({ fn, args })}
      />
    </Section>
  );
}

function IncidentDialog({
  incident,
  canManage,
  officers,
  busy,
  onClose,
  onAction,
}: {
  incident: OperationalReport["quality"]["incidents"][number] | null;
  canManage: boolean;
  officers: { id: string; full_name: string }[];
  busy: boolean;
  onClose: () => void;
  onAction: (fn: string, args: Record<string, unknown>) => void;
}) {
  const [assignee, setAssignee] = useState("");
  const [resolution, setResolution] = useState("Corrective action taken");
  const [note, setNote] = useState("");

  if (!incident) return null;

  return (
    <Dialog open={!!incident} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{incident.incident_no}</span>
            <Badge variant="outline" className={SEVERITY_TONE[incident.severity]}>
              {incident.severity}
            </Badge>
            <Badge variant="outline" className={STATE_TONE[incident.state]}>
              {incident.state}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Field label="Category" value={incident.category} />
            <Field label="Source" value={SOURCE_LABEL[incident.source] ?? incident.source} />
            <Field label="Reference" value={incident.delivery_no || incident.reference || "—"} />
            <Field label="Airline" value={incident.airline || "—"} />
            <Field label="Delivery Agent" value={incident.agent || "—"} />
            <Field label="Owner" value={incident.assignee || "Unassigned"} />
            <Field label="Raised" value={fmtDate(incident.created_at)} />
            <Field label="Due" value={fmtDate(incident.due_at)} />
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
            {incident.description}
          </div>
        </div>

        {canManage && incident.state !== "Resolved" && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Assign owner</Label>
              <div className="flex gap-2">
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {officers.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={!assignee || busy}
                  onClick={() =>
                    onAction("qm_assign_incident", { p_incident: incident.id, p_user: assignee })
                  }
                >
                  Assign
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Resolution note</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What was found and what was done…"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Resolution category</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Corrective action taken">Corrective action taken</SelectItem>
                  <SelectItem value="Process improvement">Process improvement</SelectItem>
                  <SelectItem value="Coaching / training">Coaching / training</SelectItem>
                  <SelectItem value="No fault found">No fault found</SelectItem>
                  <SelectItem value="Duplicate">Duplicate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canManage && incident.state !== "Resolved" && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  onAction("qm_set_state", {
                    p_incident: incident.id,
                    p_state: "Investigating",
                    p_note: note,
                  })
                }
              >
                Investigating
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  onAction("qm_resolve_incident", {
                    p_incident: incident.id,
                    p_resolution_category: resolution,
                    p_note: note,
                  })
                }
              >
                Resolve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uppercase tracking-wider text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

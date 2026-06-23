import { createFileRoute } from "@tanstack/react-router";
import { useStore, type CaseStatus } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Luggage,
  AlertCircle,
  MapPin,
  PackageCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
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
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Executive Dashboard — Smart Baggage Ecosystem" },
      { name: "description", content: "Real-time KPIs across baggage operations at Cairo International Airport." },
    ],
  }),
  component: Index,
});

const STATUS_COLORS: Record<CaseStatus, string> = {
  Missing: "#ef4444",
  Located: "#f59e0b",
  Stored: "#3b82f6",
  "Ready For Delivery": "#8b5cf6",
  "Picked Up": "#14b8a6",
  "Out For Delivery": "#06b6d4",
  Delivered: "#10b981",
};

function Index() {
  const cases = useStore((s) => s.cases);
  const deliveries = useStore((s) => s.deliveries);
  const feedback = useStore((s) => s.feedback);

  const total = cases.length;
  const open = cases.filter((c) => c.status !== "Delivered").length;
  const located = cases.filter((c) =>
    ["Located", "Stored", "Ready For Delivery", "Out For Delivery", "Delivered"].includes(
      c.status,
    ),
  ).length;
  const ready = cases.filter((c) => c.status === "Ready For Delivery").length;
  const delivered = cases.filter((c) => c.status === "Delivered").length;
  const deliveredDeliveries = deliveries.filter((d) => d.status === "Delivered").length;
  const deliverySuccess = deliveries.length
    ? Math.round((deliveredDeliveries / deliveries.length) * 100)
    : 0;
  const csat = feedback.length
    ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length
    : 0;

  const resolutionHours = (() => {
    const resolved = cases.filter((c) => c.resolvedAt);
    if (resolved.length === 0) return 0;
    const total = resolved.reduce((sum, c) => {
      const start = new Date(c.createdAt).getTime();
      const end = new Date(c.resolvedAt!).getTime();
      return sum + (end - start) / 3_600_000;
    }, 0);
    return total / resolved.length;
  })();

  const statusData = (Object.keys(STATUS_COLORS) as CaseStatus[]).map((status) => ({
    status,
    count: cases.filter((c) => c.status === status).length,
    fill: STATUS_COLORS[status],
  }));

  const flightAgg = Object.entries(
    cases.reduce<Record<string, number>>((acc, c) => {
      const k = c.flightNumber.replace(/\d+$/g, "").trim() || c.flightNumber;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([airline, count]) => ({ airline, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const kpis = [
    { label: "Total Bags", value: total, icon: Luggage, trend: +12, color: "text-primary" },
    { label: "Open Cases", value: open, icon: AlertCircle, trend: -4, color: "text-amber-600" },
    { label: "Located Bags", value: located, icon: MapPin, trend: +8, color: "text-sky-600" },
    { label: "Ready for Delivery", value: ready, icon: PackageCheck, trend: +2, color: "text-violet-600" },
    { label: "Delivered Bags", value: delivered, icon: CheckCircle2, trend: +6, color: "text-emerald-600" },
    {
      label: "Avg. Resolution",
      value: `${resolutionHours.toFixed(1)}h`,
      icon: Clock,
      trend: -3,
      color: "text-indigo-600",
    },
    { label: "CSAT", value: `${csat.toFixed(1)}/5`, icon: TrendingUp, trend: +1, color: "text-rose-600" },
    { label: "Delivery Success", value: `${deliverySuccess}%`, icon: PackageCheck, trend: +3, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live baggage operations overview · Cairo International Airport
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className={`h-9 w-9 rounded-lg bg-muted grid place-items-center ${k.color}`}>
                  <k.icon className="h-4 w-4" />
                </div>
                <span
                  className={`text-xs font-medium inline-flex items-center gap-0.5 ${
                    k.trend >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {k.trend >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(k.trend)}%
                </span>
              </div>
              <p className="mt-4 text-2xl font-bold tabular-nums">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Baggage Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
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
                    height={60}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cases by Carrier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flightAgg} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="airline" type="category" tick={{ fontSize: 11 }} width={60} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="count" fill="#1e40af" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

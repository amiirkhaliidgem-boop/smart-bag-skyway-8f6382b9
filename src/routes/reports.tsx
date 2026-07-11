import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "recharts";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Smart Baggage Ecosystem" },
      { name: "description", content: "Operational reports and trends for airport baggage operations." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const cases = useStore((s) => s.cases);
  const feedback = useStore((s) => s.feedback);
  const incidents = useStore((s) => s.qualityIncidents);
  const deliveries = useStore((s) => s.deliveries);

  const delivered = deliveries.filter((d) => d.status === "Delivered").length;
  const successRate = deliveries.length
    ? Math.round((delivered / deliveries.length) * 100)
    : 0;
  const csat = feedback.length
    ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)
    : "0.0";

  const kpis = [
    { label: "Total Cases", value: cases.length, tone: "text-primary" },
    { label: "Delivered", value: delivered, tone: "text-emerald-600" },
    { label: "Delivery Success", value: `${successRate}%`, tone: "text-emerald-600" },
    { label: "CSAT", value: `${csat}/5`, tone: "text-amber-600" },
    { label: "Quality Incidents", value: incidents.length, tone: "text-rose-600" },
  ];

  const byDate = Object.entries(
    cases.reduce<Record<string, { date: string; opened: number; resolved: number }>>(
      (acc, c) => {
        const d = c.arrivalDate;
        acc[d] = acc[d] ?? { date: d, opened: 0, resolved: 0 };
        acc[d].opened += 1;
        if (c.resolvedAt) acc[d].resolved += 1;
        return acc;
      },
      {},
    ),
  )
    .map(([, v]) => v)
    .sort((a, b) => a.date.localeCompare(b.date));

  const byAirline = Object.entries(
    cases.reduce<Record<string, number>>((acc, c) => {
      const code = c.flightNumber.slice(0, 2);
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([airline, count]) => ({ airline, count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Operational Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historical trends across the baggage operation.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {k.label}
              </p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${k.tone}`}>
                {k.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cases Opened vs Resolved</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={byDate}>
                <defs>
                  <linearGradient id="o" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e40af" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="r" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="opened" stroke="#1e40af" fill="url(#o)" />
                <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="url(#r)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cases by Airline Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byAirline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                <XAxis dataKey="airline" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#1e40af" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
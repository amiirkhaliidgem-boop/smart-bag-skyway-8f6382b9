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
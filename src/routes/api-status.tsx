import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/api-status")({
  head: () => ({ meta: [{ title: "API Status — IAB Smart Baggage Ecosystem" }] }),
  component: ApiStatusPage,
});

type Health = "Operational" | "Degraded" | "Down" | "Pending";

const APIS: { name: string; version: string; health: Health; lastSync: string }[] = [
  { name: "Workflow API", version: "v2.6.0", health: "Operational", lastSync: "just now" },
  { name: "Notification API", version: "v1.4.2", health: "Operational", lastSync: "1 min ago" },
  { name: "Passenger API", version: "v1.2.0", health: "Operational", lastSync: "just now" },
  { name: "Driver API", version: "v1.1.5", health: "Operational", lastSync: "3 min ago" },
  { name: "Odoo API", version: "—", health: "Pending", lastSync: "not connected" },
  { name: "Maps API", version: "—", health: "Pending", lastSync: "not connected" },
  { name: "OTP API", version: "v1.0.0", health: "Operational", lastSync: "5 min ago" },
  { name: "Database API", version: "v14.4", health: "Operational", lastSync: "just now" },
];

function ApiStatusPage() {
  const tone: Record<Health, string> = {
    Operational: "bg-emerald-100 text-emerald-700",
    Degraded: "bg-amber-100 text-amber-700",
    Down: "bg-rose-100 text-rose-700",
    Pending: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">API Status</h1>
          <p className="text-sm text-muted-foreground">Live health and versioning for every service in the ecosystem.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {APIS.map((a) => (
          <Card key={a.name}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{a.name}</p>
                {a.health === "Operational" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium mt-3 ${tone[a.health]}`}>
                {a.health}
              </span>
              <dl className="mt-4 space-y-1 text-xs">
                <div className="flex justify-between"><dt className="text-muted-foreground">Version</dt><dd className="font-mono">{a.version}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Last sync</dt><dd>{a.lastSync}</dd></div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
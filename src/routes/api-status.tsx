import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { Radio, CheckCircle2, AlertCircle, XCircle, MinusCircle, RefreshCw, Loader2, Database } from "lucide-react";
import type { ApiHealthView } from "@/lib/system/catalog";
import { loadSystemCenter, runApiHealthSweep } from "@/lib/system.functions";

export const Route = createFileRoute("/api-status")({
  head: () => ({
    meta: [
      { title: "API Status — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Live uptime, latency and error monitoring for every internal and external API in the IAB ecosystem.",
      },
    ],
  }),
  component: ApiStatusPage,
});

const TONE: Record<ApiHealthView["status"], string> = {
  operational: "bg-emerald-100 text-emerald-700 border-emerald-200",
  degraded: "bg-amber-100 text-amber-700 border-amber-200",
  down: "bg-rose-100 text-rose-700 border-rose-200",
  not_configured: "bg-slate-100 text-slate-700 border-slate-200",
};

const LABEL: Record<ApiHealthView["status"], string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  not_configured: "Not configured",
};

function StatusIcon({ status }: { status: ApiHealthView["status"] }) {
  if (status === "operational") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "degraded") return <AlertCircle className="h-5 w-5 text-amber-500" />;
  if (status === "down") return <XCircle className="h-5 w-5 text-rose-500" />;
  return <MinusCircle className="h-5 w-5 text-slate-400" />;
}

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", { timeZone: "UTC", hour12: false });
}

function ApiStatusPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["system-center"],
    queryFn: () => loadSystemCenter(),
    refetchInterval: 30_000,
  });

  const sweep = useMutation({
    mutationFn: () => runApiHealthSweep(),
    onSuccess: (res) => {
      toast.success("Health sweep complete", { description: `${res.checked} services probed.` });
      qc.invalidateQueries({ queryKey: ["system-center"] });
    },
    onError: (e: Error) => toast.error("Health sweep failed", { description: e.message }),
  });

  const allApis = data?.apis ?? [];
  // The range scopes the board by last heartbeat; services that have never
  // reported stay visible so an unmonitored provider is never hidden.
  const apis = allApis.filter((a) => {
    if (!from && !to) return true;
    if (!a.lastHeartbeat) return true;
    const day = new Date(a.lastHeartbeat).toISOString().slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
  const db = data?.database;
  const operational = apis.filter((a) => a.status === "operational").length;
  const degraded = apis.filter((a) => a.status === "degraded").length;
  const down = apis.filter((a) => a.status === "down").length;

  const render = (list: ApiHealthView[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {list.map((a) => (
        <Card key={a.key}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm">{a.name}</p>
              <StatusIcon status={a.status} />
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium mt-3 ${TONE[a.status]}`}
            >
              {LABEL[a.status]}
            </span>
            <dl className="mt-4 space-y-1 text-xs">
              <Row label="Version" value={a.version} mono />
              <Row label="Latency" value={a.latencyMs != null ? `${a.latencyMs} ms` : "—"} />
              <Row label="Uptime 24h" value={a.uptimePct != null ? `${a.uptimePct}%` : "—"} />
              <Row label="Errors 24h" value={String(a.errorCount)} />
              <Row label="Last heartbeat" value={fmt(a.lastHeartbeat)} />
            </dl>
            {a.lastError && (
              <p className="mt-3 text-[11px] text-rose-600 line-clamp-2">{a.lastError}</p>
            )}
            {!a.lastError && a.note && (
              <p className="mt-3 text-[11px] text-muted-foreground line-clamp-3">{a.note}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">API Status</h1>
          </div>
        </div>
        <Button size="sm" onClick={() => sweep.mutate()} disabled={sweep.isPending}>
          {sweep.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Run health check
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Monitored APIs" value={apis.length} />
        <Stat label="Operational" value={operational} tone="text-emerald-600" />
        <Stat label="Degraded" value={degraded} tone="text-amber-600" />
        <Stat label="Down" value={down} tone="text-rose-600" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Internal engines</h2>
            {render(apis.filter((a) => a.kind === "internal"))}
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">External providers</h2>
            {render(apis.filter((a) => a.kind === "external"))}
          </section>
        </div>
      )}

      {db && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" /> Database
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 text-xs">
            <Cell label="Provider" value={db.provider} />
            <Cell label="Environment" value={db.environment} />
            <Cell label="Engine" value={db.version} />
            <Cell
              label="Realtime"
              value={
                db.realtimeTables == null
                  ? "—"
                  : db.realtimeTables > 0
                    ? `${db.realtimeTables} table${db.realtimeTables === 1 ? "" : "s"} published`
                    : "No published tables"
              }
            />
            <Cell
              label="Storage"
              value={
                db.buckets == null
                  ? "—"
                  : db.buckets > 0
                    ? `${db.buckets} bucket${db.buckets === 1 ? "" : "s"}`
                    : "No buckets"
              }
            />
            <Cell label="Latency" value={db.latencyMs != null ? `${db.latencyMs} ms` : "—"} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`${mono ? "font-mono" : ""} truncate`}>{value}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${tone ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5 break-words">{value}</p>
    </div>
  );
}
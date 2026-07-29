import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, useOpsLoading } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { MapPin, Truck, Clock, Navigation } from "lucide-react";
import { PageLoading } from "@/components/ops-skeleton";

export const Route = createFileRoute("/route-tracking")({
  head: () => ({ meta: [{ title: "Route Tracking — Smart Baggage Ecosystem" }] }),
  component: RouteTrackingPage,
});

function RouteTrackingPage() {
  const active = useStore((s) =>
    s.deliveries.filter(
      (d) => d.status === "Picked Up" || d.status === "Out For Delivery" || d.status === "Assigned",
    ),
  );
  const loading = useOpsLoading();
  const [selectedId, setSelectedId] = useState(active[0]?.deliveryId ?? "");
  const selected = active.find((d) => d.deliveryId === selectedId) ?? active[0];


  // Progressive loading: render the page shell with placeholders while this
  // screen's data tier is still in flight, instead of showing empty values.
  if (loading.core && active.length === 0)
    return <PageLoading title={"Live Route Tracking"} subtitle={"Monitor driver positions and estimated arrival times across Greater Cairo."} kpis={0} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Live Route Tracking</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor driver positions and estimated arrival times across Greater Cairo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Active Routes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {active.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No active routes.</p>
            )}
            {active.map((d) => (
              <button
                key={d.deliveryId}
                onClick={() => setSelectedId(d.deliveryId)}
                className={`w-full text-left rounded-md border p-3 transition-colors ${
                  selected?.deliveryId === d.deliveryId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{d.passengerName}</p>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-1">{d.deliveryId}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Truck className="h-3 w-3" /> {d.driver}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Route Map</CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground text-center py-10">Select a route to view.</p>
            ) : (
              <div className="space-y-4">
                <div className="relative h-72 rounded-lg overflow-hidden border border-border bg-[linear-gradient(135deg,#1e3a8a_0%,#0f172a_100%)]">
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 20% 30%, #60a5fa44 0px, transparent 60px), radial-gradient(circle at 70% 60%, #f59e0b33 0px, transparent 80px), linear-gradient(0deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%), linear-gradient(90deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%)",
                      backgroundSize: "100% 100%, 100% 100%, 50px 50px, 50px 50px",
                    }}
                  />
                  {selected.driverLocation && (
                    <Pin top="38%" left="28%" tone="amber" label="Delivery Agent" />
                  )}
                  {selected.destination && (
                    <Pin top="62%" left="72%" tone="emerald" label="Destination" />
                  )}
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                    <line x1="28%" y1="38%" x2="72%" y2="62%" stroke="#fff" strokeWidth="2" strokeDasharray="6 6" opacity="0.7" />
                  </svg>
                  <div className="absolute top-3 left-3 text-[10px] text-white/70 uppercase tracking-widest">
                    CAI · Live
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Info icon={<Truck />} label="Delivery Agent Location" value={selected.driverLocation?.label ?? "Awaiting pickup"} />
                  <Info icon={<MapPin />} label="Destination" value={selected.destination?.label ?? selected.address} />
                  <Info icon={<Clock />} label="ETA" value={new Date(selected.eta).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
                </div>

                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Trip Detail</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <Stat label="Passenger" value={selected.passengerName} />
                    <Stat label="Bag" value={selected.bagId} mono />
                    <Stat label="Delivery Agent" value={selected.driver} />
                    <Stat label="Priority" value={selected.priority} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Pin({ top, left, tone, label }: { top: string; left: string; tone: "amber" | "emerald"; label: string }) {
  const colors = tone === "amber" ? "bg-amber-400 text-amber-950" : "bg-emerald-400 text-emerald-950";
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top, left }}>
      <div className={`h-7 w-7 rounded-full grid place-items-center shadow-lg ring-4 ring-white/20 ${colors}`}>
        <Navigation className="h-3.5 w-3.5" />
      </div>
      <p className="mt-1 text-[10px] text-white text-center font-medium">{label}</p>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3 flex items-start gap-3">
      <div className="h-8 w-8 rounded bg-primary/10 text-primary grid place-items-center shrink-0">
        <div className="h-4 w-4">{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
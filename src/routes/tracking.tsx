import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, type BaggageCase } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Search, MapPin, Package, Truck, CheckCircle2, AlertCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/tracking")({
  head: () => ({
    meta: [
      { title: "Passenger Tracking — Smart Baggage Ecosystem" },
      { name: "description", content: "Track your delayed baggage using your PIR number." },
    ],
  }),
  component: TrackingPage,
});

const TIMELINE = [
  { key: "Missing", label: "Reported Missing", icon: AlertCircle },
  { key: "Located", label: "Located", icon: Search },
  { key: "Stored", label: "Stored at Warehouse", icon: Package },
  { key: "Ready For Delivery", label: "Ready for Delivery", icon: MapPin },
  { key: "Out For Delivery", label: "Out for Delivery", icon: Truck },
  { key: "Delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

function TrackingPage() {
  const cases = useStore((s) => s.cases);
  const deliveries = useStore((s) => s.deliveries);
  const [pir, setPir] = useState("");
  const [result, setResult] = useState<BaggageCase | null | undefined>(undefined);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const found = cases.find(
      (c) => c.pirNumber.toLowerCase() === pir.trim().toLowerCase(),
    );
    setResult(found ?? null);
  }

  const stepIndex = result
    ? TIMELINE.findIndex((t) => t.key === result.status)
    : -1;
  const delivery = result
    ? deliveries.find((d) => d.bagId === result.bagId)
    : undefined;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Track Your Baggage</h1>
        <p className="text-sm text-muted-foreground">
          Enter the PIR number from your baggage irregularity report.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={search} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={pir}
                onChange={(e) => setPir(e.target.value)}
                placeholder="e.g. CAIMS12045"
                className="pl-9 h-11"
              />
            </div>
            <Button type="submit" className="h-11 sm:px-8">Track</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            Demo PIRs: <span className="font-mono">CAIMS12045</span>,{" "}
            <span className="font-mono">CAITK13902</span>,{" "}
            <span className="font-mono">CAILH40118</span>
          </p>
        </CardContent>
      </Card>

      {result === null && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">No case found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please verify the PIR number or contact our baggage desk.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Bag ID</p>
                <p className="text-xl font-bold font-mono text-primary">{result.bagId}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Passenger: <span className="text-foreground font-medium">{result.passengerName}</span>
                </p>
              </div>
              <StatusBadge status={result.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoTile label="Flight" value={result.flightNumber} />
              <InfoTile label="Arrival Date" value={result.arrivalDate} />
              <InfoTile
                label="Storage Area"
                value={
                  result.storage
                    ? `Zone ${result.storage.zone} · Shelf ${result.storage.shelf} · Pos ${result.storage.position}`
                    : "—"
                }
              />
            </div>

            {delivery && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Delivery</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> {delivery.driver}</div>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {delivery.driverLocation?.label ?? "Awaiting pickup"}</div>
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> ETA {new Date(delivery.eta).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Progress</p>
              <ol className="relative space-y-4">
                {TIMELINE.map((step, i) => {
                  const reached = i <= stepIndex;
                  const current = i === stepIndex;
                  return (
                    <li key={step.key} className="flex items-start gap-3">
                      <div
                        className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${
                          reached
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        } ${current ? "ring-4 ring-primary/20" : ""}`}
                      >
                        <step.icon className="h-4 w-4" />
                      </div>
                      <div className="pt-1">
                        <p className={`text-sm font-medium ${reached ? "" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {current && (
                          <p className="text-xs text-muted-foreground mt-0.5">Current stage</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, updateCase, assignStorage, type BaggageCase, type CaseStatus } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { QRCode } from "@/components/qr-code";
import { QrCode, ScanLine, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/qr-scan")({
  head: () => ({ meta: [{ title: "QR Scan — Smart Baggage Ecosystem" }] }),
  component: QrScanPage,
});

const STATUSES: CaseStatus[] = [
  "Missing",
  "Located",
  "Stored",
  "Ready For Delivery",
  "Out For Delivery",
  "Delivered",
];

function QrScanPage() {
  const cases = useStore((s) => s.cases);
  const [query, setQuery] = useState("");
  const [scanned, setScanned] = useState<BaggageCase | null>(null);

  function lookup(term: string) {
    const t = term.trim().toLowerCase();
    if (!t) return;
    const found = cases.find(
      (c) =>
        c.bagId.toLowerCase() === t ||
        c.pirNumber.toLowerCase() === t ||
        c.passengerName.toLowerCase().includes(t),
    );
    if (found) {
      setScanned(found);
      toast.success(`Loaded ${found.bagId}`);
    } else {
      setScanned(null);
      toast.error("No matching record");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">QR Scan & Lookup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scan or enter a Bag ID, PIR, or passenger to open a record and update its status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4" /> Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-square rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 grid place-items-center relative overflow-hidden">
              <QrCode className="h-20 w-20 text-primary/30" />
              <span className="absolute inset-x-4 top-1/2 h-0.5 bg-accent animate-pulse" />
              <p className="absolute bottom-3 text-[11px] text-muted-foreground">
                Aim camera at baggage QR tag
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookup(query);
              }}
              className="flex gap-2"
            >
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="BAG-100231 or PIR…"
              />
              <Button type="submit" size="icon"><Search className="h-4 w-4" /></Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Baggage Record</CardTitle>
          </CardHeader>
          <CardContent>
            {!scanned ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No record scanned yet.
              </p>
            ) : (
              <RecordEditor c={scanned} onChange={setScanned} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecordEditor({
  c,
  onChange,
}: {
  c: BaggageCase;
  onChange: (c: BaggageCase) => void;
}) {
  const [zone, setZone] = useState(c.storage?.zone ?? "");
  const [shelf, setShelf] = useState(c.storage?.shelf ?? "");
  const [position, setPosition] = useState(c.storage?.position ?? "");

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
      <div className="space-y-2 text-center">
        <div className="inline-block bg-white p-2 rounded-lg ring-1 ring-border">
          <QRCode value={c.bagId} size={160} />
        </div>
        <p className="font-mono text-xs font-semibold text-primary">{c.bagId}</p>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-semibold">{c.passengerName}</p>
            <p className="text-xs text-muted-foreground">
              {c.flightNumber} · PIR {c.pirNumber}
            </p>
          </div>
          <StatusBadge status={c.status} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={c.status}
              onChange={(e) => {
                const status = e.target.value as CaseStatus;
                updateCase(c.bagId, { status });
                onChange({ ...c, status });
                toast.success(`Status → ${status}`);
              }}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Input value={c.contact} readOnly className="font-mono text-xs" />
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Storage Location
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Zone" value={zone} onChange={(e) => setZone(e.target.value)} />
            <Input placeholder="Shelf" value={shelf} onChange={(e) => setShelf(e.target.value)} />
            <Input placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (!zone || !shelf || !position) {
                toast.error("All storage fields required");
                return;
              }
              assignStorage(c.bagId, { zone, shelf, position });
              onChange({ ...c, storage: { zone, shelf, position }, status: "Stored" });
              toast.success(`Stored at ${zone}-${shelf}-${position}`);
            }}
          >
            Update Storage
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{c.description}</p>
      </div>
    </div>
  );
}
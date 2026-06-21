import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStore,
  updateDelivery,
  addDelivery,
  driverPool,
  type DeliveryStatus,
} from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { Truck, Plus } from "lucide-react";
import { toast } from "sonner";

const STATUSES: DeliveryStatus[] = ["Pending", "Assigned", "Out For Delivery", "Delivered"];

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery Management — Smart Baggage Ecosystem" },
      { name: "description", content: "Schedule and dispatch home baggage delivery." },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const deliveries = useStore((s) => s.deliveries);
  const [open, setOpen] = useState(false);

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = deliveries.filter((d) => d.status === s).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Home Baggage Delivery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Coordinate last-mile delivery to passenger addresses across Greater Cairo.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Schedule Delivery</Button>
          </DialogTrigger>
          <NewDeliveryDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUSES.map((s) => (
          <Card key={s}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s}</p>
                <p className="text-xl font-bold tabular-nums">{counts[s] ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Deliveries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Delivery ID</th>
                  <th className="text-left px-4 py-3 font-medium">Bag</th>
                  <th className="text-left px-4 py-3 font-medium">Passenger</th>
                  <th className="text-left px-4 py-3 font-medium">Address</th>
                  <th className="text-left px-4 py-3 font-medium">Driver</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.map((d) => (
                  <tr key={d.deliveryId} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{d.deliveryId}</td>
                    <td className="px-4 py-3 font-mono text-xs">{d.bagId}</td>
                    <td className="px-4 py-3">{d.passengerName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">{d.address}</td>
                    <td className="px-4 py-3">{d.driver}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={d.status}
                        onChange={(e) => {
                          const next = e.target.value as DeliveryStatus;
                          const driver =
                            next !== "Pending" && d.driver === "—"
                              ? driverPool[Math.floor(Math.random() * driverPool.length)]
                              : d.driver;
                          updateDelivery(d.deliveryId, { status: next, driver });
                          toast.success(`${d.deliveryId} → ${next}`);
                        }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No deliveries scheduled.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NewDeliveryDialog({ onClose }: { onClose: () => void }) {
  const readyCases = useStore((s) =>
    s.cases.filter(
      (c) => c.status === "Ready For Delivery" || c.status === "Stored",
    ),
  );
  const [bagId, setBagId] = useState(readyCases[0]?.bagId ?? "");
  const [address, setAddress] = useState("");
  const [driver, setDriver] = useState(driverPool[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = readyCases.find((x) => x.bagId === bagId);
    if (!c) {
      toast.error("Please select a bag.");
      return;
    }
    if (!address.trim()) {
      toast.error("Address is required.");
      return;
    }
    const d = addDelivery({
      bagId: c.bagId,
      passengerName: c.passengerName,
      address,
      status: "Assigned",
      driver,
    });
    toast.success(`Scheduled ${d.deliveryId} for ${c.passengerName}`);
    onClose();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Schedule Home Delivery</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Baggage</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={bagId}
            onChange={(e) => setBagId(e.target.value)}
          >
            {readyCases.length === 0 && <option value="">No eligible bags</option>}
            {readyCases.map((c) => (
              <option key={c.bagId} value={c.bagId}>
                {c.bagId} · {c.passengerName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Delivery Address</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, district, governorate"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Assigned Driver</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
          >
            {driverPool.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Schedule Delivery</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
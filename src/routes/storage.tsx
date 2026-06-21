import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, assignStorage } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { Warehouse, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/storage")({
  head: () => ({
    meta: [
      { title: "Storage Control — Smart Baggage Ecosystem" },
      { name: "description", content: "Assign and manage warehouse storage locations for located bags." },
    ],
  }),
  component: StoragePage,
});

function StoragePage() {
  const cases = useStore((s) => s.cases);
  const [editing, setEditing] = useState<string | null>(null);

  const stored = cases.filter((c) => c.storage);
  const unassigned = cases.filter((c) => !c.storage);

  const zoneCounts = stored.reduce<Record<string, number>>((acc, c) => {
    if (c.storage) acc[c.storage.zone] = (acc[c.storage.zone] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Storage Control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Warehouse zone, shelf and position assignment for all located baggage.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["A", "B", "C", "D"].map((z) => (
          <Card key={z}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Warehouse className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Zone {z}</p>
                <p className="text-xl font-bold tabular-nums">{zoneCounts[z] ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {unassigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Assignment ({unassigned.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Bag ID</th>
                    <th className="text-left px-4 py-3 font-medium">Passenger</th>
                    <th className="text-left px-4 py-3 font-medium">Flight</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {unassigned.map((c) => (
                    <tr key={c.bagId} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{c.bagId}</td>
                      <td className="px-4 py-3">{c.passengerName}</td>
                      <td className="px-4 py-3 font-medium">{c.flightNumber}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditing(c.bagId)}>
                          Assign Location
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stored Baggage ({stored.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Bag ID</th>
                  <th className="text-left px-4 py-3 font-medium">Passenger</th>
                  <th className="text-left px-4 py-3 font-medium">Zone</th>
                  <th className="text-left px-4 py-3 font-medium">Shelf</th>
                  <th className="text-left px-4 py-3 font-medium">Position</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stored.map((c) => (
                  <tr key={c.bagId} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{c.bagId}</td>
                    <td className="px-4 py-3">{c.passengerName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                        <MapPin className="h-3 w-3" /> {c.storage!.zone}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.storage!.shelf}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.storage!.position}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(c.bagId)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <AssignDialog bagId={editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

function AssignDialog({ bagId, onClose }: { bagId: string; onClose: () => void }) {
  const c = useStore((s) => s.cases.find((x) => x.bagId === bagId));
  const [zone, setZone] = useState(c?.storage?.zone ?? "A");
  const [shelf, setShelf] = useState(c?.storage?.shelf ?? "");
  const [position, setPosition] = useState(c?.storage?.position ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    assignStorage(bagId, { zone, shelf, position });
    toast.success(`Assigned ${bagId} → Zone ${zone} · Shelf ${shelf} · Pos ${position}`);
    onClose();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Assign Storage Location</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Bag <span className="font-mono font-semibold text-primary">{bagId}</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Zone</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              {["A", "B", "C", "D"].map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Shelf</Label>
            <Input value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="03" required />
          </div>
          <div className="space-y-1.5">
            <Label>Position</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="12" required />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save Location</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
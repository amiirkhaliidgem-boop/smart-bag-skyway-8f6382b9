import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, addCase, type BaggageCase } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/lost-found")({
  head: () => ({
    meta: [
      { title: "Lost & Found — Smart Baggage Ecosystem" },
      { name: "description", content: "Register and manage lost baggage cases." },
    ],
  }),
  component: LostFoundPage,
});

function LostFoundPage() {
  const cases = useStore((s) => s.cases);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) =>
      [c.bagId, c.passengerName, c.flightNumber, c.pirNumber, c.bagTagNumber, c.email]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [cases, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Lost &amp; Found Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register new PIR cases and search the central baggage registry.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Register New Case
            </Button>
          </DialogTrigger>
          <NewCaseDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base">Baggage Registry</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, PIR, tag…"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Bag ID</th>
                  <th className="text-left px-4 py-3 font-medium">Passenger</th>
                  <th className="text-left px-4 py-3 font-medium">Flight</th>
                  <th className="text-left px-4 py-3 font-medium">PIR</th>
                  <th className="text-left px-4 py-3 font-medium">Tag</th>
                  <th className="text-left px-4 py-3 font-medium">Arrival</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <Row key={c.bagId} c={c} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No matching baggage cases.
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

function Row({ c }: { c: BaggageCase }) {
  return (
    <tr className="hover:bg-muted/40">
      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{c.bagId}</td>
      <td className="px-4 py-3">
        <div className="font-medium">{c.passengerName}</div>
        <div className="text-xs text-muted-foreground">{c.email}</div>
      </td>
      <td className="px-4 py-3 font-medium">{c.flightNumber}</td>
      <td className="px-4 py-3 font-mono text-xs">{c.pirNumber}</td>
      <td className="px-4 py-3 font-mono text-xs">{c.bagTagNumber}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{c.arrivalDate}</td>
      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
    </tr>
  );
}

function NewCaseDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    passengerName: "",
    flightNumber: "",
    pirNumber: "",
    bagTagNumber: "",
    arrivalDate: new Date().toISOString().slice(0, 10),
    contact: "",
    email: "",
    description: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.passengerName.trim() || !form.pirNumber.trim()) {
      toast.error("Passenger name and PIR number are required.");
      return;
    }
    const created = addCase(form);
    toast.success(`Case registered · ${created.bagId}`);
    onClose();
  }

  const fields: Array<[keyof typeof form, string, string?]> = [
    ["passengerName", "Passenger Name"],
    ["flightNumber", "Flight Number", "e.g. MS985"],
    ["pirNumber", "PIR Number", "e.g. CAIMS12045"],
    ["bagTagNumber", "Bag Tag Number"],
    ["arrivalDate", "Arrival Date"],
    ["contact", "Contact Number"],
    ["email", "Email"],
  ];

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Register New Baggage Case</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(([k, label, ph]) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={k}>{label}</Label>
            <Input
              id={k}
              type={k === "arrivalDate" ? "date" : k === "email" ? "email" : "text"}
              value={form[k]}
              placeholder={ph}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              required={k === "passengerName" || k === "pirNumber"}
            />
          </div>
        ))}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Baggage Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Color, brand, size, distinguishing marks…"
            rows={3}
          />
        </div>
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Register Case</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStore,
  driverPool,
  assignDriver,
  resendOtp,
  createTestNotification,
  ensurePassengerToken,
  getDeliveryStage,
  addDeliveryNote,
  type Delivery,
  type BaggageCase,
} from "@/lib/store";
import {
  STAGE_LABELS,
  STAGE_STYLES,
  actionsForStage,
  type DeliveryStage,
} from "@/lib/delivery/stages";
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
import {
  ArrowLeft,
  UserCheck,
  Repeat,
  Printer,
  Bell,
  Navigation,
  StickyNote,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PodPrintHost, podPrintBus } from "@/components/delivery/pod-print-host";

export const Route = createFileRoute("/delivery/$deliveryId")({
  head: ({ params }) => ({
    meta: [
      { title: `Delivery ${params.deliveryId} — Dispatch Center` },
      { name: "description", content: "Delivery details, dispatch actions, and passenger coordination." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeliveryDetails,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <h1 className="text-xl font-semibold">Delivery not found</h1>
      <Link to="/delivery" className="text-primary hover:underline text-sm">
        ← Back to Dispatch Center
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-10 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
      <Link to="/delivery" className="text-primary hover:underline text-sm">
        ← Back to Dispatch Center
      </Link>
    </div>
  ),
});

type Tab = "overview" | "passenger" | "delivery" | "notes" | "notifications";

function DeliveryDetails() {
  const { deliveryId } = Route.useParams();
  const delivery = useStore((s) => s.deliveries.find((d) => d.deliveryId === deliveryId));
  const notifications = useStore((s) =>
    s.notifications.filter((n) => n.deliveryId === deliveryId),
  );
  const kase = useStore((s) => s.cases.find((c) => c.bagId === delivery?.bagId));

  const [tab, setTab] = useState<Tab>("overview");
  const [assignOpen, setAssignOpen] = useState(false);

  if (!delivery) throw notFound();
  const stage = getDeliveryStage(delivery);
  const acts = actionsForStage(stage);
  const mapsHref = delivery.destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${delivery.destination.lat},${delivery.destination.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.address)}`;

  return (
    <div className="space-y-6">
      <Link to="/delivery" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Dispatch Center
      </Link>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-mono">{delivery.deliveryId}</h1>
                {delivery.priority === "VIP" && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">VIP</span>
                )}
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium", STAGE_STYLES[stage])}>
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {delivery.passengerName} · PIR <span className="font-mono">{delivery.pirNumber}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(acts.assign || acts.reassign) && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAssignOpen(true)}>
                  <UserCheck className="h-3.5 w-3.5" />
                  {acts.reassign ? "Reassign" : "Assign"}
                </Button>
              )}
              {acts.resendOtp && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    resendOtp(deliveryId, { actor: "Delivery Coordinator" });
                    toast.success("Passenger Portal link resent");
                  }}
                >
                  <Repeat className="h-3.5 w-3.5" /> Resend OTP
                </Button>
              )}
              {acts.notify && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    ensurePassengerToken(deliveryId);
                    const events = createTestNotification({
                      deliveryId,
                      channel: "sms",
                      operator: "Delivery Coordinator",
                    });
                    toast.success(events.length ? "Passenger notified" : "No template available");
                  }}
                >
                  <Bell className="h-3.5 w-3.5" /> Notify Passenger
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const token = ensurePassengerToken(deliveryId);
                  if (!token) {
                    toast.error("Unable to open Passenger Portal");
                    return;
                  }
                  window.open(`/passenger/${token}`, "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" /> View Passenger Portal
              </Button>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted"
              >
                <Navigation className="h-3.5 w-3.5" /> Open Navigation
              </a>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => podPrintBus.print([deliveryId])}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <Field label="Driver" value={delivery.driver && delivery.driver !== "—" ? delivery.driver : "Unassigned"} />
            <Field label="Priority" value={delivery.priority} />
            <Field label="Last Updated" value={fmt(delivery.lastUpdatedAt ?? "")} />
            <Field label="OTP Status" value={delivery.otpStatus} />
          </div>
        </CardContent>
      </Card>

      <div className="border-b border-border">
        <nav className="flex flex-wrap gap-1">
          {(["overview", "passenger", "delivery", "notes", "notifications"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === "overview" && <OverviewTab d={delivery} kase={kase} />}
      {tab === "passenger" && <PassengerTab d={delivery} kase={kase} />}
      {tab === "delivery" && <DeliveryTab d={delivery} />}
      {tab === "notes" && <NotesTab d={delivery} />}
      {tab === "notifications" && <NotificationsTab notifications={notifications} />}

      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} delivery={delivery} />
      <PodPrintHost />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function fmt(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}

function OverviewTab({ d, kase }: { d: Delivery; kase?: BaggageCase }) {
  const bagTag =
    kase?.baggage?.bagTags?.filter(Boolean).join(", ") ||
    kase?.bagTagNumber ||
    "—";
  const airline = kase?.flight?.airline ?? "—";
  const flight = kase?.flightNumber ?? "—";
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Baggage</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1 pt-0">
          <Row label="PIR" value={<span className="font-mono">{d.pirNumber}</span>} />
          <Row label="Bag ID" value={<span className="font-mono">{d.bagId}</span>} />
          <Row label="Bag Tag" value={<span className="font-mono">{bagTag}</span>} />
          <Row label="Airline" value={airline} />
          <Row label="Flight" value={<span className="font-mono">{flight}</span>} />
          {kase?.description && (
            <Row label="Description" value={<span className="text-xs">{kase.description}</span>} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Delivery</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1 pt-0">
          <Row label="Passenger" value={d.passengerName} />
          <Row label="Address" value={<span className="text-xs">{d.address}</span>} />
          <Row label="Priority" value={d.priority} />
          <Row label="Driver" value={d.driver && d.driver !== "—" ? d.driver : "Unassigned"} />
        </CardContent>
      </Card>
    </div>
  );
}

function PassengerTab({ d, kase }: { d: Delivery; kase?: BaggageCase }) {
  const k = kase as any;
  return (
    <Card>
      <CardContent className="p-4 text-sm space-y-1">
        <Row label="Name" value={d.passengerName} />
        <Row label="Mobile" value={<span className="font-mono">{d.mobile}</span>} />
        {k?.email && <Row label="Email" value={k.email} />}
        {k?.passenger?.nationality && <Row label="Nationality" value={k.passenger.nationality} />}
        {k?.passenger?.passportNumber && <Row label="Passport" value={<span className="font-mono">{k.passenger.passportNumber}</span>} />}
        {k?.passenger?.preferredLanguage && <Row label="Language" value={k.passenger.preferredLanguage} />}
      </CardContent>
    </Card>
  );
}

function DeliveryTab({ d }: { d: Delivery }) {
  return (
    <Card>
      <CardContent className="p-4 text-sm space-y-1">
        <Row label="Address" value={d.address} />
        <Row label="OTP Code" value={<span className="font-mono">{d.otpCode}</span>} />
        <Row label="OTP Status" value={d.otpStatus} />
        <Row label="Accepted At" value={fmt(d.acceptedAt)} />
        <Row label="Collected At" value={fmt(d.collectedAt)} />
        <Row label="Delivered At" value={fmt(d.deliveredAt)} />
        {d.failureReason && <Row label="Failure Reason" value={d.failureReason} />}
      </CardContent>
    </Card>
  );
}

function NotificationsTab({ notifications }: { notifications: any[] }) {
  if (!notifications.length) {
    return <p className="text-sm text-muted-foreground">No notifications for this delivery.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">At</th>
              <th className="text-left px-3 py-2 font-medium">Channel</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {notifications.map((n) => (
              <tr key={n.id}>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(n.createdAt)}</td>
                <td className="px-3 py-2 text-xs uppercase">{n.channel} · {n.locale}</td>
                <td className="px-3 py-2 text-xs">{n.status_}</td>
                <td className="px-3 py-2 text-xs truncate max-w-md">{n.message?.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  delivery,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  delivery: Delivery;
}) {
  const [driver, setDriver] = useState(
    delivery.driver && delivery.driver !== "—" ? delivery.driver : driverPool[0],
  );
  function submit(e: React.FormEvent) {
    e.preventDefault();
    assignDriver(delivery.deliveryId, driver, { actor: "Delivery Coordinator" });
    toast.success(`${delivery.deliveryId} assigned to ${driver}`);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {delivery.driver && delivery.driver !== "—" ? "Reassign Driver" : "Assign Driver"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Driver</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            >
              {driverPool.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Confirm</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotesTab({ d }: { d: Delivery }) {
  const [text, setText] = useState("");
  const notes = d.notes ?? [];
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = addDeliveryNote(d.deliveryId, text, {
      actor: "Delivery Coordinator",
      role: "DeliveryCoordinator",
    });
    if (n) {
      setText("");
      toast.success("Note added");
    }
  }
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <form onSubmit={submit} className="flex gap-2 items-start">
          <div className="flex-1 space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StickyNote className="h-3.5 w-3.5" /> Internal note
            </Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a coordinator-only note about this delivery…"
            />
          </div>
          <Button type="submit" size="sm" disabled={!text.trim()} className="mt-6">
            Add
          </Button>
        </form>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No internal notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes
              .slice()
              .reverse()
              .map((n) => (
                <li key={n.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.text}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {fmt(n.at)} · {n.actor}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

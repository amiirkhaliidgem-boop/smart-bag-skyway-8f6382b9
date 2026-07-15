import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  driverPool,
  assignDriver,
  setDeliveryStage,
  generateOtp,
  resendOtp,
  closeDelivery,
  createTestNotification,
  ensurePassengerToken,
  getDeliveryStage,
  driverAccept,
  driverReject,
  driverCollect,
  driverStartTrip,
  driverMarkDelivered,
  markDeliveryFailed,
  markReturnedToAirport,
  rescheduleDelivery,
  type Delivery,
} from "@/lib/store";
import {
  DELIVERY_STAGES,
  STAGE_LABELS,
  STAGE_STYLES,
  FAILURE_REASONS,
  actionsForStage,
  type FailureReason,
  type DeliveryStage,
} from "@/lib/delivery/stages";
import { WORKFLOW_LABELS } from "@/lib/workflow/statuses";
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
  ShieldCheck,
  Send,
  Printer,
  Download,
  XCircle,
  Bell,
  Truck,
  Navigation,
  CheckCircle2,
  Ban,
  Package,
  Undo2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

type Tab = "overview" | "passenger" | "delivery" | "timeline" | "notifications" | "audit" | "history";

function DeliveryDetails() {
  const { deliveryId } = Route.useParams();
  const delivery = useStore((s) => s.deliveries.find((d) => d.deliveryId === deliveryId));
  const workflow = useStore((s) => s.workflow.find((w) => w.deliveryId === deliveryId));
  const notifications = useStore((s) =>
    s.notifications.filter((n) => n.deliveryId === deliveryId),
  );
  const audit = useStore((s) =>
    s.audit.filter((a) => a.entityId === deliveryId || a.entityId === delivery?.bagId),
  );
  const kase = useStore((s) => s.cases.find((c) => c.bagId === delivery?.bagId));

  const [tab, setTab] = useState<Tab>("overview");
  const [assignOpen, setAssignOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);

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
              {acts.driverAccept && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    driverAccept(deliveryId, { actor: delivery.driver || "Driver", role: "Driver" });
                    toast.success("Driver accepted");
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Driver Accept
                </Button>
              )}
              {acts.driverReject && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    driverReject(deliveryId, { actor: delivery.driver || "Driver", role: "Driver" });
                    toast.message("Driver rejected — back to Scheduled");
                  }}
                >
                  <Ban className="h-3.5 w-3.5" /> Driver Reject
                </Button>
              )}
              {acts.collect && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    driverCollect(deliveryId, { actor: delivery.driver || "Driver", role: "Driver" });
                    toast.success("Bag collected");
                  }}
                >
                  <Package className="h-3.5 w-3.5" /> Collect
                </Button>
              )}
              {acts.startTrip && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    driverStartTrip(deliveryId, { actor: delivery.driver || "Driver", role: "Driver" });
                    toast.success("Out for delivery");
                  }}
                >
                  <Truck className="h-3.5 w-3.5" /> Start Trip
                </Button>
              )}
              {acts.markDelivered && (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5"
                  onClick={() => {
                    driverMarkDelivered(deliveryId, { actor: delivery.driver || "Driver", role: "Driver" });
                    toast.success("Marked delivered");
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark Delivered
                </Button>
              )}
              {acts.markFailed && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFailOpen(true)}>
                  <XCircle className="h-3.5 w-3.5" /> Mark Failed
                </Button>
              )}
              {acts.markReturned && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    markReturnedToAirport(deliveryId, { actor: "Delivery Coordinator", role: "DeliveryCoordinator" });
                    toast.success("Returned to Airport");
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" /> Returned to Airport
                </Button>
              )}
              {acts.reschedule && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    rescheduleDelivery(deliveryId, { actor: "Delivery Coordinator", role: "DeliveryCoordinator" });
                    toast.success("Back in Ready for Delivery queue");
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reschedule
                </Button>
              )}
              {acts.generateOtp && (
                <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const code = generateOtp(deliveryId, { actor: "Delivery Coordinator" });
                  toast.success(`OTP generated: ${code}`);
                }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Generate OTP
                </Button>
              )}
              {acts.resendOtp && (
                <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const code = resendOtp(deliveryId, { actor: "Delivery Coordinator" });
                  toast.success(code ? `OTP resent: ${code}` : "OTP unavailable");
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
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted"
              >
                <Navigation className="h-3.5 w-3.5" /> Open Navigation
              </a>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(delivery, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${delivery.deliveryId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              {acts.close && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    closeDelivery(deliveryId, { actor: "Delivery Coordinator", role: "DeliveryCoordinator" });
                    toast.success("Delivery closed");
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" /> Close
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
            <Field label="Driver" value={delivery.driver && delivery.driver !== "—" ? delivery.driver : "Unassigned"} />
            <Field label="Station" value={delivery.station ?? "—"} />
            <Field label="Type" value={delivery.deliveryType ?? "Home Delivery"} />
            <Field label="Priority" value={delivery.priority} />
            <Field label="Created" value={fmt(delivery.createdAt ?? delivery.eta)} />
            <Field label="Last Updated" value={fmt(delivery.lastUpdatedAt ?? delivery.eta)} />
            <Field label="ETA" value={fmt(delivery.eta)} />
            <Field label="OTP Status" value={delivery.otpStatus} />
          </div>
        </CardContent>
      </Card>

      {/* Stage advancement */}
      <Card>
        <CardHeader><CardTitle className="text-base">Advance Stage</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 flex flex-wrap gap-2">
          {DELIVERY_STAGES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === stage ? "default" : "outline"}
              onClick={() => {
                if (s === "Delivery Failed") { setFailOpen(true); return; }
                setDeliveryStage(deliveryId, s, { actor: "Delivery Coordinator" });
                toast.success(`Stage → ${STAGE_LABELS[s]}`);
              }}
            >
              {STAGE_LABELS[s]}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="border-b border-border">
        <nav className="flex flex-wrap gap-1">
          {(["overview", "passenger", "delivery", "timeline", "notifications", "audit", "history"] as Tab[]).map((t) => (
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
      {tab === "timeline" && workflow && <TimelineTab workflow={workflow} />}
      {tab === "timeline" && !workflow && (
        <p className="text-sm text-muted-foreground">No timeline entries yet.</p>
      )}
      {tab === "notifications" && <NotificationsTab notifications={notifications} />}
      {tab === "audit" && <AuditTab entries={audit} />}
      {tab === "history" && workflow && <HistoryTab workflow={workflow} />}

      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} delivery={delivery} />
      <FailDialog open={failOpen} onOpenChange={setFailOpen} deliveryId={deliveryId} />
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

function OverviewTab({ d, kase }: { d: Delivery; kase?: ReturnType<typeof useStore<any>> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Baggage</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1 pt-0">
          <Row label="Bag ID" value={<span className="font-mono">{d.bagId}</span>} />
          <Row label="PIR" value={<span className="font-mono">{d.pirNumber}</span>} />
          {kase && <Row label="Description" value={<span className="text-xs">{(kase as any).description}</span>} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Delivery</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1 pt-0">
          <Row label="Address" value={<span className="text-xs">{d.address}</span>} />
          <Row label="ETA" value={fmt(d.eta)} />
          <Row label="Driver" value={d.driver && d.driver !== "—" ? d.driver : "Unassigned"} />
        </CardContent>
      </Card>
    </div>
  );
}

function PassengerTab({ d, kase }: { d: Delivery; kase?: ReturnType<typeof useStore<any>> }) {
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
        <Row label="Type" value={d.deliveryType ?? "Home Delivery"} />
        <Row label="Station" value={d.station ?? "—"} />
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

function TimelineTab({ workflow }: { workflow: NonNullable<ReturnType<typeof useStore<any>>> }) {
  const w = workflow as any;
  return (
    <Card>
      <CardContent className="p-4">
        <ol className="relative border-l border-border ml-2 space-y-4">
          {w.history.map((h: any, i: number) => (
            <li key={i} className="ml-4">
              <div className="absolute w-2 h-2 rounded-full -left-1 mt-2 bg-primary" />
              <p className="text-sm font-medium">{WORKFLOW_LABELS[h.status as keyof typeof WORKFLOW_LABELS]?.en ?? h.status}</p>
              <p className="text-xs text-muted-foreground">{fmt(h.at)} · {h.actor}{h.role ? ` (${h.role})` : ""}</p>
            </li>
          ))}
        </ol>
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

function AuditTab({ entries }: { entries: any[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No audit entries yet.</p>;
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">At</th>
              <th className="text-left px-3 py-2 font-medium">Action</th>
              <th className="text-left px-3 py-2 font-medium">Actor</th>
              <th className="text-left px-3 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(e.at)}</td>
                <td className="px-3 py-2 text-xs font-mono">{e.action}</td>
                <td className="px-3 py-2 text-xs">{e.actor}</td>
                <td className="px-3 py-2 text-xs">{e.note ?? (e.fromStatus && e.toStatus ? `${e.fromStatus} → ${e.toStatus}` : "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function HistoryTab({ workflow }: { workflow: any }) {
  return <TimelineTab workflow={workflow} />;
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

function FailDialog({
  open,
  onOpenChange,
  deliveryId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deliveryId: string;
}) {
  const [reason, setReason] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setDeliveryStage(deliveryId, "Delivery Failed", {
      actor: "Delivery Coordinator",
      failureReason: reason || "Not specified",
    });
    toast.error("Delivery marked failed");
    onOpenChange(false);
    setReason("");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Mark Delivery Failed</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Failure Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Passenger unavailable, wrong address, …" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="destructive">Mark Failed</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

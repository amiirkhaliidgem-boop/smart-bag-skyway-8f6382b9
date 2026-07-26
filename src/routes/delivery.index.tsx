import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  driverPool,
  assignDriver,
  bulkAssignDriver,
  getDeliveryStage,
  type Delivery,
} from "@/lib/store";
import {
  closeDelivery,
  resendOtp,
  createTestNotification,
  ensurePassengerToken,
} from "@/lib/store";
import { renderTemplate, type NotificationChannel } from "@/lib/notifications/templates";
import type { WorkflowStatus } from "@/lib/workflow/statuses";
import { Textarea } from "@/components/ui/textarea";
import { BulkToolbar as SharedBulkToolbar } from "@/components/bulk/bulk-toolbar";
import {
  DELIVERY_STAGES,
  STAGE_LABELS,
  STAGE_STYLES,
  DELIVERY_QUEUES,
  actionsForStage,
  type DeliveryQueueId,
  type DeliveryStage,
} from "@/lib/delivery/stages";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Truck,
  UserCheck,
  XCircle,
  Search,
  Bell,
  Repeat,
  X,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PodPrintHost, podPrintBus } from "@/components/delivery/pod-print-host";
import { DateRangeFilter } from "@/components/filters/date-range-filter";

export const Route = createFileRoute("/delivery/")({
  head: () => ({
    meta: [
      { title: "Delivery Dispatch Center — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Operational dispatch center for airport home baggage delivery — assign drivers, track stages, and manage SLA in real time.",
      },
    ],
  }),
  component: DispatchCenter,
});

function DispatchCenter() {
  const deliveries = useStore((s) => s.deliveries);

  // ---- Filters (URL-independent; local UI state for this operational view)
  const [q, setQ] = useState("");
  const [stageF, setStageF] = useState<DeliveryStage | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [queue, setQueue] = useState<DeliveryQueueId>("all");

  const filtered = useMemo(() => {
    const activeQueue = DELIVERY_QUEUES.find((qq) => qq.id === queue) ?? DELIVERY_QUEUES[0];
    const queueStages = new Set<DeliveryStage>(activeQueue.stages);
    return deliveries.filter((d) => {
      const stage = getDeliveryStage(d);
      if (queue !== "all" && !queueStages.has(stage)) return false;
      const hay = `${d.deliveryId} ${d.pirNumber} ${d.passengerName} ${d.mobile} ${d.address} ${d.driver}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (stageF !== "all" && stage !== stageF) return false;
      const day = (d.createdAt ?? "").slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [deliveries, queue, q, stageF, from, to]);

  const queueCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const qq of DELIVERY_QUEUES) {
      const set = new Set<DeliveryStage>(qq.stages);
      m[qq.id] = qq.id === "all" ? deliveries.length : deliveries.filter((d) => set.has(getDeliveryStage(d))).length;
    }
    return m;
  }, [deliveries]);

  // ---- KPIs
  const stageCounts = useMemo(() => {
    const m: Record<DeliveryStage, number> = {} as never;
    for (const s of DELIVERY_STAGES) m[s] = 0;
    for (const d of deliveries) m[getDeliveryStage(d)]++;
    return m;
  }, [deliveries]);

  const today = new Date().toISOString().slice(0, 10);
  const deliveredToday = deliveries.filter(
    (d) =>
      getDeliveryStage(d) === "Delivered" &&
      (d.deliveredAt ?? d.createdAt ?? "").slice(0, 10) === today,
  ).length;

  const completed = deliveries.filter(
    (d) => getDeliveryStage(d) === "Delivered",
  );
  const durationsMs = completed
    .map((d) => {
      const start = d.createdAt ? new Date(d.createdAt).getTime() : NaN;
      const end = d.deliveredAt ? new Date(d.deliveredAt).getTime() : NaN;
      return Number.isFinite(start) && Number.isFinite(end) ? end - start : null;
    })
    .filter((v): v is number => v != null && v > 0);
  const avgHrs = durationsMs.length
    ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length / 3_600_000
    : null;

  const active = deliveries.filter(
    (d) => getDeliveryStage(d) !== "Delivered",
  ).length;

  // ---- Selection (bulk actions)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkNotifyOpen, setBulkNotifyOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((d) => d.deliveryId)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Delivery Dispatch Center
          </h1>
        </div>
        <div />
      </div>

      {selected.size > 0 && (
        <SharedBulkToolbar
          count={selected.size}
          noun="Delivery"
          pluralNoun="Deliveries"
          onCancel={() => setSelected(new Set())}
          actions={[
            {
              key: "assign",
              label: (() => {
                const sel = deliveries.filter((d) => selected.has(d.deliveryId));
                const all = sel.length > 0 && sel.every((d) => d.driver && d.driver !== "—");
                return all ? "Reassign Delivery Agent" : "Assign Delivery Agent";
              })(),
              icon: UserCheck,
              onClick: () => setBulkAssignOpen(true),
            },
            {
              key: "resend-otp",
              label: "Resend OTP",
              icon: Repeat,
              variant: "outline",
              onClick: () => {
                let sent = 0;
                for (const id of selected) {
                  const d = deliveries.find((x) => x.deliveryId === id);
                  if (!d) continue;
                  if (d.driver && d.driver !== "—") {
                    resendOtp(id, { actor: "Delivery Coordinator" });
                    sent++;
                  }
                }
                toast.success(`OTP resent for ${sent} delivery${sent === 1 ? "" : "s"}`);
              },
            },
            {
              key: "notify",
              label: "Notify Passenger",
              icon: Bell,
              variant: "outline",
              onClick: () => setBulkNotifyOpen(true),
            },
            {
              key: "print",
              label: "Print POD",
              icon: Printer,
              variant: "outline",
              onClick: () => podPrintBus.print(Array.from(selected)),
            },
          ]}
        />
      )}

      {/* KPI strip — matches Lost & Found */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Ready for Delivery" value={stageCounts["Ready for Delivery"]} tone="slate" />
        <Kpi label="Assigned" value={stageCounts["Assigned"] + stageCounts["Driver Accepted"]} tone="indigo" />
        <Kpi label="Out for Delivery" value={stageCounts["Out for Delivery"]} tone="amber" />
        <Kpi label="Delivered" value={stageCounts["Delivered"]} tone="emerald" />
        <Kpi label="Active" value={active} tone="violet" />
      </div>

      {/* Queue tabs + simplified filter bar — matches Lost & Found */}
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-wrap items-center gap-1">
            {DELIVERY_QUEUES.map((qq) => (
              <button
                key={qq.id}
                onClick={() => setQueue(qq.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition inline-flex items-center gap-1.5",
                  queue === qq.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {qq.label}
                <span className={cn(
                  "inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded text-[10px] font-semibold",
                  queue === qq.id ? "bg-primary-foreground/20" : "bg-muted",
                )}>
                  {queueCounts[qq.id] ?? 0}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="pl-9"
              />
            </div>
            <UISelect value={stageF} onValueChange={(v) => setStageF(v as DeliveryStage | "all")}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {DELIVERY_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </UISelect>
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => { setQ(""); setStageF("all"); setFrom(""); setTo(""); }}
              >
                <X className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="text-left px-3 py-3 font-medium">Delivery</th>
                  <th className="text-left px-3 py-3 font-medium">PIR</th>
                  <th className="text-left px-3 py-3 font-medium">Passenger</th>
                  <th className="text-left px-3 py-3 font-medium">Mobile</th>
                  <th className="text-left px-3 py-3 font-medium">Address</th>
                  <th className="text-left px-3 py-3 font-medium">Delivery Agent</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                  <th className="text-left px-3 py-3 font-medium">Priority</th>
                  <th className="text-left px-3 py-3 font-medium">Created</th>
                  <th className="text-right px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((d) => (
                  <Row
                    key={d.deliveryId}
                    d={d}
                    checked={selected.has(d.deliveryId)}
                    onToggle={() => toggleOne(d.deliveryId)}
                    onAssign={() => setAssignFor(d.deliveryId)}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      {deliveries.length === 0
                        ? "No deliveries yet. Cases enter this module when Lost & Found marks them Ready for Delivery."
                        : queue === "ready"
                        ? "No deliveries ready to schedule."
                        : "No deliveries match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <BulkAssignDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        deliveries={deliveries.filter((d) => selected.has(d.deliveryId))}
        onDone={() => setSelected(new Set())}
      />
      <BulkNotifyDialog
        open={bulkNotifyOpen}
        onOpenChange={setBulkNotifyOpen}
        deliveries={deliveries.filter((d) => selected.has(d.deliveryId))}
        onDone={() => setSelected(new Set())}
      />
      <SingleAssignDialog
        deliveryId={assignFor}
        onClose={() => setAssignFor(null)}
      />
      <PodPrintHost />
    </div>
  );
}

function Row({
  d,
  checked,
  onToggle,
  onAssign,
}: {
  d: Delivery;
  checked: boolean;
  onToggle: () => void;
  onAssign: () => void;
}) {
  const navigate = useNavigate();
  const stage = getDeliveryStage(d);
  const acts = actionsForStage(stage);
  const stop = (e: React.MouseEvent | React.ChangeEvent) => e.stopPropagation();
  const openDetails = () =>
    navigate({ to: "/delivery/$deliveryId", params: { deliveryId: d.deliveryId } });
  return (
    <tr
      className="hover:bg-muted/40 cursor-pointer"
      onClick={openDetails}
    >
      <td className="px-3 py-3" onClick={stop as never}>
        <input type="checkbox" checked={checked} onChange={(e) => { stop(e); onToggle(); }} />
      </td>
      <td className="px-3 py-3">
        <span className="font-mono text-xs font-semibold text-primary">{d.deliveryId}</span>
      </td>
      <td className="px-3 py-3 font-mono text-xs">{d.pirNumber}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          {d.priority === "VIP" && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1 rounded">VIP</span>
          )}
          <span>{d.passengerName}</span>
        </div>
      </td>
      <td className="px-3 py-3 font-mono text-xs">{d.mobile}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground max-w-[220px] truncate" title={d.address}>{d.address}</td>
      <td className="px-3 py-3 text-xs">
        {d.driver && d.driver !== "—" ? d.driver : <span className="text-muted-foreground italic">Unassigned</span>}
      </td>
      <td className="px-3 py-3">
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap", STAGE_STYLES[stage])}>
          {STAGE_LABELS[stage]}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="text-xs">{d.priority}</span>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {fmt(d.createdAt ?? "")}
      </td>
      <td className="px-3 py-3 text-right" onClick={stop as never}>
        <div className="inline-flex items-center gap-1 flex-wrap justify-end">
          <RowActions d={d} acts={acts} onAssign={onAssign} />
          <Link
            to="/delivery/$deliveryId"
            params={{ deliveryId: d.deliveryId }}
            className="inline-flex items-center h-7 px-2.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted"
          >
            Open
          </Link>
        </div>
      </td>
    </tr>
  );
}

function RowActions({
  d,
  acts,
  onAssign,
}: {
  d: Delivery;
  acts: ReturnType<typeof actionsForStage>;
  onAssign: () => void;
}) {
  const id = d.deliveryId;
  const btn = "inline-flex items-center gap-1 h-7 px-2 rounded-md border border-input bg-background text-[11px] font-medium hover:bg-muted whitespace-nowrap";
  return (
    <>
      {(acts.assign || acts.reassign) && (
        <button className={btn} onClick={onAssign}>
          <UserCheck className="h-3 w-3" /> {acts.reassign ? "Reassign" : "Assign"}
        </button>
      )}
      {acts.notify && (
        <button
          className={btn}
          onClick={() => {
            ensurePassengerToken(id);
            const events = createTestNotification({ deliveryId: id, channel: "sms", operator: "Delivery Coordinator" });
            toast.success(events.length ? "Passenger notified" : "No template available");
          }}
        >
          <Bell className="h-3 w-3" /> Notify
        </button>
      )}
      {acts.resendOtp && (
        <button
          className={btn}
          onClick={() => {
            resendOtp(id, { actor: "Delivery Coordinator" });
            toast.success("Passenger Portal link resent");
          }}
        >
          <Repeat className="h-3 w-3" /> Resend OTP
        </button>
      )}
      {acts.close && (
        <button
          className={btn}
          onClick={() => {
            closeDelivery(id, { actor: "Delivery Coordinator", role: "DeliveryCoordinator" });
            toast.success("Closed");
          }}
        >
          <XCircle className="h-3 w-3" /> Close
        </button>
      )}
    </>
  );
}

function fmt(iso: string) {
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

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "slate" | "rose" | "amber" | "violet" | "emerald" | "indigo";
}) {
  const map: Record<string, string> = {
    slate: "text-slate-700",
    rose: "text-rose-600",
    amber: "text-amber-600",
    violet: "text-violet-600",
    emerald: "text-emerald-600",
    indigo: "text-indigo-600",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-bold tabular-nums mt-1", map[tone ?? "slate"])}>{value}</p>
      </CardContent>
    </Card>
  );
}

function BulkAssignDialog({
  open,
  onOpenChange,
  deliveries,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deliveries: Delivery[];
  onDone: () => void;
}) {
  const [driver, setDriver] = useState(driverPool[0]);
  const [note, setNote] = useState("");
  const deliveryIds = deliveries.map((d) => d.deliveryId);
  const allAssigned =
    deliveries.length > 0 &&
    deliveries.every((d) => d.driver && d.driver !== "—");
  const mode: "assign" | "reassign" = allAssigned ? "reassign" : "assign";
  function submit(e: React.FormEvent) {
    e.preventDefault();
    bulkAssignDriver(deliveryIds, driver, {
      actor: "Delivery Coordinator",
      role: "DeliveryCoordinator",
      note: note.trim() || undefined,
    });
    toast.success(
      `${mode === "reassign" ? "Reassigned" : "Assigned"} ${deliveryIds.length} deliveries to ${driver}`,
    );
    setNote("");
    onOpenChange(false);
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "reassign" ? "Bulk Reassign Delivery Agent" : "Bulk Assign Delivery Agent"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {mode === "reassign"
              ? `Replace the current driver for ${deliveryIds.length} selected deliveries.`
              : `Assign ${deliveryIds.length} selected deliveries to a driver.`}
          </p>
          <div className="space-y-1.5">
            <Label>Delivery Agent</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            >
              {driverPool.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context for the driver / audit trail…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">
              {mode === "reassign" ? "Reassign" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const NOTIFY_TEMPLATES: { status: WorkflowStatus; label: string }[] = [
  { status: "DELIVERY_APPROVED", label: "Delivery Approved" },
  { status: "DRIVER_ASSIGNED", label: "Delivery Agent Assigned (Portal + OTP)" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "DRIVER_ARRIVED", label: "Delivery Agent Arrived" },
  { status: "DELIVERED", label: "Delivered" },
];

function BulkNotifyDialog({
  open,
  onOpenChange,
  deliveries,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deliveries: Delivery[];
  onDone: () => void;
}) {
  const [channel, setChannel] = useState<NotificationChannel>("sms");
  const [status, setStatus] = useState<WorkflowStatus>("OUT_FOR_DELIVERY");

  const preview = useMemo(() => {
    const sample = deliveries[0];
    if (!sample) return null;
    const token = ensurePassengerToken(sample.deliveryId);
    return renderTemplate(status, channel, "en", {
      passengerName: sample.passengerName,
      pirNumber: sample.pirNumber,
      driverName: sample.driver,
      otp: sample.otpCode,
      trackingUrl: token ? `/passenger/${token}` : undefined,
    });
  }, [deliveries, status, channel]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let sent = 0;
    let skipped = 0;
    for (const d of deliveries) {
      ensurePassengerToken(d.deliveryId);
      const events = createTestNotification({
        deliveryId: d.deliveryId,
        channel,
        workflowStatus: status,
        operator: "Delivery Coordinator",
      });
      if (events.length) sent++;
      else skipped++;
    }
    if (sent) toast.success(`Notified ${sent} passenger${sent === 1 ? "" : "s"} via ${channel.toUpperCase()}`);
    if (skipped) toast.warning(`${skipped} skipped — no ${channel} template for this status`);
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Notify Passenger</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Send a notification individually to every passenger across {deliveries.length}{" "}
            selected {deliveries.length === 1 ? "delivery" : "deliveries"}.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={channel}
                onChange={(e) => setChannel(e.target.value as NotificationChannel)}
              >
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="push">Push</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Template</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkflowStatus)}
              >
                {NOTIFY_TEMPLATES.map((t) => (
                  <option key={t.status} value={t.status}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Preview (sample: {deliveries[0]?.passengerName ?? "—"})</Label>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap min-h-[80px]">
              {preview ? (
                <>
                  {preview.subject && <div className="font-semibold mb-1">{preview.subject}</div>}
                  {preview.body}
                </>
              ) : (
                <span className="italic text-muted-foreground">
                  No {channel} template available for this status.
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!preview}>Send</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SingleAssignDialog({
  deliveryId,
  onClose,
}: {
  deliveryId: string | null;
  onClose: () => void;
}) {
  const d = useStore((s) => (deliveryId ? s.deliveries.find((x) => x.deliveryId === deliveryId) : undefined));
  const [driver, setDriver] = useState(driverPool[0]);
  const open = !!deliveryId;
  const wasAssigned = !!(d?.driver && d.driver !== "—");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!deliveryId) return;
    assignDriver(deliveryId, driver, { actor: "Delivery Coordinator", role: "DeliveryCoordinator" });
    toast.success(`${wasAssigned ? "Reassigned" : "Assigned"} to ${driver}`);
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{wasAssigned ? "Reassign Delivery Agent" : "Assign Delivery Agent"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {d && (
            <p className="text-xs text-muted-foreground">
              {d.deliveryId} · {d.passengerName}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Delivery Agent</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            >
              {driverPool.map((dv) => <option key={dv} value={dv}>{dv}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{wasAssigned ? "Reassign" : "Assign"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


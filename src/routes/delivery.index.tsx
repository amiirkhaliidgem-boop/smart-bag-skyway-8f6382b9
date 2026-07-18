import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  driverPool,
  assignDriver,
  bulkAssignDriver,
  getDeliveryStage,
  type Delivery,
  type Priority,
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
import {
  DELIVERY_STAGES,
  STAGE_LABELS,
  STAGE_STYLES,
  DELIVERY_QUEUES,
  actionsForStage,
  type DeliveryQueueId,
  type DeliveryStage,
} from "@/lib/delivery/stages";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CheckCircle2,
  XCircle,
  Package,
  Clock,
  Gauge,
  Search,
  Bell,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const PRIORITIES: Priority[] = ["Low", "Normal", "High", "VIP"];

function DispatchCenter() {
  const deliveries = useStore((s) => s.deliveries);

  // ---- Filters (URL-independent; local UI state for this operational view)
  const [q, setQ] = useState("");
  const [driverF, setDriverF] = useState("all");
  const [stageF, setStageF] = useState<DeliveryStage | "all">("all");
  const [priorityF, setPriorityF] = useState<Priority | "all">("all");
  const [stationF, setStationF] = useState("all");
  const [typeF, setTypeF] = useState("all");
  const [vipOnly, setVipOnly] = useState(false);
  const [dateF, setDateF] = useState("");
  const [queue, setQueue] = useState<DeliveryQueueId>("all");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const stations = useMemo(
    () =>
      Array.from(
        new Set(deliveries.map((d) => d.station).filter((s): s is string => !!s)),
      ),
    [deliveries],
  );

  const filtered = useMemo(() => {
    const activeQueue = DELIVERY_QUEUES.find((qq) => qq.id === queue) ?? DELIVERY_QUEUES[0];
    const queueStages = new Set<DeliveryStage>(activeQueue.stages);
    return deliveries.filter((d) => {
      const stage = getDeliveryStage(d);
      if (queue !== "all" && !queueStages.has(stage)) return false;
      const hay = `${d.deliveryId} ${d.pirNumber} ${d.passengerName} ${d.mobile} ${d.address} ${d.driver}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (driverF !== "all" && d.driver !== driverF) return false;
      if (stageF !== "all" && stage !== stageF) return false;
      if (priorityF !== "all" && d.priority !== priorityF) return false;
      if (stationF !== "all" && d.station !== stationF) return false;
      if (typeF !== "all" && (d.deliveryType ?? "Home Delivery") !== typeF)
        return false;
      if (vipOnly && d.priority !== "VIP") return false;
      return true;
    });
  }, [deliveries, queue, q, driverF, stageF, priorityF, stationF, typeF, vipOnly]);

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
          <p className="text-sm text-muted-foreground mt-1">
            Operational back office for home baggage delivery. Cases enter this
            module when Lost &amp; Found marks them Ready for Delivery.
          </p>
        </div>
        <div />
      </div>

      {selected.size > 0 && (
        <BulkToolbar
          deliveries={deliveries.filter((d) => selected.has(d.deliveryId))}
          onAssign={() => setBulkAssignOpen(true)}
          onNotify={() => setBulkNotifyOpen(true)}
          onCancel={() => setSelected(new Set())}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Ready for Delivery" value={stageCounts["Ready for Delivery"]} icon={<Package className="h-5 w-5" />} tone="slate" />
        <Kpi label="Assigned" value={stageCounts["Assigned"] + stageCounts["Driver Accepted"]} icon={<UserCheck className="h-5 w-5" />} tone="indigo" />
        <Kpi label="Out for Delivery" value={stageCounts["Out for Delivery"]} icon={<Truck className="h-5 w-5" />} tone="cyan" />
        <Kpi label="Delivered Today" value={deliveredToday} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <Kpi label="Active" value={active} icon={<Truck className="h-5 w-5" />} tone="primary" />
        <Kpi
          label="Avg Delivery Time"
          value={avgHrs != null ? `${avgHrs.toFixed(1)}h` : "—"}
          icon={<Clock className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1 border-b border-border pb-3">
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
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ID, PIR, passenger, phone…"
                className="pl-8 h-9"
              />
            </div>
            <Select value={stageF} onChange={(v) => setStageF(v as never)} label="Status">
              <option value="all">All stages</option>
              {DELIVERY_STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </Select>
            <Select value={driverF} onChange={setDriverF} label="Driver">
              <option value="all">All drivers</option>
              {driverPool.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
              <option value="—">Unassigned</option>
            </Select>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide" : "More"} filters
              </Button>
            </div>
          </div>
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Select value={priorityF} onChange={(v) => setPriorityF(v as never)} label="Priority">
                <option value="all">All priorities</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Select value={stationF} onChange={setStationF} label="Station">
                <option value="all">All stations</option>
                {stations.map((s) => <option key={s} value={s}>{s}</option>)}
                {stations.length === 0 && <option value="none" disabled>—</option>}
              </Select>
              <Select value={typeF} onChange={setTypeF} label="Type">
                <option value="all">All types</option>
                <option value="Home Delivery">Home Delivery</option>
                <option value="Airport Pickup">Airport Pickup</option>
              </Select>
              <label className="inline-flex items-end gap-2 text-xs pb-2">
                <input
                  type="checkbox"
                  checked={vipOnly}
                  onChange={(e) => setVipOnly(e.target.checked)}
                />
                VIP only
              </label>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">
              Showing {filtered.length} of {deliveries.length} deliveries · {active} active
            </span>
            {(q || driverF !== "all" || stageF !== "all" || priorityF !== "all" || stationF !== "all" || typeF !== "all" || vipOnly) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => {
                  setQ(""); setDriverF("all"); setStageF("all");
                  setPriorityF("all"); setStationF("all"); setTypeF("all");
                  setVipOnly(false);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
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
                  <th className="text-left px-3 py-3 font-medium">Driver</th>
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
        {fmt(d.createdAt ?? d.eta)}
      </td>
      <td className="px-3 py-3 text-xs whitespace-nowrap">{fmt(d.eta)}</td>
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
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: "primary" | "emerald" | "indigo" | "amber" | "rose" | "cyan" | "blue" | "slate";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    indigo: "bg-indigo-100 text-indigo-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    cyan: "bg-cyan-100 text-cyan-700",
    blue: "bg-blue-100 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={cn("h-9 w-9 rounded-lg grid place-items-center", tones[tone])}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <select
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
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
            {mode === "reassign" ? "Bulk Reassign Driver" : "Bulk Assign Driver"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {mode === "reassign"
              ? `Replace the current driver for ${deliveryIds.length} selected deliveries.`
              : `Assign ${deliveryIds.length} selected deliveries to a driver.`}
          </p>
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

function BulkToolbar({
  deliveries,
  onAssign,
  onNotify,
  onCancel,
}: {
  deliveries: Delivery[];
  onAssign: () => void;
  onNotify: () => void;
  onCancel: () => void;
}) {
  const allAssigned =
    deliveries.length > 0 &&
    deliveries.every((d) => d.driver && d.driver !== "—");
  const mode: "assign" | "reassign" = allAssigned ? "reassign" : "assign";
  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 shadow-sm">
      <div className="text-sm">
        <span className="text-muted-foreground">Selected:</span>{" "}
        <span className="font-semibold">
          {deliveries.length} {deliveries.length === 1 ? "Delivery" : "Deliveries"}
        </span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onAssign} className="gap-1.5">
          <UserCheck className="h-3.5 w-3.5" />
          {mode === "reassign" ? "Bulk Reassign" : "Bulk Assign"}
        </Button>
        <Button size="sm" variant="outline" onClick={onNotify} className="gap-1.5">
          <Bell className="h-3.5 w-3.5" />
          Bulk Notify Passenger
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel Selection
        </Button>
      </div>
    </div>
  );
}

const NOTIFY_TEMPLATES: { status: WorkflowStatus; label: string }[] = [
  { status: "DELIVERY_APPROVED", label: "Delivery Approved" },
  { status: "DRIVER_ASSIGNED", label: "Driver Assigned (Portal + OTP)" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "DRIVER_ARRIVED", label: "Driver Arrived" },
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
    return renderTemplate(status, channel, "en", {
      passengerName: sample.passengerName,
      pirNumber: sample.pirNumber,
      driverName: sample.driver,
      otp: sample.otpCode,
      trackingUrl: `/passenger/${sample.deliveryId.toLowerCase()}`,
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
          <DialogTitle>{wasAssigned ? "Reassign Driver" : "Assign Driver"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {d && (
            <p className="text-xs text-muted-foreground">
              {d.deliveryId} · {d.passengerName}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Driver</Label>
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


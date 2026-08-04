import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDeliveryAgents } from "@/lib/admin/agents";
import {
  useStore,
  useOpsLoading,
  assignDriver,
  bulkAssignDriver,
  getDeliveryStage,
  type Delivery,
} from "@/lib/store";
import { resendOtp, returnToAirport, markDeliveryFailed, refreshOps } from "@/lib/store";
import { Textarea } from "@/components/ui/textarea";
import { BulkToolbar as SharedBulkToolbar } from "@/components/bulk/bulk-toolbar";
import {
  DELIVERY_STAGES,
  STAGE_LABELS,
  STAGE_STYLES,
  actionsForStage,
  type DeliveryStage,
} from "@/lib/delivery/stages";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SnapshotTruncationNotice } from "@/components/snapshot-truncation-notice";
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
} from "@/components/ui/dialog";
import { UserCheck, Search, Repeat, X, Printer, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PodPrintHost, podPrintBus } from "@/components/delivery/pod-print-host";
import { ReturnToAirportDialog } from "@/components/delivery/return-to-airport-dialog";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { PageLoading } from "@/components/ops-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/layout/data-table";

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
  const loading = useOpsLoading();
  const navigate = useNavigate();

  // ---- Filters (URL-independent; local UI state for this operational view)
  const [q, setQ] = useState("");
  const [stageF, setStageF] = useState<DeliveryStage | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return deliveries.filter((d) => {
      const stage = getDeliveryStage(d);
      const hay =
        `${d.deliveryId} ${d.pirNumber} ${d.passengerName} ${d.mobile} ${d.address} ${d.driver}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (stageF !== "all" && stage !== stageF) return false;
      const day = (d.createdAt ?? "").slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [deliveries, q, stageF, from, to]);

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

  const completed = deliveries.filter((d) => getDeliveryStage(d) === "Delivered");
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

  const active = deliveries.filter((d) => getDeliveryStage(d) !== "Delivered").length;

  // ---- Selection (bulk actions)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkReturnOpen, setBulkReturnOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [failFor, setFailFor] = useState<string | null>(null);

  const columns: DataColumn<Delivery>[] = useMemo(
    () => [
      {
        id: "deliveryId",
        header: "Delivery",
        minWidth: "8rem",
        sortValue: (d) => d.deliveryId,
        cell: (d) => (
          <span className="font-mono text-xs font-semibold text-primary">{d.deliveryId}</span>
        ),
      },
      {
        id: "pir",
        header: "PIR",
        minWidth: "8rem",
        hideBelow: "lg",
        sortValue: (d) => d.pirNumber || d.bagId,
        cell: (d) => <span className="font-mono text-xs">{d.pirNumber || d.bagId}</span>,
      },
      {
        id: "passenger",
        header: "Passenger",
        minWidth: "10rem",
        sortValue: (d) => d.passengerName,
        cell: (d) => (
          <div className="flex items-center gap-1.5">
            {d.priority === "VIP" && (
              <span className="rounded border border-amber-200 bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
                VIP
              </span>
            )}
            <span className="truncate">{d.passengerName}</span>
          </div>
        ),
      },
      {
        id: "mobile",
        header: "Mobile",
        hideBelow: "xl",
        cell: (d) => <span className="font-mono text-xs">{d.mobile}</span>,
      },
      {
        id: "address",
        header: "Address",
        hideBelow: "xl",
        cell: (d) => (
          <span
            className="block max-w-[220px] truncate text-xs text-muted-foreground"
            title={d.address}
          >
            {d.address}
          </span>
        ),
      },
      {
        id: "driver",
        header: "Delivery Agent",
        minWidth: "9rem",
        hideBelow: "lg",
        sortValue: (d) => d.driver ?? "",
        cell: (d) =>
          d.driver && d.driver !== "—" ? (
            <span className="text-xs">{d.driver}</span>
          ) : (
            <span className="text-xs italic text-muted-foreground">Unassigned</span>
          ),
      },
      {
        id: "stage",
        header: "Status",
        minWidth: "10rem",
        sortValue: (d) => getDeliveryStage(d),
        cell: (d) => {
          const stage = getDeliveryStage(d);
          return (
            <span
              className={cn(
                "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
                STAGE_STYLES[stage],
              )}
            >
              {STAGE_LABELS[stage]}
            </span>
          );
        },
      },
      {
        id: "priority",
        header: "Priority",
        hideBelow: "xl",
        sortValue: (d) => d.priority ?? "",
        cell: (d) => <span className="text-xs">{d.priority}</span>,
      },
      {
        id: "created",
        header: "Created",
        hideBelow: "xl",
        sortValue: (d) => d.createdAt ?? "",
        cell: (d) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {fmt(d.createdAt ?? "")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        minWidth: "12rem",
        cell: (d) => (
          <div
            className="inline-flex flex-wrap items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <RowActions
              d={d}
              acts={actionsForStage(getDeliveryStage(d))}
              onAssign={() => setAssignFor(d.deliveryId)}
              onMarkFailed={() => setFailFor(d.deliveryId)}
            />
            <Link
              to="/delivery/$deliveryId"
              params={{ deliveryId: d.deliveryId }}
              className="inline-flex h-7 items-center rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-muted"
            >
              Open
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  // Progressive loading: render the page shell with placeholders while this
  // screen's data tier is still in flight, instead of showing empty values.
  if (loading.core && deliveries.length === 0)
    return <PageLoading title={"Delivery Dispatch Center"} kpis={6} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Delivery Dispatch Center" />

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
              key: "return",
              label: "Return to Airport",
              icon: RotateCcw,
              variant: "outline",
              onClick: () => setBulkReturnOpen(true),
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
        <Kpi
          label="Assigned"
          value={stageCounts["Assigned"] + stageCounts["Driver Accepted"]}
          tone="indigo"
        />
        <Kpi label="Out for Delivery" value={stageCounts["Out for Delivery"]} tone="amber" />
        <Kpi label="Delivered" value={stageCounts["Delivered"]} tone="emerald" />
        <Kpi label="Active" value={active} tone="violet" />
      </div>

      {/* Standard filter bar — identical to Lost & Found */}
      <Card>
        <CardHeader className="pb-3 space-y-3">
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
                  <SelectItem key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </UISelect>
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => {
                  setQ("");
                  setStageF("all");
                  setFrom("");
                  setTo("");
                }}
              >
                <X className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <SnapshotTruncationNotice collection="deliveries" noun="deliveries" />

      <DataTable
        data={filtered}
        columns={columns}
        rowId={(d) => d.deliveryId}
        selectable
        selectedIds={Array.from(selected)}
        onSelectionChange={(ids) => setSelected(new Set(ids))}
        onRowClick={(d) =>
          navigate({ to: "/delivery/$deliveryId", params: { deliveryId: d.deliveryId } })
        }
        ariaLabel="Deliveries"
        emptyTitle={deliveries.length === 0 ? "No deliveries yet" : "No matching deliveries"}
        emptyDescription={
          deliveries.length === 0
            ? "Cases enter this module when Lost & Found marks them Ready for Delivery."
            : "No deliveries match the current filters."
        }
        mobileCard={(d) => <DeliveryCard d={d} />}
      />

      <BulkAssignDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        deliveries={deliveries.filter((d) => selected.has(d.deliveryId))}
        onDone={() => setSelected(new Set())}
      />
      <ReturnToAirportDialog
        open={bulkReturnOpen}
        onOpenChange={setBulkReturnOpen}
        count={selected.size}
        onConfirm={async (reasonCode, note) => {
          let ok = 0;
          const failures: string[] = [];
          for (const id of Array.from(selected)) {
            try {
              await returnToAirport(id, { reasonCode, note });
              ok++;
            } catch (err) {
              failures.push(id);
            }
          }
          await refreshOps();
          if (ok) toast.success(`${ok} delivery${ok === 1 ? "" : "ies"} returned to airport`);
          if (failures.length)
            toast.error(`Could not return ${failures.length}: ${failures.join(", ")}`);
          setSelected(new Set());
        }}
      />
      <SingleAssignDialog deliveryId={assignFor} onClose={() => setAssignFor(null)} />
      <ReturnToAirportDialog
        open={failFor !== null}
        onOpenChange={(v) => !v && setFailFor(null)}
        count={1}
        variant="failed"
        onConfirm={async (reasonCode, note) => {
          if (!failFor) return;
          try {
            await markDeliveryFailed(failFor, { reasonCode, note });
            await refreshOps();
            toast.success("Delivery attempt recorded as failed");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not mark this delivery failed");
          } finally {
            setFailFor(null);
          }
        }}
      />
      <PodPrintHost />
    </div>
  );
}

function DeliveryCard({ d }: { d: Delivery }) {
  const stage = getDeliveryStage(d);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-primary">{d.deliveryId}</span>
        <span
          className={cn(
            "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
            STAGE_STYLES[stage],
          )}
        >
          {STAGE_LABELS[stage]}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {d.priority === "VIP" && (
          <span className="rounded border border-amber-200 bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
            VIP
          </span>
        )}
        <span className="truncate">{d.passengerName}</span>
      </div>
      <dl className="space-y-0.5 text-xs text-muted-foreground">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">PIR</dt>
          <dd className="min-w-0 truncate font-mono">{d.pirNumber || d.bagId}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Mobile</dt>
          <dd className="min-w-0 truncate font-mono">{d.mobile}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Address</dt>
          <dd className="min-w-0 break-words">{d.address}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Agent</dt>
          <dd className="min-w-0 truncate">
            {d.driver && d.driver !== "—" ? d.driver : "Unassigned"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Created</dt>
          <dd className="min-w-0">{fmt(d.createdAt ?? "")}</dd>
        </div>
      </dl>
    </div>
  );
}

function RowActions({
  d,
  acts,
  onAssign,
  onMarkFailed,
}: {
  d: Delivery;
  acts: ReturnType<typeof actionsForStage>;
  onAssign: () => void;
  onMarkFailed: () => void;
}) {
  const id = d.deliveryId;
  const btn =
    "inline-flex items-center gap-1 h-7 px-2 rounded-md border border-input bg-background text-[11px] font-medium hover:bg-muted whitespace-nowrap";
  return (
    <>
      {(acts.assign || acts.reassign) && (
        <button className={btn} onClick={onAssign}>
          <UserCheck className="h-3 w-3" /> {acts.reassign ? "Reassign" : "Assign"}
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
      {acts.markFailed && (
        <button className={cn(btn, "text-destructive")} onClick={onMarkFailed}>
          <XCircle className="h-3 w-3" /> Mark Failed
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
  const { names: agentNames } = useDeliveryAgents();
  const [driverPick, setDriverPick] = useState("");
  const driver = driverPick || agentNames[0] || "—";
  const setDriver = setDriverPick;
  const [note, setNote] = useState("");
  const deliveryIds = deliveries.map((d) => d.deliveryId);
  const allAssigned =
    deliveries.length > 0 && deliveries.every((d) => d.driver && d.driver !== "—");
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
              {agentNames.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{mode === "reassign" ? "Reassign" : "Assign"}</Button>
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
  const d = useStore((s) =>
    deliveryId ? s.deliveries.find((x) => x.deliveryId === deliveryId) : undefined,
  );
  const { names: agentNames } = useDeliveryAgents();
  const [driverPick, setDriverPick] = useState("");
  const driver = driverPick || agentNames[0] || "—";
  const setDriver = setDriverPick;
  const open = !!deliveryId;
  const wasAssigned = !!(d?.driver && d.driver !== "—");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!deliveryId) return;
    assignDriver(deliveryId, driver, {
      actor: "Delivery Coordinator",
      role: "DeliveryCoordinator",
    });
    toast.success(`${wasAssigned ? "Reassigned" : "Assigned"} to ${driver}`);
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {wasAssigned ? "Reassign Delivery Agent" : "Assign Delivery Agent"}
          </DialogTitle>
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
              {agentNames.map((dv) => (
                <option key={dv} value={dv}>
                  {dv}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{wasAssigned ? "Reassign" : "Assign"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

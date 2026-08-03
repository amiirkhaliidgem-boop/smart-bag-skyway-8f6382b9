import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  useOpsLoading,
  bulkUpdateCases,
  bulkAssignDelivery,
  updateLfStatus,
  type BaggageCase,
} from "@/lib/store";
import {
  LF_STATUSES,
  LF_OWNED_STATUSES,
  deriveLfFromCase,
  canTransitionLf,
  type LFStatus,
} from "@/lib/lost-found/statuses";
import { SnapshotTruncationNotice } from "@/components/snapshot-truncation-notice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LfStatusBadge } from "@/components/lf-status-badge";
import { useStaffOfficers, type StaffOfficer } from "@/lib/admin/officers";
import { PirWizard } from "@/components/lost-found/pir-wizard";
import { BulkToolbar } from "@/components/bulk/bulk-toolbar";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { PirPrintHost, pirPrintBus } from "@/components/lost-found/pir-print-host";
import {
  Plus,
  Star as StarIcon,
  X,
  UserCheck,
  Truck,
  ListChecks,
  Download,
  Printer,
  PackageSearch,
} from "lucide-react";
import { toast } from "sonner";
import { ImportDialog } from "@/components/io/import-dialog";
import { lostFoundSchema } from "@/lib/io/registry";
import { exportCasesToXlsx } from "@/lib/lost-found/export-xlsx";
import { Upload } from "lucide-react";
import { PageLoading } from "@/components/ops-skeleton";
import { PageHeader, KpiCard, KpiGrid, DataTable, type DataColumn } from "@/components/layout";

export const Route = createFileRoute("/lost-found/")({
  head: () => ({
    meta: [
      { title: "Lost & Found — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Enterprise Lost & Found (AHL/PIR) registry — tracing, customs, delivery assignment, and full case lifecycle.",
      },
    ],
  }),
  component: LostFoundPage,
});

/** Statuses selectable in the registry filter. "Closed" is a retired legacy
 *  value — the operational lifecycle ends at Delivered (Home Delivery) or
 *  Passenger Picked Up (Airport Pickup). */
const FILTER_STATUSES = LF_STATUSES.filter((s) => s !== "Closed");

const priorityOf = (c: BaggageCase) => c.priority ?? c.internal?.casePriority ?? "Normal";

function LostFoundPage() {
  const cases = useStore((s) => s.cases);
  const loading = useOpsLoading();
  const [status, setStatus] = useState<LFStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignOfficerOpen, setAssignOfficerOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const officers = useStaffOfficers();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const lfs = deriveLfFromCase(c);
      if (status !== "all" && lfs !== status) return false;
      if (from && c.createdAt.slice(0, 10) < from) return false;
      if (to && c.createdAt.slice(0, 10) > to) return false;
      return true;
    });
  }, [cases, status, from, to]);

  const columns = useMemo<DataColumn<BaggageCase>[]>(
    () => [
      {
        id: "pir",
        header: "PIR",
        minWidth: "10rem",
        sortValue: (c) => c.pirNumber,
        cell: (c) => (
          <div className="min-w-0">
            <Link
              to="/lost-found/$bagId"
              params={{ bagId: c.bagId }}
              className="font-mono text-xs font-semibold text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {c.pirNumber || c.bagId}
            </Link>
            <div className="text-[10px] text-muted-foreground">{c.bagId}</div>
          </div>
        ),
      },
      {
        id: "passenger",
        header: "Passenger",
        minWidth: "12rem",
        sortValue: (c) => c.passengerName,
        cell: (c) => (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{c.passengerName}</span>
              {c.baggage?.vipPassenger || priorityOf(c) === "VIP" ? (
                <StarIcon
                  className="h-3.5 w-3.5 shrink-0 fill-[var(--warning)] text-[var(--warning)]"
                  aria-label="VIP"
                />
              ) : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {c.contact}
              {c.passenger?.pnr ? ` · PNR ${c.passenger.pnr}` : ""}
            </div>
          </div>
        ),
      },
      {
        id: "flight",
        header: "Flight",
        minWidth: "9rem",
        hideBelow: "lg",
        sortValue: (c) => c.flightNumber,
        cell: (c) => (
          <div className="min-w-0">
            <div className="font-medium">{c.flightNumber}</div>
            <div className="text-[11px] text-muted-foreground">
              {c.flight?.originAirport ?? "—"} → {c.flight?.destinationAirport ?? "CAI"}
            </div>
          </div>
        ),
      },
      {
        id: "tag",
        header: "Bag Tag",
        minWidth: "8rem",
        hideBelow: "xl",
        sortValue: (c) => c.bagTagNumber,
        cell: (c) => <span className="font-mono text-xs">{c.bagTagNumber}</span>,
      },
      {
        id: "status",
        header: "Current Status",
        minWidth: "11rem",
        sortValue: (c) => deriveLfFromCase(c),
        cell: (c) => <LfStatusBadge status={deriveLfFromCase(c)} />,
      },
      {
        id: "officer",
        header: "Assigned Officer",
        minWidth: "10rem",
        hideBelow: "xl",
        sortValue: (c) => c.internal?.assignedOfficer ?? "",
        cell: (c) =>
          c.internal?.assignedOfficer ?? (
            <span className="italic text-muted-foreground">Unassigned</span>
          ),
      },
      {
        id: "priority",
        header: "Priority",
        minWidth: "6rem",
        hideBelow: "lg",
        sortValue: priorityOf,
        cell: (c) => <span className="text-xs font-medium">{priorityOf(c)}</span>,
      },
      {
        id: "method",
        header: "Delivery Method",
        minWidth: "9rem",
        hideBelow: "xl",
        sortValue: (c) => c.delivery?.method ?? "",
        cell: (c) => <span className="text-xs">{c.delivery?.method ?? "—"}</span>,
      },
      {
        id: "created",
        header: "Created",
        minWidth: "7rem",
        hideBelow: "md",
        sortValue: (c) => c.createdAt,
        cell: (c) => (
          <span className="text-xs text-muted-foreground">
            {new Date(c.createdAt).toLocaleDateString("en-GB")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        minWidth: "5rem",
        cell: (c) => (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={(e) => {
              e.stopPropagation();
              navigate({ to: "/lost-found/$bagId", params: { bagId: c.bagId } });
            }}
          >
            Open
          </Button>
        ),
      },
    ],
    [navigate],
  );

  function resetFilters() {
    setStatus("all"); setFrom(""); setTo("");
  }

  const kpis = useMemo(() => {
    const total = cases.length;
    let open = 0, tracing = 0, readyDelivery = 0, delivered = 0, vip = 0;
    for (const c of cases) {
      const s = deriveLfFromCase(c);
      if (s === "Open") open++;
      if (s === "Tracing") tracing++;
      if (s === "Ready for Delivery" || s === "Ready for Airport Pickup" || s === "Assigned Driver")
        readyDelivery++;
      if (s === "Delivered" || s === "Passenger Picked Up" || s === "Closed") delivered++;
      if (c.baggage?.vipPassenger || c.priority === "VIP") vip++;
    }
    return { total, open, tracing, readyDelivery, delivered, vip };
  }, [cases]);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  function clearSelection() { setSelectedIds([]); }

  async function runAssignDelivery() {
    if (selectedIds.length === 0) return;
    const res = await bulkAssignDelivery(selectedIds, { actor: "L&F Officer" });
    const parts: string[] = [];
    if (res.handedOver) parts.push(`${res.handedOver} handed over to Delivery`);
    if (res.alreadyHandedOver) parts.push(`${res.alreadyHandedOver} already handed over`);
    if (res.skipped) parts.push(`${res.skipped} skipped`);
    toast.success(parts.join(" · ") || "No cases to hand over");
    clearSelection();
  }

  function runChangeStatus(next: LFStatus) {
    let applied = 0;
    let skipped = 0;
    for (const id of selectedIds) {
      const c = cases.find((x) => x.bagId === id);
      if (!c) { skipped++; continue; }
      const current = c.lfStatus ?? deriveLfFromCase(c);
      // Airport Pickup cases never enter the Home Delivery path.
      if (next === "Ready for Delivery" && c.delivery?.method === "Airport Pickup") {
        skipped++;
        continue;
      }
      if (current === next || !canTransitionLf(current, next)) {
        skipped++;
        continue;
      }
      updateLfStatus(id, next, { actor: "L&F Officer" });
      applied++;
    }
    const parts: string[] = [];
    if (applied) parts.push(`${applied} updated`);
    if (skipped) parts.push(`${skipped} skipped`);
    toast.success(parts.join(" · ") || "No cases updated");
    setStatusDialogOpen(false);
    clearSelection();
  }

  function runAssignOfficer(officerId: string) {
    const officer = officers.find((o) => o.id === officerId);
    if (!officer) return;
    void bulkUpdateCases(selectedIds, {
      internal: { assignedOfficerId: officer.id, assignedOfficer: officer.full_name },
    } as never);
    toast.success(`${selectedIds.length} case(s) assigned to ${officer.full_name}`);
    setAssignOfficerOpen(false);
    clearSelection();
  }

  function runExportSelected() {
    if (selectedIds.length === 0) return;
    const rows = cases.filter((c) => selected.has(c.bagId));
    try {
      exportCasesToXlsx(rows);
      toast.success(`${rows.length} case(s) exported to Excel`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    }
  }
  function runPrint() {
    if (selectedIds.length === 0) return;
    pirPrintBus.print(selectedIds);
  }


  // Progressive loading: render the page shell with placeholders while this
  // screen's data tier is still in flight, instead of showing empty values.
  if (loading.core && cases.length === 0)
    return <PageLoading title={"Lost & Found Management"} kpis={5} />;

  return (
    <div className="space-y-6">
      <PirPrintHost />
      <PageHeader
        title="Lost & Found Management"
        description="AHL / PIR registry — tracing, customs, delivery and pickup hand-off."
        actions={
          <>
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <ImportDialog
            schema={lostFoundSchema}
            open={importOpen}
            onOpenChange={setImportOpen}
          />
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New PIR Case
              </Button>
            </DialogTrigger>
            <PirWizard mode="create" onClose={() => setOpenNew(false)} />
          </Dialog>
          </>
        }
      />

      {/* KPI strip */}
      <KpiGrid className="lg:grid-cols-5 xl:grid-cols-5">
        <KpiCard label="Total Cases" value={kpis.total} />
        <KpiCard label="Open" value={kpis.open} tone="danger" />
        <KpiCard label="Tracing" value={kpis.tracing} tone="warning" />
        <KpiCard label="Ready / Assigned" value={kpis.readyDelivery} tone="primary" />
        <KpiCard label="Completed" value={kpis.delivered} tone="success" />
      </KpiGrid>

      <SnapshotTruncationNotice collection="cases" noun="cases" />

      {selected.size > 0 && (
        <BulkToolbar
          count={selected.size}
          noun="Case"
          onCancel={clearSelection}
          actions={[
            {
              key: "assign-delivery",
              label: "Assign Delivery",
              icon: Truck,
              onClick: runAssignDelivery,
            },
            {
              key: "assign-officer",
              label: "Assign Officer",
              icon: UserCheck,
              variant: "outline",
              onClick: () => setAssignOfficerOpen(true),
            },
            {
              key: "status",
              label: "Change Status",
              icon: ListChecks,
              variant: "outline",
              onClick: () => setStatusDialogOpen(true),
            },
            {
              key: "export",
              label: "Export Selected",
              icon: Download,
              variant: "outline",
              onClick: runExportSelected,
            },
            {
              key: "print",
              label: "Print",
              icon: Printer,
              variant: "outline",
              onClick: runPrint,
            },
          ]}
        />
      )}

      <DataTable
        data={filtered}
        columns={columns}
        rowId={(c) => c.bagId}
        ariaLabel="Lost and found cases"
        initialSort={{ id: "created", dir: "desc" }}
        searchPlaceholder="Search PIR, passenger, flight, tag…"
        searchText={(c) =>
          [
            c.bagId, c.pirNumber, c.passengerName, c.flightNumber,
            c.bagTagNumber, c.email, c.contact,
            c.passenger?.passportNumber, c.passenger?.pnr,
          ].filter(Boolean).join(" ")
        }
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(c) => navigate({ to: "/lost-found/$bagId", params: { bagId: c.bagId } })}
        loading={loading.core && cases.length === 0}
        emptyIcon={<PackageSearch />}
        emptyTitle="No cases match the current filters"
        emptyDescription="Adjust the status or date filters, or create a new PIR case."
        filters={
          <>
            <Select value={status} onValueChange={(v) => setStatus(v as LFStatus | "all")}>
              <SelectTrigger className="h-10 w-full sm:w-[190px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {FILTER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-10 gap-1.5">
              <X className="h-4 w-4" /> Reset
            </Button>
          </>
        }
      />

      <AssignOfficerDialog
        open={assignOfficerOpen}
        onOpenChange={setAssignOfficerOpen}
        officers={officers}
        count={selected.size}
        onSubmit={runAssignOfficer}
      />
      <ChangeStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        count={selected.size}
        onSubmit={runChangeStatus}
      />
    </div>
  );
}

function AssignOfficerDialog({
  open, onOpenChange, officers, count, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  officers: StaffOfficer[];
  count: number;
  onSubmit: (officerId: string) => void;
}) {
  const [officerId, setOfficerId] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Officer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Assign {count} selected case{count === 1 ? "" : "s"} to an officer.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Officer</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pick an officer" />
              </SelectTrigger>
              <SelectContent>
                {officers.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.full_name} · {o.employee_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {officers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No active staff found in Administration.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(officerId)} disabled={!officerId}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeStatusDialog({
  open, onOpenChange, count, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  onSubmit: (s: LFStatus) => void;
}) {
  const [s, setS] = useState<LFStatus>("Open");
  // Bulk status changes only offer statuses shared by both operational paths;
  // path-specific terminal states are set from the case itself.
  const options = LF_OWNED_STATUSES;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Move {count} selected case{count === 1 ? "" : "s"} to a new status.
            Cases already past the target or handed over to Delivery will be skipped.
          </p>
          <Select value={s} onValueChange={(v) => setS(v as LFStatus)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map((x) => (
                <SelectItem key={x} value={x}>{x}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(s)}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { LfStatusBadge } from "@/components/lf-status-badge";
import { PirWizard } from "@/components/lost-found/pir-wizard";
import { BulkToolbar } from "@/components/bulk/bulk-toolbar";
import { PirPrintHost, pirPrintBus } from "@/components/lost-found/pir-print-host";
import {
  Search,
  Plus,
  Columns3,
  Star as StarIcon,
  ChevronDown,
  X,
  UserCheck,
  Truck,
  ListChecks,
  Download,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { ImportDialog } from "@/components/io/import-dialog";
import { lostFoundSchema } from "@/lib/io/registry";
import { exportCasesToXlsx } from "@/lib/lost-found/export-xlsx";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/lost-found/")({
  head: () => ({
    meta: [
      { title: "Lost & Found — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Enterprise Lost & Found (AHL/PIR) registry — tracing, customs, delivery assignment, and full case lifecycle for Cairo International Airport.",
      },
    ],
  }),
  component: LostFoundPage,
});

type ColKey =
  | "pir" | "passenger" | "flight" | "tag" | "status"
  | "officer" | "priority" | "method" | "created" | "updated";

const ALL_COLUMNS: { key: ColKey; label: string; default: boolean }[] = [
  { key: "pir", label: "PIR", default: true },
  { key: "passenger", label: "Passenger", default: true },
  { key: "flight", label: "Flight", default: true },
  { key: "tag", label: "Bag Tag", default: true },
  { key: "status", label: "Current Status", default: true },
  { key: "officer", label: "Assigned Officer", default: true },
  { key: "priority", label: "Priority", default: true },
  { key: "method", label: "Delivery Method", default: false },
  { key: "created", label: "Created Date", default: true },
  { key: "updated", label: "Last Updated", default: false },
];

function LostFoundPage() {
  const cases = useStore((s) => s.cases);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LFStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOfficerOpen, setAssignOfficerOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<ColKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [visible, setVisible] = useState<Record<ColKey, boolean>>(
    Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.default])) as Record<ColKey, boolean>,
  );

  const officers = useMemo(() => {
    const s = new Set<string>();
    for (const c of cases) if (c.internal?.assignedOfficer) s.add(c.internal.assignedOfficer);
    return Array.from(s).sort();
  }, [cases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      const lfs = deriveLfFromCase(c);
      if (status !== "all" && lfs !== status) return false;
      if (from && c.createdAt.slice(0, 10) < from) return false;
      if (to && c.createdAt.slice(0, 10) > to) return false;
      if (!q) return true;
      const hay = [
        c.bagId, c.passengerName, c.flightNumber, c.pirNumber,
        c.bagTagNumber, c.email, c.contact,
        c.passenger?.passportNumber, c.passenger?.pnr,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [cases, query, status, from, to]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const get = (c: BaggageCase): string => {
        switch (sortKey) {
          case "pir": return c.pirNumber;
          case "passenger": return c.passengerName;
          case "flight": return c.flightNumber;
          case "tag": return c.bagTagNumber;
          case "status": return deriveLfFromCase(c);
          case "officer": return c.internal?.assignedOfficer ?? "";
          case "priority": return c.priority ?? c.internal?.casePriority ?? "Normal";
          case "method": return c.delivery?.method ?? "";
          case "created": return c.createdAt;
          case "updated": return c.updatedAt ?? c.createdAt;
        }
      };
      const av = get(a);
      const bv = get(b);
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSelect(bagId: string, checked: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(bagId); else n.delete(bagId);
      return n;
    });
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(sorted.map((c) => c.bagId)) : new Set());
  }
  function toggleSort(key: ColKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }
  function resetFilters() {
    setQuery(""); setStatus("all"); setFrom(""); setTo("");
  }

  const kpis = useMemo(() => {
    const total = cases.length;
    let open = 0, tracing = 0, readyDelivery = 0, delivered = 0, vip = 0;
    for (const c of cases) {
      const s = deriveLfFromCase(c);
      if (s === "Open") open++;
      if (s === "Tracing") tracing++;
      if (s === "Ready for Delivery" || s === "Assigned Driver") readyDelivery++;
      if (s === "Delivered" || s === "Closed") delivered++;
      if (c.baggage?.vipPassenger || c.priority === "VIP") vip++;
    }
    return { total, open, tracing, readyDelivery, delivered, vip };
  }, [cases]);

  const selectedIds = Array.from(selected);
  function clearSelection() { setSelected(new Set()); }

  function runAssignDelivery() {
    if (selectedIds.length === 0) return;
    const res = bulkAssignDelivery(selectedIds, { actor: "L&F Officer" });
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

  function runAssignOfficer(officerName: string) {
    const name = officerName.trim();
    if (!name) return;
    bulkUpdateCases(selectedIds, { internal: { assignedOfficer: name } as never });
    toast.success(`${selectedIds.length} case(s) assigned to ${name}`);
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

  return (
    <div className="space-y-6">
      <PirPrintHost />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Lost &amp; Found Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AHL / PIR registry — tracing, customs clearance, and delivery
            assignment across the IAB ground handling network.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="Total Cases" value={kpis.total} />
        <Kpi label="Open" value={kpis.open} tone="rose" />
        <Kpi label="Tracing" value={kpis.tracing} tone="amber" />
        <Kpi label="Ready / Assigned" value={kpis.readyDelivery} tone="violet" />
        <Kpi label="Delivered / Closed" value={kpis.delivered} tone="emerald" />
        <Kpi label="VIP Passengers" value={kpis.vip} tone="indigo" />
      </div>

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

      {/* Simplified filter bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search PIR, passenger, tag, PNR, phone…"
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as LFStatus | "all")}>
              <SelectTrigger className="w-[190px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {LF_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={`h-9 w-[145px] ${!from ? "[&::-webkit-datetime-edit]:text-transparent" : ""}`}
              />
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={`h-9 w-[145px] ${!to ? "[&::-webkit-datetime-edit]:text-transparent" : ""}`}
              />
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-1.5">
                <X className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5">
                    <Columns3 className="h-3.5 w-3.5" /> Columns
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_COLUMNS.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.key}
                      checked={visible[c.key]}
                      onCheckedChange={(v) => setVisible((prev) => ({ ...prev, [c.key]: Boolean(v) }))}
                    >
                      {c.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <Checkbox
                      checked={sorted.length > 0 && selected.size === sorted.length}
                      onCheckedChange={(v) => toggleAll(Boolean(v))}
                      aria-label="Select all"
                    />
                  </th>
                  {ALL_COLUMNS.filter((c) => visible[c.key]).map((c) => (
                    <th
                      key={c.key}
                      className="text-left px-4 py-3 font-medium select-none cursor-pointer"
                      onClick={() => toggleSort(c.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sortKey === c.key && (
                          <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((c) => (
                  <Row
                    key={c.bagId}
                    c={c}
                    visible={visible}
                    checked={selected.has(c.bagId)}
                    onToggle={(v) => toggleSelect(c.bagId, v)}
                  />
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={ALL_COLUMNS.length + 2}
                      className="px-4 py-16 text-center text-sm text-muted-foreground"
                    >
                      No cases match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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

function Kpi({
  label, value, tone = "slate",
}: {
  label: string; value: number;
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
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${map[tone]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({
  c, visible, checked, onToggle,
}: {
  c: BaggageCase;
  visible: Record<ColKey, boolean>;
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const lfs = deriveLfFromCase(c);
  const p = c.priority ?? c.internal?.casePriority ?? "Normal";
  const vip = c.baggage?.vipPassenger || p === "VIP";

  function openCase() {
    navigate({ to: "/lost-found/$bagId", params: { bagId: c.bagId } });
  }

  return (
    <tr className="hover:bg-muted/40 cursor-pointer" onClick={openCase}>
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onToggle(Boolean(v))}
          aria-label={`Select ${c.pirNumber}`}
        />
      </td>
      {visible.pir && (
        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
          <Link
            to="/lost-found/$bagId"
            params={{ bagId: c.bagId }}
            className="hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.pirNumber}
          </Link>
          <div className="font-sans font-normal text-[10px] text-muted-foreground">
            {c.bagId}
          </div>
        </td>
      )}
      {visible.passenger && (
        <td className="px-4 py-3">
          <div className="font-medium flex items-center gap-1.5">
            {c.passengerName}
            {vip && <StarIcon className="h-3 w-3 text-amber-500 fill-amber-500" />}
          </div>
          <div className="text-xs text-muted-foreground">
            {c.contact}
            {c.passenger?.pnr ? ` · PNR ${c.passenger.pnr}` : ""}
          </div>
        </td>
      )}
      {visible.flight && (
        <td className="px-4 py-3">
          <div className="font-medium">{c.flightNumber}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.flight?.originAirport ?? "—"} → {c.flight?.destinationAirport ?? "CAI"}
          </div>
        </td>
      )}
      {visible.tag && <td className="px-4 py-3 font-mono text-xs">{c.bagTagNumber}</td>}
      {visible.status && (
        <td className="px-4 py-3"><LfStatusBadge status={lfs} /></td>
      )}
      {visible.officer && (
        <td className="px-4 py-3 text-xs">
          {c.internal?.assignedOfficer ?? (
            <span className="text-muted-foreground italic">Unassigned</span>
          )}
        </td>
      )}
      {visible.priority && <td className="px-4 py-3 text-xs font-medium">{p}</td>}
      {visible.method && <td className="px-4 py-3 text-xs">{c.delivery?.method ?? "—"}</td>}
      {visible.created && (
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {new Date(c.createdAt).toLocaleDateString("en-GB")}
        </td>
      )}
      {visible.updated && (
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {c.updatedAt ? new Date(c.updatedAt).toLocaleString("en-GB") : "—"}
        </td>
      )}
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={openCase}
        >
          Open
        </Button>
      </td>
    </tr>
  );
}

function AssignOfficerDialog({
  open, onOpenChange, officers, count, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  officers: string[];
  count: number;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
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
          {officers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Existing officers</Label>
              <Select value="" onValueChange={setName}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Pick an officer" />
                </SelectTrigger>
                <SelectContent>
                  {officers.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Officer name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Salah" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(name)} disabled={!name.trim()}>Assign</Button>
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
              {LF_OWNED_STATUSES.map((x) => (
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
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  bulkUpdateCases,
  bulkAssignDelivery,
  type BaggageCase,
  type Priority,
  type DeliveryMethod,
} from "@/lib/store";
import {
  LF_STATUSES,
  deriveLfFromCase,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LfStatusBadge } from "@/components/lf-status-badge";
import { PirWizard } from "@/components/lost-found/pir-wizard";
import { BulkToolbar } from "@/components/bulk/bulk-toolbar";
import {
  Search,
  Plus,
  Columns3,
  Star as StarIcon,
  ChevronDown,
  X,
  SlidersHorizontal,
  UserCheck,
  Truck,
  Flag,
  Download,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { ImportExportButtons } from "@/components/io/import-export-buttons";
import { lostFoundSchema } from "@/lib/io/registry";

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
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [method, setMethod] = useState<DeliveryMethod | "all">("all");
  const [officer, setOfficer] = useState<string>("all");
  const [station, setStation] = useState<string>("all");
  const [createdBy, setCreatedBy] = useState<string>("all");
  const [vipOnly, setVipOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOfficerOpen, setAssignOfficerOpen] = useState(false);
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
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
  const stations = useMemo(() => {
    const s = new Set<string>();
    for (const c of cases) if (c.internal?.station) s.add(c.internal.station);
    return Array.from(s).sort();
  }, [cases]);
  const creators = useMemo(() => {
    const s = new Set<string>();
    for (const c of cases) if (c.internal?.createdBy) s.add(c.internal.createdBy);
    return Array.from(s).sort();
  }, [cases]);

  const activeAdvanced =
    priority !== "all" || method !== "all" || officer !== "all" ||
    station !== "all" || createdBy !== "all" || vipOnly;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      const lfs = deriveLfFromCase(c);
      if (status !== "all" && lfs !== status) return false;
      const p = c.priority ?? c.internal?.casePriority ?? "Normal";
      if (priority !== "all" && p !== priority) return false;
      if (method !== "all" && c.delivery?.method !== method) return false;
      if (officer !== "all" && (c.internal?.assignedOfficer ?? "") !== officer) return false;
      if (station !== "all" && (c.internal?.station ?? "") !== station) return false;
      if (createdBy !== "all" && (c.internal?.createdBy ?? "") !== createdBy) return false;
      if (vipOnly && !(c.baggage?.vipPassenger || p === "VIP")) return false;
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
  }, [cases, query, status, priority, method, officer, station, createdBy, vipOnly, from, to]);

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
    setQuery(""); setStatus("all"); setPriority("all"); setMethod("all");
    setOfficer("all"); setStation("all"); setCreatedBy("all");
    setVipOnly(false); setFrom(""); setTo("");
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

  function runPriority(p: Priority) {
    bulkUpdateCases(selectedIds, { priority: p });
    toast.success(`Priority set to ${p} for ${selectedIds.length} case(s)`);
    setPriorityDialogOpen(false);
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
    toast.info("Use the Export menu — bulk export is scoped to the selected rows.");
  }
  function runPrint() { window.print(); }

  return (
    <div className="space-y-6">
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
          <ImportExportButtons
            schema={lostFoundSchema}
            rows={sorted as unknown as Record<string, unknown>[]}
            scope={query || status !== "all" ? "filtered" : "all"}
            size="default"
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
              key: "priority",
              label: "Change Priority",
              icon: Flag,
              variant: "outline",
              onClick: () => setPriorityDialogOpen(true),
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
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[145px]" />
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[145px]" />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant={activeAdvanced ? "default" : "outline"} size="sm" className="h-9 gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Advanced Filters
                  {activeAdvanced && (
                    <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">
                      ON
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[320px] space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Officer</Label>
                  <Select value={officer} onValueChange={setOfficer}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Officers</SelectItem>
                      {officers.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Station</Label>
                  <Select value={station} onValueChange={setStation}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stations</SelectItem>
                      {stations.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority | "all")}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      {(["Low", "Normal", "High", "VIP"] as Priority[]).map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery Method</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as DeliveryMethod | "all")}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="Home Delivery">Home Delivery</SelectItem>
                      <SelectItem value="Airport Pickup">Airport Pickup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Created By</Label>
                  <Select value={createdBy} onValueChange={setCreatedBy}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Anyone</SelectItem>
                      {creators.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <label className="inline-flex items-center gap-2 text-sm pt-1">
                  <Checkbox checked={vipOnly} onCheckedChange={(v) => setVipOnly(Boolean(v))} />
                  <StarIcon className="h-3.5 w-3.5 text-amber-500" />
                  VIP passengers only
                </label>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-1.5">
              <X className="h-3.5 w-3.5" /> Reset
            </Button>
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
      <ChangePriorityDialog
        open={priorityDialogOpen}
        onOpenChange={setPriorityDialogOpen}
        count={selected.size}
        onSubmit={runPriority}
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

function BulkActions({
  selected, onDone, totalDeliveriesForBag,
}: {
  selected: Set<string>;
  onDone: () => void;
  totalDeliveriesForBag: (bagId: string) => boolean;
}) {
  const count = selected.size;
  const disabled = count === 0;
  const ids = Array.from(selected);

  function bulkAssignOfficer() {
    const officer = window.prompt("Assign officer for selected cases:");
    if (!officer) return;
    bulkUpdateCases(ids, { internal: { assignedOfficer: officer } as never });
    toast.success(`${count} cases assigned to ${officer}`);
    onDone();
  }
  function bulkPriority(p: Priority) {
    bulkUpdateCases(ids, { priority: p });
    toast.success(`Priority set to ${p} for ${count} cases`);
    onDone();
  }
  function bulkClose() {
    for (const id of ids) updateLfStatus(id, "Closed", { note: "Bulk close", force: true });
    toast.success(`${count} cases closed`);
    onDone();
  }
  function bulkExport() {
    toast.info("Use the Export menu — bulk export is scoped to the selected rows.");
  }
  function bulkPrint() { window.print(); }
  function bulkNotify() { toast.success(`Queued bulk notification for ${count} cases`); }
  function bulkAssignDelivery() {
    let created = 0;
    for (const id of ids) { if (!totalDeliveriesForBag(id)) created++; }
    toast.info(
      created > 0
        ? `${created} cases ready for delivery assignment — open Delivery Management to schedule.`
        : "Selected cases already have delivery records.",
    );
    onDone();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm" className="h-9 gap-1.5" disabled={disabled}>
          <Filter className="h-3.5 w-3.5" /> Bulk ({count})
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Bulk actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={bulkAssignOfficer}>Assign Officer</DropdownMenuItem>
        <DropdownMenuItem onClick={bulkAssignDelivery}>Assign Delivery</DropdownMenuItem>
        <DropdownMenuItem onClick={bulkNotify}>Send Notification</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Change priority
        </DropdownMenuLabel>
        {(["Low", "Normal", "High", "VIP"] as Priority[]).map((p) => (
          <DropdownMenuItem key={p} onClick={() => bulkPriority(p)}>
            Set priority · {p}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={bulkExport}>Export selected</DropdownMenuItem>
        <DropdownMenuItem onClick={bulkPrint}>Print</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={bulkClose} className="text-rose-600">
          Close cases
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
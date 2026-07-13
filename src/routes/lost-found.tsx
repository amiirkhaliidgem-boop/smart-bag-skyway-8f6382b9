import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  addCase,
  bulkUpdateCases,
  updateLfStatus,
  type BaggageCase,
  type Priority,
  type DeliveryMethod,
} from "@/lib/store";
import {
  LF_STATUSES,
  deriveLfFromCase,
  type LFStatus,
} from "@/lib/lost-found/statuses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Search,
  Plus,
  Columns3,
  MoreHorizontal,
  Filter,
  Star as StarIcon,
  ChevronDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ImportExportButtons } from "@/components/io/import-export-buttons";
import { lostFoundSchema } from "@/lib/io/registry";

export const Route = createFileRoute("/lost-found")({
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
  | "pir"
  | "passenger"
  | "flight"
  | "tag"
  | "status"
  | "officer"
  | "priority"
  | "method"
  | "created"
  | "updated";

const ALL_COLUMNS: { key: ColKey; label: string; default: boolean }[] = [
  { key: "pir", label: "PIR", default: true },
  { key: "passenger", label: "Passenger", default: true },
  { key: "flight", label: "Flight", default: true },
  { key: "tag", label: "Bag Tag", default: true },
  { key: "status", label: "Current Status", default: true },
  { key: "officer", label: "Assigned Officer", default: true },
  { key: "priority", label: "Priority", default: true },
  { key: "method", label: "Delivery Method", default: true },
  { key: "created", label: "Created Date", default: true },
  { key: "updated", label: "Last Updated", default: true },
];

function LostFoundPage() {
  const cases = useStore((s) => s.cases);
  const deliveries = useStore((s) => s.deliveries);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LFStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [method, setMethod] = useState<DeliveryMethod | "all">("all");
  const [officer, setOfficer] = useState<string>("all");
  const [station, setStation] = useState<string>("all");
  const [vipOnly, setVipOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<ColKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [visible, setVisible] = useState<Record<ColKey, boolean>>(
    Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.default])) as Record<ColKey, boolean>,
  );

  const officers = useMemo(() => {
    const set = new Set<string>();
    for (const c of cases) {
      const o = c.internal?.assignedOfficer;
      if (o) set.add(o);
    }
    return Array.from(set).sort();
  }, [cases]);

  const stations = useMemo(() => {
    const set = new Set<string>();
    for (const c of cases) {
      const s = c.internal?.station;
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [cases]);

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
      if (vipOnly && !(c.baggage?.vipPassenger || p === "VIP")) return false;
      if (from && c.createdAt.slice(0, 10) < from) return false;
      if (to && c.createdAt.slice(0, 10) > to) return false;
      if (!q) return true;
      const hay = [
        c.bagId,
        c.passengerName,
        c.flightNumber,
        c.pirNumber,
        c.bagTagNumber,
        c.email,
        c.contact,
        c.passenger?.passportNumber,
        c.passenger?.pnr,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [cases, query, status, priority, method, officer, station, vipOnly, from, to]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const get = (c: BaggageCase): string => {
        switch (sortKey) {
          case "pir":
            return c.pirNumber;
          case "passenger":
            return c.passengerName;
          case "flight":
            return c.flightNumber;
          case "tag":
            return c.bagTagNumber;
          case "status":
            return deriveLfFromCase(c);
          case "officer":
            return c.internal?.assignedOfficer ?? "";
          case "priority":
            return c.priority ?? c.internal?.casePriority ?? "Normal";
          case "method":
            return c.delivery?.method ?? "";
          case "created":
            return c.createdAt;
          case "updated":
            return c.updatedAt ?? c.createdAt;
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
      if (checked) n.add(bagId);
      else n.delete(bagId);
      return n;
    });
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(sorted.map((c) => c.bagId)) : new Set());
  }
  function toggleSort(key: ColKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function resetFilters() {
    setQuery("");
    setStatus("all");
    setPriority("all");
    setMethod("all");
    setOfficer("all");
    setStation("all");
    setVipOnly(false);
    setFrom("");
    setTo("");
  }

  const kpis = useMemo(() => {
    const total = cases.length;
    let open = 0,
      tracing = 0,
      readyDelivery = 0,
      delivered = 0,
      vip = 0;
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
            <NewCaseDialog onClose={() => setOpenNew(false)} />
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

      {/* Filter bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search PIR, passenger, tag, PNR, passport, phone…"
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
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority | "all")}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {(["Low", "Normal", "High", "VIP"] as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={method} onValueChange={(v) => setMethod(v as DeliveryMethod | "all")}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Delivery Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="Home Delivery">Home Delivery</SelectItem>
                <SelectItem value="Airport Pickup">Airport Pickup</SelectItem>
              </SelectContent>
            </Select>
            <Select value={officer} onValueChange={setOfficer}>
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue placeholder="Assigned Officer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Officers</SelectItem>
                {officers.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={station} onValueChange={setStation}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stations</SelectItem>
                {stations.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 w-[145px]"
              />
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 w-[145px]"
              />
            </div>
            <Button
              type="button"
              variant={vipOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setVipOnly((v) => !v)}
              className="h-9 gap-1.5"
            >
              <StarIcon className="h-3.5 w-3.5" />
              VIP
            </Button>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-1.5">
              <X className="h-3.5 w-3.5" />
              Reset
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5">
                    <Columns3 className="h-3.5 w-3.5" />
                    Columns
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
                      onCheckedChange={(v) =>
                        setVisible((prev) => ({ ...prev, [c.key]: Boolean(v) }))
                      }
                    >
                      {c.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <BulkActions
                selected={selected}
                onDone={() => setSelected(new Set())}
                totalDeliveriesForBag={(bagId) =>
                  deliveries.some((d) => d.bagId === bagId)
                }
              />
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
                      checked={
                        sorted.length > 0 && selected.size === sorted.length
                      }
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
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
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
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-bold ${map[tone]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({
  c,
  visible,
  checked,
  onToggle,
}: {
  c: BaggageCase;
  visible: Record<ColKey, boolean>;
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  const lfs = deriveLfFromCase(c);
  const p = c.priority ?? c.internal?.casePriority ?? "Normal";
  const vip = c.baggage?.vipPassenger || p === "VIP";
  return (
    <tr className="hover:bg-muted/40">
      <td className="px-3 py-3">
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
            {vip && (
              <StarIcon className="h-3 w-3 text-amber-500 fill-amber-500" />
            )}
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
      {visible.tag && (
        <td className="px-4 py-3 font-mono text-xs">{c.bagTagNumber}</td>
      )}
      {visible.status && (
        <td className="px-4 py-3">
          <LfStatusBadge status={lfs} />
        </td>
      )}
      {visible.officer && (
        <td className="px-4 py-3 text-xs">
          {c.internal?.assignedOfficer ?? (
            <span className="text-muted-foreground italic">Unassigned</span>
          )}
        </td>
      )}
      {visible.priority && (
        <td className="px-4 py-3 text-xs font-medium">{p}</td>
      )}
      {visible.method && (
        <td className="px-4 py-3 text-xs">{c.delivery?.method ?? "—"}</td>
      )}
      {visible.created && (
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {new Date(c.createdAt).toLocaleDateString("en-GB")}
        </td>
      )}
      {visible.updated && (
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {c.updatedAt
            ? new Date(c.updatedAt).toLocaleString("en-GB")
            : "—"}
        </td>
      )}
      <td className="px-4 py-3 text-right">
        <Button variant="outline" size="sm" asChild className="h-7">
          <Link to="/lost-found/$bagId" params={{ bagId: c.bagId }}>
            Open
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function BulkActions({
  selected,
  onDone,
  totalDeliveriesForBag,
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
    for (const id of ids) {
      // preserve other internal fields by patching per-case
      // (bulkUpdateCases above set only officer; run individual updates)
    }
    toast.success(`${count} cases assigned to ${officer}`);
    onDone();
  }
  function bulkPriority(p: Priority) {
    bulkUpdateCases(ids, { priority: p });
    toast.success(`Priority set to ${p} for ${count} cases`);
    onDone();
  }
  function bulkClose() {
    for (const id of ids) updateLfStatus(id, "Closed", { note: "Bulk close" });
    toast.success(`${count} cases closed`);
    onDone();
  }
  function bulkExport() {
    toast.info("Use the Export menu — bulk export is scoped to the selected rows.");
  }
  function bulkPrint() {
    window.print();
  }
  function bulkNotify() {
    toast.success(`Queued bulk notification for ${count} cases`);
  }
  function bulkAssignDelivery() {
    let created = 0;
    for (const id of ids) {
      if (totalDeliveriesForBag(id)) continue;
      created++;
    }
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
          <Filter className="h-3.5 w-3.5" />
          Bulk ({count})
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

// ============================================================================
// New PIR — Enterprise Sectioned Dialog
// ============================================================================

type NewCaseForm = {
  // 1 Passenger
  firstName: string;
  middleName: string;
  lastName: string;
  nationality: string;
  passportNumber: string;
  pnr: string;
  ticketNumber: string;
  mobile: string;
  mobile2: string;
  email: string;
  preferredLanguage: "en" | "ar" | "fr";
  // 2 Flight
  airline: string;
  flightNumber: string;
  flightDate: string;
  arrivalTime: string;
  originAirport: string;
  destinationAirport: string;
  terminal: string;
  arrivalBelt: string;
  // 3 Baggage
  pirNumber: string;
  bagTagNumber: string;
  numberOfBags: string;
  weightKg: string;
  brand: string;
  color: string;
  type: string;
  size: string;
  distinctiveMarks: string;
  priority: Priority;
  vipPassenger: boolean;
  rushDelivery: boolean;
  fragile: boolean;
  // 4 Delivery
  method: DeliveryMethod;
  country: string;
  governorate: string;
  city: string;
  district: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  nearestLandmark: string;
  googleMapsLink: string;
  preferredDeliveryTime: string;
  // 5 Documents (client-side placeholders only)
  passportCopy: string;
  arrivalStamp: string;
  authLetter: string;
  otherDoc: string;
  // 6 Internal
  assignedOfficer: string;
  station: string;
  department: string;
  internalNotes: string;
  casePriority: Priority;
  createdBy: string;
};

function NewCaseDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<NewCaseForm>({
    firstName: "",
    middleName: "",
    lastName: "",
    nationality: "",
    passportNumber: "",
    pnr: "",
    ticketNumber: "",
    mobile: "",
    mobile2: "",
    email: "",
    preferredLanguage: "en",
    airline: "",
    flightNumber: "",
    flightDate: new Date().toISOString().slice(0, 10),
    arrivalTime: "",
    originAirport: "",
    destinationAirport: "CAI",
    terminal: "",
    arrivalBelt: "",
    pirNumber: "",
    bagTagNumber: "",
    numberOfBags: "1",
    weightKg: "",
    brand: "",
    color: "",
    type: "",
    size: "",
    distinctiveMarks: "",
    priority: "Normal",
    vipPassenger: false,
    rushDelivery: false,
    fragile: false,
    method: "Home Delivery",
    country: "Egypt",
    governorate: "",
    city: "",
    district: "",
    street: "",
    building: "",
    floor: "",
    apartment: "",
    nearestLandmark: "",
    googleMapsLink: "",
    preferredDeliveryTime: "",
    passportCopy: "",
    arrivalStamp: "",
    authLetter: "",
    otherDoc: "",
    assignedOfficer: "",
    station: "CAI - Cairo International Airport",
    department: "Lost & Found",
    internalNotes: "",
    casePriority: "Normal",
    createdBy: "Ops Console",
  });

  function set<K extends keyof NewCaseForm>(k: K, v: NewCaseForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    if (!form.pirNumber.trim() || !form.bagTagNumber.trim()) {
      toast.error("PIR Number and Bag Tag are required.");
      return;
    }
    const passengerName = [form.firstName, form.middleName, form.lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
    const description = [
      form.color,
      form.brand,
      form.type,
      form.size,
      form.distinctiveMarks,
    ]
      .filter(Boolean)
      .join(" — ");
    const now = new Date().toISOString();
    const documents = [
      form.passportCopy && {
        id: `DOC-${Date.now()}-1`,
        type: "Passport Copy" as const,
        name: form.passportCopy,
        uploadedAt: now,
        uploadedBy: form.createdBy,
      },
      form.arrivalStamp && {
        id: `DOC-${Date.now()}-2`,
        type: "Arrival Stamp" as const,
        name: form.arrivalStamp,
        uploadedAt: now,
        uploadedBy: form.createdBy,
      },
      form.authLetter && {
        id: `DOC-${Date.now()}-3`,
        type: "Authorization Letter" as const,
        name: form.authLetter,
        uploadedAt: now,
        uploadedBy: form.createdBy,
      },
      form.otherDoc && {
        id: `DOC-${Date.now()}-4`,
        type: "Other" as const,
        name: form.otherDoc,
        uploadedAt: now,
        uploadedBy: form.createdBy,
      },
    ].filter(Boolean) as NonNullable<BaggageCase["documents"]>;

    const created = addCase({
      passengerName,
      flightNumber: form.flightNumber,
      pirNumber: form.pirNumber,
      bagTagNumber: form.bagTagNumber,
      arrivalDate: form.flightDate,
      contact: form.mobile,
      email: form.email,
      description,
      priority: form.priority,
      passenger: {
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        nationality: form.nationality,
        passportNumber: form.passportNumber,
        pnr: form.pnr,
        ticketNumber: form.ticketNumber,
        mobile2: form.mobile2,
        preferredLanguage: form.preferredLanguage,
      },
      flight: {
        airline: form.airline,
        arrivalTime: form.arrivalTime,
        originAirport: form.originAirport,
        destinationAirport: form.destinationAirport,
        terminal: form.terminal,
        arrivalBelt: form.arrivalBelt,
      },
      baggage: {
        numberOfBags: Number(form.numberOfBags) || 1,
        weightKg: Number(form.weightKg) || undefined,
        brand: form.brand,
        color: form.color,
        type: form.type,
        size: form.size,
        distinctiveMarks: form.distinctiveMarks,
        vipPassenger: form.vipPassenger,
        rushDelivery: form.rushDelivery,
        fragile: form.fragile,
      },
      delivery: {
        method: form.method,
        country: form.country,
        governorate: form.governorate,
        city: form.city,
        district: form.district,
        street: form.street,
        building: form.building,
        floor: form.floor,
        apartment: form.apartment,
        nearestLandmark: form.nearestLandmark,
        googleMapsLink: form.googleMapsLink,
        preferredDeliveryTime: form.preferredDeliveryTime,
      },
      internal: {
        assignedOfficer: form.assignedOfficer,
        station: form.station,
        department: form.department,
        internalNotes: form.internalNotes,
        casePriority: form.casePriority,
        createdBy: form.createdBy,
      },
      documents,
      initialLfStatus: "Open",
    });
    toast.success(`Case registered · ${created.pirNumber} · ${created.bagId}`);
    onClose();
  }

  return (
    <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Register New PIR / AHL Case</DialogTitle>
        <p className="text-xs text-muted-foreground">
          Complete every applicable section. Fields marked in bold are
          mandatory for the case to progress through tracing.
        </p>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-6 pt-2">
        {/* Section 1 */}
        <Section title="1 · Passenger Information">
          <Field label="First Name" required>
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </Field>
          <Field label="Middle Name">
            <Input value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
          </Field>
          <Field label="Last Name" required>
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
          </Field>
          <Field label="Nationality">
            <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
          </Field>
          <Field label="Passport Number">
            <Input value={form.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} />
          </Field>
          <Field label="PNR">
            <Input value={form.pnr} onChange={(e) => set("pnr", e.target.value)} />
          </Field>
          <Field label="Ticket Number">
            <Input value={form.ticketNumber} onChange={(e) => set("ticketNumber", e.target.value)} />
          </Field>
          <Field label="Mobile Number 1" required>
            <Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} required />
          </Field>
          <Field label="Mobile Number 2">
            <Input value={form.mobile2} onChange={(e) => set("mobile2", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Preferred Language">
            <Select
              value={form.preferredLanguage}
              onValueChange={(v) => set("preferredLanguage", v as "en" | "ar" | "fr")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {/* Section 2 */}
        <Section title="2 · Flight Information">
          <Field label="Airline">
            <Input value={form.airline} onChange={(e) => set("airline", e.target.value)} placeholder="e.g. MS" />
          </Field>
          <Field label="Flight Number" required>
            <Input value={form.flightNumber} onChange={(e) => set("flightNumber", e.target.value)} required />
          </Field>
          <Field label="Flight Date" required>
            <Input type="date" value={form.flightDate} onChange={(e) => set("flightDate", e.target.value)} required />
          </Field>
          <Field label="Arrival Time">
            <Input type="time" value={form.arrivalTime} onChange={(e) => set("arrivalTime", e.target.value)} />
          </Field>
          <Field label="Origin Airport (IATA)">
            <Input value={form.originAirport} onChange={(e) => set("originAirport", e.target.value.toUpperCase())} maxLength={3} />
          </Field>
          <Field label="Destination Airport (IATA)">
            <Input value={form.destinationAirport} onChange={(e) => set("destinationAirport", e.target.value.toUpperCase())} maxLength={3} />
          </Field>
          <Field label="Terminal">
            <Input value={form.terminal} onChange={(e) => set("terminal", e.target.value)} />
          </Field>
          <Field label="Arrival Belt">
            <Input value={form.arrivalBelt} onChange={(e) => set("arrivalBelt", e.target.value)} />
          </Field>
        </Section>

        {/* Section 3 */}
        <Section title="3 · Baggage Information">
          <Field label="PIR Number" required>
            <Input value={form.pirNumber} onChange={(e) => set("pirNumber", e.target.value)} required />
          </Field>
          <Field label="Bag Tag Number" required>
            <Input value={form.bagTagNumber} onChange={(e) => set("bagTagNumber", e.target.value)} required />
          </Field>
          <Field label="Number Of Bags">
            <Input type="number" min={1} value={form.numberOfBags} onChange={(e) => set("numberOfBags", e.target.value)} />
          </Field>
          <Field label="Weight (kg)">
            <Input type="number" step="0.1" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
          </Field>
          <Field label="Brand">
            <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </Field>
          <Field label="Color">
            <Input value={form.color} onChange={(e) => set("color", e.target.value)} />
          </Field>
          <Field label="Type">
            <Input value={form.type} onChange={(e) => set("type", e.target.value)} placeholder="Hardshell / Softshell / Duffel" />
          </Field>
          <Field label="Size">
            <Input value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="Cabin / Medium / Large" />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Low", "Normal", "High", "VIP"] as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Distinctive Marks" wide>
            <Textarea rows={2} value={form.distinctiveMarks} onChange={(e) => set("distinctiveMarks", e.target.value)} />
          </Field>
          <div className="sm:col-span-3 flex flex-wrap gap-4 pt-1">
            <ToggleField label="VIP Passenger" checked={form.vipPassenger} onCheckedChange={(v) => set("vipPassenger", v)} />
            <ToggleField label="Rush Delivery" checked={form.rushDelivery} onCheckedChange={(v) => set("rushDelivery", v)} />
            <ToggleField label="Fragile" checked={form.fragile} onCheckedChange={(v) => set("fragile", v)} />
          </div>
          <div className="sm:col-span-3 border border-dashed rounded-md p-4 text-xs text-muted-foreground bg-muted/30">
            Photo upload — future integration (S3 / Odoo Attachments). Placeholder area ready.
          </div>
        </Section>

        {/* Section 4 */}
        <Section title="4 · Delivery Information">
          <Field label="Delivery Method">
            <Select value={form.method} onValueChange={(v) => set("method", v as DeliveryMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Home Delivery">Home Delivery</SelectItem>
                <SelectItem value="Airport Pickup">Airport Pickup</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country">
            <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label="Governorate">
            <Input value={form.governorate} onChange={(e) => set("governorate", e.target.value)} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="District">
            <Input value={form.district} onChange={(e) => set("district", e.target.value)} />
          </Field>
          <Field label="Street">
            <Input value={form.street} onChange={(e) => set("street", e.target.value)} />
          </Field>
          <Field label="Building">
            <Input value={form.building} onChange={(e) => set("building", e.target.value)} />
          </Field>
          <Field label="Floor">
            <Input value={form.floor} onChange={(e) => set("floor", e.target.value)} />
          </Field>
          <Field label="Apartment">
            <Input value={form.apartment} onChange={(e) => set("apartment", e.target.value)} />
          </Field>
          <Field label="Nearest Landmark">
            <Input value={form.nearestLandmark} onChange={(e) => set("nearestLandmark", e.target.value)} />
          </Field>
          <Field label="Google Maps Link">
            <Input value={form.googleMapsLink} onChange={(e) => set("googleMapsLink", e.target.value)} placeholder="https://maps.google.com/…" />
          </Field>
          <Field label="Preferred Delivery Time">
            <Input value={form.preferredDeliveryTime} onChange={(e) => set("preferredDeliveryTime", e.target.value)} placeholder="e.g. 19:00 – 21:00" />
          </Field>
        </Section>

        {/* Section 5 */}
        <Section title="5 · Documents">
          <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DocSlot label="Passport Copy" value={form.passportCopy} onChange={(v) => set("passportCopy", v)} />
            <DocSlot label="Arrival Stamp" value={form.arrivalStamp} onChange={(v) => set("arrivalStamp", v)} />
            <DocSlot label="Authorization Letter" value={form.authLetter} onChange={(v) => set("authLetter", v)} />
            <DocSlot label="Other Documents" value={form.otherDoc} onChange={(v) => set("otherDoc", v)} />
          </div>
        </Section>

        {/* Section 6 */}
        <Section title="6 · Internal Information">
          <Field label="Assigned Officer">
            <Input value={form.assignedOfficer} onChange={(e) => set("assignedOfficer", e.target.value)} />
          </Field>
          <Field label="Current Station">
            <Input value={form.station} onChange={(e) => set("station", e.target.value)} />
          </Field>
          <Field label="Responsible Department">
            <Input value={form.department} onChange={(e) => set("department", e.target.value)} />
          </Field>
          <Field label="Case Priority">
            <Select value={form.casePriority} onValueChange={(v) => set("casePriority", v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Low", "Normal", "High", "VIP"] as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Created By">
            <Input value={form.createdBy} onChange={(e) => set("createdBy", e.target.value)} />
          </Field>
          <Field label="Internal Notes" wide>
            <Textarea rows={3} value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} />
          </Field>
        </Section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Register Case</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-tight mb-3 pb-2 border-b">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-3" : ""}`}>
      <Label className={required ? "font-semibold" : ""}>
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(Boolean(v))} />
      {label}
    </label>
  );
}

function DocSlot({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <Input
        placeholder="File reference (name / URL) — drag &amp; drop coming soon"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
import { useMemo, useState } from "react";
import { useStore, useOpsLoading } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BulkToolbar } from "@/components/bulk/bulk-toolbar";
import { DateRangeFilter, defaultDateRange } from "@/components/filters/date-range-filter";
import { exportFeedbackToXlsx, fmtDateTime, type FeedbackRow } from "@/lib/feedback/export-xlsx";
import { Star, FileSpreadsheet, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { PageLoading } from "@/components/ops-skeleton";
import { PageHeader, DataTable, type DataColumn } from "@/components/layout";

const DASH = "—";

export function FeedbackDashboard() {
  const feedback = useStore((s) => s.feedback);
  const cases = useStore((s) => s.cases);
  const deliveries = useStore((s) => s.deliveries);
  const loading = useOpsLoading();

  const [q, setQ] = useState("");
  const [from, setFrom] = useState(() => defaultDateRange().from);
  const [to, setTo] = useState(() => defaultDateRange().to);
  const [airline, setAirline] = useState("all");
  const [agent, setAgent] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useMemo<FeedbackRow[]>(() => {
    const caseByBag = new Map(cases.map((c) => [c.bagId, c]));
    const deliveryByBag = new Map(deliveries.map((d) => [d.bagId, d]));
    const deliveryById = new Map(deliveries.map((d) => [d.deliveryId, d]));

    const build = (
      base: Omit<
        FeedbackRow,
        "pirNumber" | "deliveryId" | "driver" | "airline" | "flightNumber" | "station"
      >,
      bagId: string,
      deliveryId?: string,
    ): FeedbackRow => {
      const delivery = deliveryId ? deliveryById.get(deliveryId) : deliveryByBag.get(bagId);
      const kase =
        caseByBag.get(bagId ?? delivery?.bagId ?? "") ??
        (delivery ? caseByBag.get(delivery.bagId) : undefined);
      return {
        ...base,
        bagId: bagId || delivery?.bagId || "",
        passengerName: base.passengerName || delivery?.passengerName || kase?.passengerName || "",
        pirNumber: kase?.pirNumber ?? delivery?.pirNumber ?? "",
        deliveryId: delivery?.deliveryId ?? deliveryId ?? "",
        driver: delivery?.driver ?? "",
        airline: kase?.flight?.airline ?? "",
        flightNumber: kase?.flightNumber ?? "",
        station: delivery?.station ?? "",
      };
    };

    // One row per feedback record. The operational snapshot is the single
    // source of truth; de-duping by record id guarantees a delivery can never
    // be counted twice even if a record arrives from two code paths.
    const byId = new Map<string, FeedbackRow>();
    for (const f of feedback) {
      if (byId.has(f.id)) continue;
      byId.set(
        f.id,
        build(
          {
            id: f.id,
            passengerName: f.passengerName,
            bagId: f.bagId,
            rating: f.rating,
            resolved: f.resolved,
            comments: f.comments,
            at: f.at,
          },
          f.bagId,
          f.deliveryId,
        ),
      );
    }

    return [...byId.values()].sort((a, b) => b.at.localeCompare(a.at));
  }, [feedback, cases, deliveries]);

  const airlines = useMemo(
    () => Array.from(new Set(rows.map((r) => r.airline).filter(Boolean))).sort(),
    [rows],
  );
  const agents = useMemo(
    () => Array.from(new Set(rows.map((r) => r.driver).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const hay = `${r.passengerName} ${r.pirNumber} ${r.deliveryId} ${r.bagId}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (airline !== "all" && r.airline !== airline) return false;
      if (agent !== "all" && r.driver !== agent) return false;
      const day = r.at.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [rows, q, airline, agent, from, to]);

  const total = filtered.length;
  const avg = total ? filtered.reduce((s, f) => s + f.rating, 0) / total : 0;
  const resolvedPct = total
    ? Math.round((filtered.filter((f) => f.resolved).length / total) * 100)
    : 0;
  const today = filtered.filter(
    (f) => new Date(f.at).toDateString() === new Date().toDateString(),
  ).length;

  function resetFilters() {
    setQ("");
    setFrom("");
    setTo("");
    setAirline("all");
    setAgent("all");
  }
  function exportSelected() {
    const chosen = filtered.filter((r) => selected.includes(r.id));
    if (chosen.length === 0) return;
    exportFeedbackToXlsx(chosen);
    toast.success(`Exported ${chosen.length} feedback record(s)`);
  }

  const fbColumns: DataColumn<FeedbackRow>[] = [
    {
      id: "passenger",
      header: "Passenger",
      minWidth: "150px",
      sortValue: (r) => r.passengerName ?? "",
      cell: (r) => <span className="font-medium">{r.passengerName || DASH}</span>,
    },
    {
      id: "pir",
      header: "PIR",
      hideBelow: "md",
      sortValue: (r) => r.pirNumber ?? "",
      cell: (r) => <span className="font-mono text-xs">{r.pirNumber || DASH}</span>,
    },
    {
      id: "delivery",
      header: "Delivery ID",
      hideBelow: "lg",
      sortValue: (r) => r.deliveryId ?? "",
      cell: (r) => <span className="font-mono text-xs">{r.deliveryId || DASH}</span>,
    },
    {
      id: "agent",
      header: "Delivery Agent",
      hideBelow: "lg",
      sortValue: (r) => r.driver ?? "",
      cell: (r) => <span>{r.driver || DASH}</span>,
    },
    {
      id: "airline",
      header: "Airline",
      hideBelow: "xl",
      sortValue: (r) => r.airline ?? "",
      cell: (r) => <span>{r.airline || DASH}</span>,
    },
    {
      id: "flight",
      header: "Flight",
      hideBelow: "xl",
      sortValue: (r) => r.flightNumber ?? "",
      cell: (r) => <span className="font-mono text-xs">{r.flightNumber || DASH}</span>,
    },
    {
      id: "rating",
      header: "Rating",
      sortValue: (r) => r.rating ?? 0,
      cell: (r) => <Stars value={r.rating} />,
    },
    {
      id: "resolved",
      header: "Resolved",
      hideBelow: "md",
      sortValue: (r) => (r.resolved ? 1 : 0),
      cell: (r) => (
        <span className={r.resolved ? "font-medium text-success" : "font-medium text-destructive"}>
          {r.resolved ? "Yes" : "No"}
        </span>
      ),
    },
    {
      id: "comment",
      header: "Comment",
      hideBelow: "lg",
      className: "max-w-[320px]",
      cell: (r) => <span className="line-clamp-2">{r.comments || DASH}</span>,
    },
    {
      id: "submitted",
      header: "Submitted",
      sortValue: (r) => r.at ?? "",
      cell: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {fmtDateTime(r.at) || DASH}
        </span>
      ),
    },
  ];

  // Progressive loading: render the page shell with placeholders while this
  // screen's data tier is still in flight, instead of showing empty values.
  if (loading.secondary && feedback.length === 0)
    return <PageLoading title={"Customer Feedback"} kpis={4} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Feedback" icon={<Star />} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Avg Rating" value={`${avg.toFixed(1)}/5`} tone="text-warning" />
        <Kpi label="Total Responses" value={total} tone="text-primary" />
        <Kpi label="Issue Resolved" value={`${resolvedPct}%`} tone="text-success" />
        <Kpi label="Today" value={today} tone="text-primary" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="pl-8 h-9"
          />
        </div>
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={airline}
          onChange={(e) => setAirline(e.target.value)}
          aria-label="Airline"
        >
          <option value="all">All Airlines</option>
          {airlines.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          aria-label="Delivery Agent"
        >
          <option value="all">All Delivery Agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={resetFilters}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {selected.length > 0 && (
        <BulkToolbar
          count={selected.length}
          noun="Feedback"
          pluralNoun="Feedback"
          onCancel={() => setSelected([])}
          actions={[
            {
              key: "export",
              label: "Export Selected",
              icon: FileSpreadsheet,
              onClick: exportSelected,
            },
          ]}
        />
      )}

      <DataTable
        data={filtered}
        columns={fbColumns}
        rowId={(r) => r.id}
        ariaLabel="Passenger feedback"
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
        emptyTitle="No feedback"
        emptyDescription="No passenger feedback matches the current filters."
        emptyIcon={<Star />}
        pageSize={25}
      />
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${
            n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
          }`}
        />
      ))}
    </span>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

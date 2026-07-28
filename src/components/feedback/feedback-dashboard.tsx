import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkToolbar } from "@/components/bulk/bulk-toolbar";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import {
  exportFeedbackToXlsx,
  fmtDateTime,
  type FeedbackRow,
} from "@/lib/feedback/export-xlsx";
import { Star, FileSpreadsheet, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";


const DASH = "—";

export function FeedbackDashboard() {
  const feedback = useStore((s) => s.feedback);
  const cases = useStore((s) => s.cases);
  const deliveries = useStore((s) => s.deliveries);

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [airline, setAirline] = useState("all");
  const [agent, setAgent] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  // Feedback rows that only exist in the public passenger_feedback table
  // (submitted from the portal before app state was synced). Read-only.
  const { data: remote } = useQuery({
    queryKey: ["passenger-feedback-remote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("passenger_feedback")
        .select("id, delivery_id, rating, resolved, comments, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(1000);
      if (error) return [];
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const rows = useMemo<FeedbackRow[]>(() => {
    const caseByBag = new Map(cases.map((c) => [c.bagId, c]));
    const deliveryByBag = new Map(deliveries.map((d) => [d.bagId, d]));
    const deliveryById = new Map(deliveries.map((d) => [d.deliveryId, d]));

    const build = (
      base: Omit<FeedbackRow, "pirNumber" | "deliveryId" | "driver" | "airline" | "flightNumber" | "station">,
      bagId: string,
      deliveryId?: string,
    ): FeedbackRow => {
      const delivery = deliveryId ? deliveryById.get(deliveryId) : deliveryByBag.get(bagId);
      const kase = caseByBag.get(bagId ?? delivery?.bagId ?? "") ??
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

    const local = feedback.map((f) =>
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
      ),
    );

    const knownDeliveryIds = new Set(local.map((r) => r.deliveryId).filter(Boolean));
    const extra = (remote ?? [])
      .filter((r) => r.delivery_id && !knownDeliveryIds.has(r.delivery_id))
      .map((r) =>
        build(
          {
            id: r.id,
            passengerName: "",
            bagId: deliveryById.get(r.delivery_id)?.bagId ?? "",
            rating: r.rating,
            resolved: r.resolved,
            comments: r.comments ?? "",
            at: r.submitted_at,
          },
          deliveryById.get(r.delivery_id)?.bagId ?? "",
          r.delivery_id,
        ),
      );

    return [...local, ...extra].sort((a, b) => b.at.localeCompare(a.at));
  }, [feedback, cases, deliveries, remote]);

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

  const allSelected = filtered.length > 0 && selected.length === filtered.length;

  function toggleAll() {
    setSelected(allSelected ? [] : filtered.map((r) => r.id));
  }
  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Customer Feedback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          &nbsp;
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Avg Rating" value={`${avg.toFixed(1)}/5`} tone="text-amber-600" />
        <Kpi label="Total Responses" value={total} tone="text-primary" />
        <Kpi label="Issue Resolved" value={`${resolvedPct}%`} tone="text-emerald-600" />
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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Passenger</th>
                  <th className="text-left px-4 py-3 font-medium">PIR</th>
                  <th className="text-left px-4 py-3 font-medium">Delivery ID</th>
                  <th className="text-left px-4 py-3 font-medium">Delivery Agent</th>
                  <th className="text-left px-4 py-3 font-medium">Airline</th>
                  <th className="text-left px-4 py-3 font-medium">Flight</th>
                  <th className="text-left px-4 py-3 font-medium">Rating</th>
                  <th className="text-left px-4 py-3 font-medium">Resolved</th>
                  <th className="text-left px-4 py-3 font-medium">Comment</th>
                  <th className="text-left px-4 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                      No passenger feedback matches the current filters.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={selected.includes(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                        aria-label={`Select ${r.id}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{r.passengerName || DASH}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.pirNumber || DASH}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.deliveryId || DASH}</td>
                    <td className="px-4 py-3">{r.driver || DASH}</td>
                    <td className="px-4 py-3">{r.airline || DASH}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.flightNumber || DASH}</td>
                    <td className="px-4 py-3">
                      <Stars value={r.rating} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.resolved
                            ? "text-emerald-600 font-medium"
                            : "text-rose-600 font-medium"
                        }
                      >
                        {r.resolved ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[320px]">
                      <span className="line-clamp-2">{r.comments || DASH}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDateTime(r.at) || DASH}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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

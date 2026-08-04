import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { resolveTracking, type TrackingResult } from "@/lib/tracking/resolve";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  STAGE_STYLES,
  stageFromLegacy,
  type DeliveryStage,
} from "@/lib/delivery/stages";
import { WORKFLOW_LABELS } from "@/lib/workflow/statuses";
import { Search, AlertCircle, ExternalLink, ShieldCheck } from "lucide-react";

// Shared Track Baggage surface. Single implementation consumed by every
// module (Baggage Operations + Contact Center Operations). Read-only: it
// resolves live ecosystem data and never owns or writes state.

// Stages shown in the passenger-facing progress stepper. Failure /
// return stages are surfaced through the status badge instead.
const PROGRESS_STAGES: DeliveryStage[] = [
  "Ready for Delivery",
  "Scheduled",
  "Assigned",
  "Driver Accepted",
  "Collected Bag",
  "Out for Delivery",
  "Delivered",
];

// OTP is only meaningful once the agent is en route.
const OTP_VISIBLE_STAGES = new Set<DeliveryStage>(["Out for Delivery", "Delivered"]);

export function TrackBaggage({ showHeading = true }: { showHeading?: boolean }) {
  const cases = useStore((s) => s.cases);
  const deliveries = useStore((s) => s.deliveries);
  const workflow = useStore((s) => s.workflow);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  // Resolve on every render from live store data so the panel always
  // reflects the current state of the ecosystem.
  const result: TrackingResult | null = submitted
    ? resolveTracking(submitted, { cases, deliveries, workflow })
    : null;

  function search(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {showHeading && (
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Track Baggage</h1>
          <p className="text-sm text-muted-foreground">
            Locate any baggage case using its operational reference.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <form onSubmit={search} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by PIR, PNR, Bag Tag, Bag ID or Delivery ID"
                className="pl-9 h-11"
                aria-label="Search by PIR, PNR, Bag Tag, Bag ID or Delivery ID"
              />
            </div>
            <Button type="submit" className="h-11 sm:px-8">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {submitted && !result && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">No record found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check the reference and try again, or contact the baggage desk.
            </p>
          </CardContent>
        </Card>
      )}

      {result && <TrackingResultPanel result={result} />}
    </div>
  );
}

function TrackingResultPanel({ result }: { result: TrackingResult }) {
  const { kase, delivery, workflow, matchedBy } = result;
  const stage: DeliveryStage | undefined = delivery
    ? (delivery.stage ?? stageFromLegacy(delivery))
    : undefined;
  const stageIndex = stage ? PROGRESS_STAGES.indexOf(stage) : -1;
  const agentAssigned = !!delivery?.driver && delivery.driver !== "—";
  const otpEligible = !!stage && OTP_VISIBLE_STAGES.has(stage);
  const tags =
    kase?.baggage?.bagTags && kase.baggage.bagTags.length > 0
      ? kase.baggage.bagTags
      : kase?.bagTagNumber
        ? [kase.bagTagNumber]
        : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Bag ID · matched by {matchedBy}
              </p>
              <p className="text-xl font-bold font-mono text-primary">
                {kase?.bagId || delivery?.bagId || "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Passenger:{" "}
                <span className="text-foreground font-medium">
                  {kase?.passengerName || delivery?.passengerName || "—"}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {stage ? (
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STAGE_STYLES[stage]}`}
                >
                  {STAGE_LABELS[stage]}
                </span>
              ) : (
                kase && <StatusBadge status={kase.status} />
              )}
            </div>
          </div>

          {workflow && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Latest Workflow Status
              </p>
              <p className="text-sm font-medium mt-1">
                {WORKFLOW_LABELS[workflow.status]?.en ?? workflow.status}
              </p>
            </div>
          )}

          {workflow?.token && (
            <Button asChild variant="outline" className="h-10">
              <a href={`/passenger/${workflow.token}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                View Passenger Portal
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      <Section title="Passenger Information">
        <InfoTile label="Full Name" value={kase?.passengerName || delivery?.passengerName} />
        <InfoTile label="Mobile" value={kase?.contact || delivery?.mobile} />
        <InfoTile label="Email" value={kase?.email} />
        <InfoTile label="PIR Number" value={kase?.pirNumber || delivery?.pirNumber} />
        <InfoTile label="PNR" value={kase?.passenger?.pnr} />
        <InfoTile label="Priority" value={kase?.priority ?? delivery?.priority} />
      </Section>

      <Section title="Flight Information">
        <InfoTile label="Airline" value={kase?.flight?.airline} />
        <InfoTile label="Flight Number" value={kase?.flightNumber} />
        <InfoTile label="Arrival Date" value={kase?.arrivalDate} />
      </Section>

      <Section title="Baggage Information">
        <InfoTile label="Bag ID" value={kase?.bagId || delivery?.bagId} />
        <InfoTile label="Bag Tag(s)" value={tags.join(", ")} />
        <InfoTile label="Number of Bags" value={kase?.baggage?.numberOfBags} />
        <InfoTile label="Description" value={kase?.description} />
        <InfoTile
          label="Storage Location"
          value={
            kase?.storage
              ? `Zone ${kase.storage.zone} · Shelf ${kase.storage.shelf} · Pos ${kase.storage.position}`
              : undefined
          }
        />
      </Section>

      <Section title="Delivery Information">
        {delivery ? (
          <>
            <InfoTile label="Delivery ID" value={delivery.deliveryId} />
            <InfoTile label="Method" value={delivery.deliveryType ?? "Home Delivery"} />
            <InfoTile label="Stage" value={stage ? STAGE_LABELS[stage] : undefined} />
            <InfoTile label="Address" value={delivery.address} className="sm:col-span-3" />
          </>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-3">
            Not yet scheduled for delivery.
          </p>
        )}
      </Section>

      {agentAssigned && (
        <Section title="Delivery Agent Information">
          <InfoTile label="Delivery Agent" value={delivery?.driver} />
          <InfoTile
            label="Accepted At"
            value={delivery?.acceptedAt ? formatAt(delivery.acceptedAt) : undefined}
          />
          <InfoTile
            label="Collected At"
            value={delivery?.collectedAt ? formatAt(delivery.collectedAt) : undefined}
          />
        </Section>
      )}

      {delivery && (
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
              Delivery Progress
            </p>
            <ol className="space-y-3">
              {PROGRESS_STAGES.map((s, i) => {
                const reached = stageIndex >= 0 && i <= stageIndex;
                const current = i === stageIndex;
                return (
                  <li key={s} className="flex items-start gap-3">
                    <div
                      className={`h-7 w-7 rounded-full grid place-items-center shrink-0 text-[11px] font-semibold ${
                        reached
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      } ${current ? "ring-4 ring-primary/20" : ""}`}
                    >
                      {i + 1}
                    </div>
                    <p
                      className={`text-sm pt-1 ${reached ? "font-medium" : "text-muted-foreground"}`}
                    >
                      {STAGE_LABELS[s]}
                    </p>
                  </li>
                );
              })}
            </ol>
            {stage && STAGE_ORDER[stage] > STAGE_ORDER["Delivered"] && (
              <p className="text-sm text-muted-foreground mt-4">
                Current stage: {STAGE_LABELS[stage]}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {delivery && (
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              OTP Verification
            </p>
            {otpEligible ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="font-mono text-xl tracking-[0.3em]">
                    {delivery.otpCode || "——————"}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">Status: {delivery.otpStatus}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                OTP becomes available once the baggage is out for delivery. Current status:{" "}
                {delivery.otpStatus}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
            Live Timeline
          </p>
          {workflow && workflow.history.length > 0 ? (
            <ol className="space-y-3">
              {[...workflow.history]
                .slice()
                .reverse()
                .map((h, i) => (
                  <li key={`${h.status}-${h.at}-${i}`} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        {WORKFLOW_LABELS[h.status]?.en ?? h.status}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatAt(h.at)} · {h.actor}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          ) : kase?.lfHistory && kase.lfHistory.length > 0 ? (
            <ol className="space-y-3">
              {[...kase.lfHistory].reverse().map((h, i) => (
                <li key={`${h.status}-${h.at}-${i}`} className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{h.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatAt(h.at)} · {h.actor}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No timeline events yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{title}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function formatAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoTile({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: string | number | null;
  className?: string;
}) {
  const text = value === undefined || value === null || value === "" ? "—" : String(value);
  return (
    <div className={`rounded-lg border border-border bg-muted/40 p-3 ${className}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-1 break-words">{text}</p>
    </div>
  );
}

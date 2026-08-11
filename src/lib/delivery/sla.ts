// Presentation helpers for the delivery SLA. The values themselves are
// computed in PostgreSQL (region SLA hours + delivery creation time) and
// projected onto every Delivery, so Dispatch, Delivery Details and the
// Driver Portal all read one authoritative number.
import type { Delivery } from "@/lib/store";

export type SlaState = "none" | "met" | "on-track" | "due-soon" | "breached";

export interface SlaView {
  state: SlaState;
  regionName: string;
  hours?: number;
  dueAt?: string;
  /** Human label, e.g. "3h 20m left" / "2h 05m overdue". */
  remainingLabel: string;
}

function fmtGap(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function slaView(d: Delivery, now: number = Date.now()): SlaView {
  const regionName = d.regionName ?? (d.deliveryType === "Airport Pickup" ? "Airport Pickup" : "—");
  if (!d.slaDueAt || !d.slaHours) {
    return { state: "none", regionName, remainingLabel: "—" };
  }
  const due = new Date(d.slaDueAt).getTime();
  const base = { regionName, hours: d.slaHours, dueAt: d.slaDueAt };

  if (d.deliveredAt) {
    const delivered = new Date(d.deliveredAt).getTime();
    return {
      ...base,
      state: delivered <= due ? "met" : "breached",
      remainingLabel:
        delivered <= due ? `Met (${fmtGap(due - delivered)} early)` : `Breached (${fmtGap(delivered - due)} late)`,
    };
  }
  const left = due - now;
  if (left < 0) return { ...base, state: "breached", remainingLabel: `${fmtGap(left)} overdue` };
  if (left <= 60 * 60 * 1000) return { ...base, state: "due-soon", remainingLabel: `${fmtGap(left)} left` };
  return { ...base, state: "on-track", remainingLabel: `${fmtGap(left)} left` };
}

export const SLA_BADGE_CLASS: Record<SlaState, string> = {
  none: "bg-muted text-muted-foreground",
  met: "bg-emerald-100 text-emerald-800",
  "on-track": "bg-sky-100 text-sky-800",
  "due-soon": "bg-amber-100 text-amber-900",
  breached: "bg-destructive/15 text-destructive",
};

export const SLA_STATE_LABEL: Record<SlaState, string> = {
  none: "No SLA",
  met: "Met",
  "on-track": "On track",
  "due-soon": "Due soon",
  breached: "Breached",
};
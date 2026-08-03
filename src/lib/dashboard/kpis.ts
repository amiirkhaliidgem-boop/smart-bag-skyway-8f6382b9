import {
  Luggage,
  AlertCircle,
  MapPin,
  PackageCheck,
  CheckCircle2,
  Clock,
  Star,
  ShieldAlert,
  Plane,
  FileCheck2,
  Truck,
  RotateCcw,
  Handshake,
  Activity,
} from "lucide-react";

/**
 * Architecture-driven dashboard KPI registry.
 *
 * The Executive Dashboard renders this list instead of hand-written cards.
 * Adding a KPI to the backend payload (`dashboard_executive()`) only requires
 * a descriptor here — and any KPI key the backend returns without a descriptor
 * still renders with a humanised label, so expanding the Workflow Engine never
 * breaks or hides dashboard data.
 */
export type KpiFormat = "number" | "percent" | "hours" | "rating";

export interface DashboardKpiDescriptor {
  /** Key in the backend `kpis` object. */
  key: string;
  label: string;
  icon: typeof Luggage;
  tone: string;
  format?: KpiFormat;
}

export const DASHBOARD_KPIS: DashboardKpiDescriptor[] = [
  { key: "totalCases", label: "Total Bags", icon: Luggage, tone: "text-primary" },
  { key: "openCases", label: "Open Cases", icon: AlertCircle, tone: "text-[var(--warning)]" },
  { key: "locatedBags", label: "Located Bags", icon: MapPin, tone: "text-[var(--info)]" },
  { key: "arrivedAtAirport", label: "Arrived at Airport", icon: Plane, tone: "text-[var(--info)]" },
  {
    key: "waitingCustoms",
    label: "Waiting Customs Clearance",
    icon: FileCheck2,
    tone: "text-primary",
  },
  {
    key: "readyForDelivery",
    label: "Ready for Delivery",
    icon: PackageCheck,
    tone: "text-primary",
  },
  { key: "outForDelivery", label: "Out for Delivery", icon: Truck, tone: "text-[var(--info)]" },
  {
    key: "returnedToAirport",
    label: "Returned to Airport",
    icon: RotateCcw,
    tone: "text-destructive",
  },
  {
    key: "readyForPickup",
    label: "Ready for Airport Pickup",
    icon: Handshake,
    tone: "text-[var(--success)]",
  },
  {
    key: "passengerPickedUp",
    label: "Passenger Picked Up",
    icon: CheckCircle2,
    tone: "text-[var(--success)]",
  },
  {
    key: "deliveredBags",
    label: "Delivered",
    icon: CheckCircle2,
    tone: "text-[var(--success)]",
  },
  {
    key: "deliverySuccess",
    label: "Delivery Success",
    icon: PackageCheck,
    tone: "text-[var(--success)]",
    format: "percent",
  },
  {
    key: "pickupSuccess",
    label: "Airport Pickup Success",
    icon: Handshake,
    tone: "text-[var(--success)]",
    format: "percent",
  },
  { key: "openIncidents", label: "Open Incidents", icon: ShieldAlert, tone: "text-destructive" },
  {
    key: "avgResolution",
    label: "Avg. Resolution",
    icon: Clock,
    tone: "text-primary",
    format: "hours",
  },
  { key: "csat", label: "CSAT", icon: Star, tone: "text-[var(--warning)]", format: "rating" },
];

const DESCRIBED = new Set(DASHBOARD_KPIS.map((d) => d.key));

/** Humanise an unknown backend KPI key (e.g. `slaBreaches` -> "Sla Breaches"). */
export function humaniseKpiKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Merge the descriptor list with whatever the backend actually returned so a
 * newly added KPI surfaces automatically.
 */
export function resolveDashboardKpis(
  payload: Record<string, unknown> | undefined | null,
): DashboardKpiDescriptor[] {
  if (!payload) return DASHBOARD_KPIS;
  const known = DASHBOARD_KPIS.filter((d) => d.key in payload);
  const extra = Object.keys(payload)
    .filter((k) => !DESCRIBED.has(k))
    .map<DashboardKpiDescriptor>((k) => ({
      key: k,
      label: humaniseKpiKey(k),
      icon: Activity,
      tone: "text-muted-foreground",
    }));
  return [...known, ...extra];
}

export function formatKpiValue(value: number, format?: KpiFormat): string {
  switch (format) {
    case "percent":
      return `${value}%`;
    case "hours":
      return `${value.toFixed(1)}h`;
    case "rating":
      return `${value.toFixed(1)}/5`;
    default:
      return new Intl.NumberFormat("en-US").format(value);
  }
}
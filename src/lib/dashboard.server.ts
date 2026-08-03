import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Executive Dashboard read layer.
 *
 * Every figure is computed by `public.dashboard_executive()` in PostgreSQL,
 * directly over the Workflow Engine tables. Nothing is recomputed in the
 * browser and no module keeps its own statistics.
 */

export interface KpiValue {
  value: number;
  delta: number | null;
}

export interface ExecutiveDashboard {
  range: { from: string; to: string; grain: string; span_days: number };
  kpis: {
    totalCases: KpiValue;
    openCases: KpiValue;
    locatedBags: KpiValue;
    arrivedAtAirport: KpiValue;
    waitingCustoms: KpiValue;
    readyForDelivery: KpiValue;
    outForDelivery: KpiValue;
    returnedToAirport: KpiValue;
    readyForPickup: KpiValue;
    passengerPickedUp: KpiValue;
    deliveredBags: KpiValue;
    avgResolution: KpiValue;
    csat: KpiValue;
    deliverySuccess: KpiValue;
    pickupSuccess: KpiValue;
    openIncidents: KpiValue;
  };
  byStatus: { status: string; count: number }[];
  byCarrier: { airline: string; count: number }[];
  funnel: { status: string; count: number }[];
  trends: {
    bucket: string;
    opened: number;
    resolved: number;
    delivered: number;
    pickedUp: number;
    completed: number;
    incidents: number;
    csat: number;
    successPct: number;
  }[];
}

export async function fetchExecutiveDashboard(
  supabase: SupabaseClient<any>,
  from: string,
  to: string,
  grain: "day" | "week" | "month",
): Promise<ExecutiveDashboard> {
  const { data, error } = await supabase.rpc("dashboard_executive", {
    p_from: from,
    p_to: to,
    p_grain: grain,
  });
  if (error) throw new Error(error.message);
  return data as unknown as ExecutiveDashboard;
}

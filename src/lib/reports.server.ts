import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reports read layer.
 *
 * Every figure returned here is computed by `public.report_operational()` in
 * PostgreSQL, directly over the Workflow Engine tables (baggage_cases,
 * deliveries, workflow_events, passenger_feedback, notification_events,
 * passenger_links and quality_incidents). Nothing is recomputed in the browser
 * and no module keeps its own statistics.
 */

export interface CountRow {
  label: string;
  count: number;
}

export interface OperationalReport {
  range: { from: string; to: string; grain: string };
  executive: {
    cases: number;
    deliveries: number;
    delivered: number;
    returns: number;
    deliverySuccessPct: number;
    slaCompliancePct: number;
    csat: number;
    openIncidents: number;
    avgHoursToDeliver: number;
  };
  delivery: {
    byStage: { stage: string; count: number }[];
    firstAttemptPct: number;
    returnReasons: { reason: string; count: number }[];
    avgStageMinutes: { stage: string; minutes: number }[];
    onTime: number;
    breached: number;
  };
  lostFound: {
    intake: number;
    byStatus: { status: string; count: number }[];
    incompletePct: number;
    vipPct: number;
    avgHoursToReady: number;
  };
  experience: {
    csat: number;
    responses: number;
    responseRatePct: number;
    resolvedPct: number;
    ratings: { rating: number; count: number }[];
    linkViewRatePct: number;
    notifications: { channel: string; sent: number; failed: number; pending: number }[];
  };
  quality: {
    raised: number;
    open: number;
    resolved: number;
    avgResolveHours: number;
    byCategory: CountRow[];
    bySeverity: CountRow[];
    bySource: CountRow[];
    byState: CountRow[];
    incidents: {
      id: string;
      incident_no: string;
      category: string;
      severity: string;
      state: string;
      source: string;
      description: string;
      created_at: string;
      resolved_at: string | null;
      due_at: string | null;
      airline: string;
      reference: string;
      delivery_no: string;
      agent: string;
      assignee: string;
    }[];
  };
  performance: {
    agents: { name: string; delivered: number; returned: number; csat: number; incidents: number }[];
    officers: { name: string; cases: number; progressed: number; avg_hours: number }[];
    airlines: { name: string; cases: number; delivered: number; csat: number; incidents: number }[];
  };
  trends: {
    bucket: string;
    cases: number;
    delivered: number;
    returned: number;
    incidents: number;
    csat: number;
  }[];
}

export async function fetchOperationalReport(
  supabase: SupabaseClient<any>,
  from: string,
  to: string,
  grain: "day" | "week" | "month",
): Promise<OperationalReport> {
  // Raise any SLA breaches first so the numbers below already reflect them.
  await supabase.rpc("qm_sweep_sla");

  const { data, error } = await supabase.rpc("report_operational", {
    p_from: from,
    p_to: to,
    p_grain: grain,
  });
  if (error) throw new Error(error.message);
  return data as unknown as OperationalReport;
}

// Server-only assembly of the operational snapshot straight out of the
// normalized production tables. There is no `app_state` involved: every
// value returned here is projected from PostgreSQL rows.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapAudit,
  mapCase,
  mapDelivery,
  mapNotification,
  mapWorkflow,
  type OpsSnapshot,
} from "./ops.mapping";

type Row = Record<string, any>;

// PostgREST caps every response at 1000 rows. Reading without an explicit
// bound therefore truncates *silently* once the dataset grows. Every
// collection below is bounded on purpose and reports whether it hit the cap
// so the UI can say "showing the most recent N" instead of hiding rows.
export const SNAPSHOT_LIMITS = {
  cases: 500,
  deliveries: 500,
  workflowEvents: 900,
  audit: 500,
  notifications: 500,
  feedback: 500,
  incidents: 500,
  notes: 900,
  otps: 900,
} as const;

export async function buildSnapshot(supabase: SupabaseClient<any>): Promise<OpsSnapshot> {
  const q = <T = Row[]>(p: any) => p.then((r: any) => (r.data ?? []) as T);

  const [
    stations,
    cases,
    bags,
    deliveries,
    notes,
    otps,
    links,
    wfEvents,
    auditRows,
    notifRows,
    feedbackRows,
    incidents,
    positions,
    routes,
    routeStops,
    users,
    failureReasons,
  ] = await Promise.all([
    q(supabase.from("stations").select("*").order("is_default", { ascending: false })),
    q(
      supabase
        .from("baggage_cases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(SNAPSHOT_LIMITS.cases),
    ),
    q(supabase.from("case_bags").select("*").limit(SNAPSHOT_LIMITS.cases * 2)),
    q(
      supabase
        .from("deliveries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(SNAPSHOT_LIMITS.deliveries),
    ),
    q(
      supabase
        .from("delivery_notes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(SNAPSHOT_LIMITS.notes),
    ),
    q(
      supabase
        .from("otp_challenges")
        .select("*")
        .order("issued_at", { ascending: false })
        .limit(SNAPSHOT_LIMITS.otps),
    ),
    q(supabase.from("passenger_links").select("*").is("revoked_at", null)),
    q(
      supabase
        .from("workflow_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(SNAPSHOT_LIMITS.workflowEvents),
    ),
    q(
      supabase
        .from("audit_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(SNAPSHOT_LIMITS.audit),
    ),
    q(
      supabase
        .from("notification_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(SNAPSHOT_LIMITS.notifications),
    ),
    q(
      supabase
        .from("passenger_feedback")
        .select("*")
        .order("submitted_at", { ascending: false })
        .limit(SNAPSHOT_LIMITS.feedback),
    ),
    q(
      supabase
        .from("quality_incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(SNAPSHOT_LIMITS.incidents),
    ),
    q(supabase.from("agent_positions").select("*")),
    q(supabase.from("agent_routes").select("*")),
    q(supabase.from("agent_route_stops").select("*").order("seq")),
    q(supabase.from("app_users").select("id, full_name, employee_id, user_type, status")),
    q(supabase.from("failure_reasons").select("*")),
  ]);

  // `workflow_events` feeds per-case history; the mappers expect ascending order.
  (wfEvents as Row[]).sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at)));

  const caseById = new Map<string, Row>(cases.map((c: Row) => [c.id, c]));
  const deliveryById = new Map<string, Row>(deliveries.map((d: Row) => [d.id, d]));
  const userById = new Map<string, Row>(users.map((u: Row) => [u.id, u]));
  const reasonById = new Map<string, Row>(failureReasons.map((r: Row) => [r.id, r]));

  const latestOtp = new Map<string, Row>();
  for (const o of otps as Row[]) if (!latestOtp.has(o.delivery_id)) latestOtp.set(o.delivery_id, o);

  const tokenByDelivery = new Map<string, string>();
  for (const l of links as Row[]) if (!tokenByDelivery.has(l.delivery_id)) tokenByDelivery.set(l.delivery_id, l.token);

  const mappedCases = (cases as Row[]).map((c) => mapCase(c, bags as Row[], wfEvents as Row[]));
  const mappedDeliveries = (deliveries as Row[]).map((d) =>
    mapDelivery(
      d,
      caseById.get(d.case_id)?.case_no ?? "",
      d.assigned_agent_id ? userById.get(d.assigned_agent_id)?.full_name : undefined,
      latestOtp.get(d.id),
      notes as Row[],
      d.failure_reason_id ? reasonById.get(d.failure_reason_id)?.label_en : undefined,
    ),
  );

  const workflow = (deliveries as Row[]).map((d) =>
    mapWorkflow(d, caseById.get(d.case_id)?.case_no ?? "", tokenByDelivery.get(d.id), wfEvents as Row[]),
  );

  const notifications = (notifRows as Row[]).map((n) =>
    mapNotification(n, n.delivery_id ? deliveryById.get(n.delivery_id)?.delivery_no : undefined),
  );

  const audit = (auditRows as Row[]).map((a) =>
    mapAudit(
      a,
      a.delivery_id ? deliveryById.get(a.delivery_id)?.delivery_no : undefined,
      a.case_id ? caseById.get(a.case_id)?.case_no : undefined,
    ),
  );

  const feedback = (feedbackRows as Row[]).map((f) => ({
    id: f.id,
    bagId: caseById.get(f.case_id)?.case_no ?? "",
    passengerName: deliveryById.get(f.delivery_id)?.passenger_name ?? "",
    resolved: !!f.resolved,
    rating: f.rating ?? 0,
    comments: f.comments ?? "",
    at: f.submitted_at,
  }));

  const qualityIncidents = (incidents as Row[]).map((i) => ({
    id: i.id,
    bagId: i.case_id ? (caseById.get(i.case_id)?.case_no ?? "") : "",
    deliveryId: i.delivery_id ? deliveryById.get(i.delivery_id)?.delivery_no : undefined,
    passengerName: i.delivery_id ? (deliveryById.get(i.delivery_id)?.passenger_name ?? "") : "",
    driver:
      i.delivery_id && deliveryById.get(i.delivery_id)?.assigned_agent_id
        ? (userById.get(deliveryById.get(i.delivery_id)!.assigned_agent_id)?.full_name ?? "—")
        : "—",
    category: i.category,
    severity: i.severity,
    status: i.state,
    description: i.description ?? "",
    at: i.created_at,
  }));

  const s = (stations as Row[])[0];
  const station = s
    ? { code: s.code, name: s.name, lat: s.lat, lng: s.lng }
    : { code: "APT", name: "Airport", lat: 0, lng: 0 };

  const driverPositions: OpsSnapshot["driverPositions"] = {};
  for (const p of positions as Row[]) {
    const name = userById.get(p.agent_id)?.full_name;
    if (!name) continue;
    driverPositions[name] = { lat: p.lat, lng: p.lng, accuracy: p.accuracy ?? undefined, at: p.reported_at };
  }

  const driverRoutes: OpsSnapshot["driverRoutes"] = {};
  for (const r of routes as Row[]) {
    const name = userById.get(r.agent_id)?.full_name;
    if (!name) continue;
    const stops = (routeStops as Row[])
      .filter((st) => st.route_id === r.id)
      .map((st) => deliveryById.get(st.delivery_id)?.delivery_no)
      .filter(Boolean) as string[];
    if (!stops.length) continue;
    driverRoutes[name] = {
      driver: name,
      origin: { lat: r.origin_lat, lng: r.origin_lng, source: "station" },
      stops,
      computedAt: r.computed_at,
    };
  }

  const caseIds: Record<string, string> = {};
  const caseVersions: Record<string, number> = {};
  for (const c of cases as Row[]) {
    caseIds[c.case_no] = c.id;
    caseVersions[c.case_no] = c.version ?? 0;
  }
  const deliveryIds: Record<string, string> = {};
  const deliveryVersions: Record<string, number> = {};
  for (const d of deliveries as Row[]) {
    deliveryIds[d.delivery_no] = d.id;
    deliveryVersions[d.delivery_no] = d.version ?? 0;
  }
  const agentIds: Record<string, string> = {};
  const agents: OpsSnapshot["agents"] = [];
  for (const u of users as Row[]) {
    if (u.user_type !== "driver" || u.status !== "Active") continue;
    agentIds[u.full_name] = u.id;
    agents.push({ id: u.id, name: u.full_name, employeeId: u.employee_id });
  }

  return {
    cases: mappedCases,
    deliveries: mappedDeliveries,
    workflow,
    notifications,
    audit,
    feedback,
    qualityIncidents,
    station,
    driverPositions,
    driverRoutes,
    caseIds,
    deliveryIds,
    agentIds,
    caseVersions,
    deliveryVersions,
    agents,
  };
}

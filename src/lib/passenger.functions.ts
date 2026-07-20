import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  BaggageCase,
  Delivery,
  Feedback,
  WorkflowRecord,
} from "./store";

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [k: string]: JSONValue };

export interface PassengerView {
  found: boolean;
  workflow: WorkflowRecord | null;
  delivery: Delivery | null;
  case: BaggageCase | null;
  feedback: Feedback[];
}

// Public, token-scoped view for /passenger/$token. Reads the app_state
// snapshot server-side (service role bypasses RLS) and returns ONLY the
// delivery + case matching the token — no other passengers' data leaks.
export const getPassengerViewByToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(4) }).parse(input))
  .handler(async ({ data }): Promise<PassengerView> => {
    const empty: PassengerView = {
      found: false,
      workflow: null,
      delivery: null,
      case: null,
      feedback: [],
    };
    let row: { payload?: unknown } | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const res = await supabaseAdmin
        .from("app_state")
        .select("payload")
        .eq("id", "global")
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      row = res.data;
    } catch (err) {
      // Missing service role key or transient RLS/network failure: return an
      // empty view so the loader resolves cleanly. The route falls back to a
      // client-side store lookup for authenticated staff previews.
      console.warn("[passenger] server view unavailable:", err);
      return empty;
    }

    const payload = (row?.payload ?? {}) as {
      workflow?: Array<Record<string, unknown> & { deliveryId: string; token: string }>;
      deliveries?: Array<Record<string, unknown>>;
      cases?: Array<Record<string, unknown>>;
      feedback?: Array<Record<string, unknown>>;
    };
    const wf = (payload.workflow ?? []).find((w) => w.token === data.token);
    if (!wf) {
      return { found: false, workflow: null, delivery: null, case: null, feedback: [] };
    }

    const delivery = (payload.deliveries ?? []).find(
      (d) => (d as { deliveryId?: string }).deliveryId === wf.deliveryId,
    );
    const kase = delivery
      ? (payload.cases ?? []).find(
          (c) => (c as { bagId?: string }).bagId === (delivery as { bagId?: string }).bagId,
        )
      : undefined;

    const feedback = kase
      ? (payload.feedback ?? []).filter(
          (f) => (f as { bagId?: string }).bagId === (kase as { bagId?: string }).bagId,
        )
      : [];

    return JSON.parse(
      JSON.stringify({
        found: Boolean(delivery && kase),
        workflow: wf,
        delivery: delivery ?? null,
        case: kase ?? null,
        feedback,
      }),
    ) as PassengerView;
  });

const passengerActionSchema = z.discriminatedUnion("action", [
  z.object({
    token: z.string().min(4),
    action: z.literal("confirm-delivery"),
  }),
  z.object({
    token: z.string().min(4),
    action: z.literal("report-misconduct"),
  }),
  z.object({
    token: z.string().min(4),
    action: z.literal("submit-feedback"),
    rating: z.number().int().min(1).max(5),
    resolved: z.boolean(),
    comments: z.string().max(1000),
  }),
]);

// Passenger mutations are authorized by possession of the opaque token and
// resolve all entity IDs again on the server. The browser never supplies a
// bagId, deliveryId, passenger name, PIR, OTP, or workflow identity.
export const mutatePassengerView = createServerFn({ method: "POST" })
  .inputValidator((input) => passengerActionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("app_state")
      .select("payload, version")
      .eq("id", "global")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const payload = (row?.payload ?? {}) as Record<string, unknown> & {
      workflow?: WorkflowRecord[];
      deliveries?: Delivery[];
      cases?: BaggageCase[];
      feedback?: Feedback[];
      qualityIncidents?: Array<Record<string, unknown>>;
      callLogs?: Array<Record<string, unknown>>;
      audit?: Array<Record<string, unknown>>;
      notifications?: Array<Record<string, unknown>>;
    };
    const workflow = payload.workflow ?? [];
    const wfIndex = workflow.findIndex((w) => w.token === data.token);
    if (wfIndex < 0) throw new Error("Tracking link not found");
    const wf = workflow[wfIndex];
    const deliveries = payload.deliveries ?? [];
    const deliveryIndex = deliveries.findIndex((d) => d.deliveryId === wf.deliveryId);
    if (deliveryIndex < 0) throw new Error("Delivery not found");
    const delivery = deliveries[deliveryIndex];
    const cases = payload.cases ?? [];
    const caseIndex = cases.findIndex((c) => c.bagId === delivery.bagId);
    if (caseIndex < 0) throw new Error("Case not found");
    const kase = cases[caseIndex];
    const now = new Date().toISOString();
    const audit = [...(payload.audit ?? [])];
    const auditEntry = (action: string, note: string) => ({
      id: `AUD-${crypto.randomUUID()}`,
      action,
      actor: "Passenger Portal",
      entityType: "delivery",
      entityId: delivery.deliveryId,
      note: `${note} · Case ${kase.bagId}`,
      at: now,
    });

    if (data.action === "confirm-delivery") {
      deliveries[deliveryIndex] = {
        ...delivery,
        status: "Delivered",
        stage: "Delivered",
        otpStatus: "Verified",
        deliveredAt: now,
        lastUpdatedAt: now,
      };
      cases[caseIndex] = {
        ...kase,
        status: "Delivered",
        lfStatus: "Delivered",
        resolvedAt: kase.resolvedAt ?? now,
        updatedAt: now,
      };
      workflow[wfIndex] = {
        ...wf,
        status: "DELIVERED",
        history: [
          ...wf.history,
          { status: "OTP_VERIFIED", at: now, actor: "Passenger Portal" },
          { status: "DELIVERED", at: now, actor: "Passenger Portal" },
        ],
      };
      audit.unshift(auditEntry("workflow.transition", "OTP verified; baggage delivered"));
    } else if (data.action === "report-misconduct") {
      payload.qualityIncidents = [
        {
          id: `INC-${crypto.randomUUID()}`,
          bagId: kase.bagId,
          deliveryId: delivery.deliveryId,
          passengerName: kase.passengerName,
          driver: delivery.driver,
          category: "Possible Misconduct",
          severity: "High",
          status: "Open",
          description: "Passenger reported a request for money, tips, gifts or unofficial payment.",
          at: now,
        },
        ...(payload.qualityIncidents ?? []),
      ];
      payload.callLogs = [
        {
          id: `CALL-${crypto.randomUUID()}`,
          bagId: kase.bagId,
          pirNumber: kase.pirNumber,
          passengerName: kase.passengerName,
          phone: kase.contact,
          agent: "System Alert",
          direction: "Callback Required",
          durationSec: 0,
          notes: "HIGH PRIORITY — Possible misconduct reported via Passenger Portal.",
          at: now,
        },
        ...(payload.callLogs ?? []),
      ];
      audit.unshift(auditEntry("incident.create", "Possible misconduct reported"));
    } else {
      const entry: Feedback = {
        id: `FB-${crypto.randomUUID()}`,
        bagId: kase.bagId,
        passengerName: kase.passengerName,
        resolved: data.resolved,
        rating: data.rating,
        comments: data.comments,
        at: now,
      };
      payload.feedback = [entry, ...(payload.feedback ?? [])];
      workflow[wfIndex] = {
        ...wf,
        status: "FEEDBACK_SUBMITTED",
        history: [
          ...wf.history,
          { status: "FEEDBACK_SUBMITTED", at: now, actor: "Passenger Portal" },
        ],
      };
      audit.unshift(auditEntry("workflow.transition", "Passenger feedback submitted"));
    }

    payload.workflow = workflow;
    payload.deliveries = deliveries;
    payload.cases = cases;
    payload.audit = audit;
    const currentVersion = Number(row?.version ?? 0);
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("app_state")
      .update({ payload: payload as never, version: currentVersion + 1 })
      .eq("id", "global")
      .eq("version", currentVersion)
      .select("version")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("Workflow changed; please try again");
    return { ok: true };
  });

void (null as JSONValue);
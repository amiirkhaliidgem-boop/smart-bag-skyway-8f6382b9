// Universal tracking resolver — read-only.
//
// Takes any operational reference the ecosystem already generates and
// resolves it to the same triple of live records. It never writes state,
// never creates records and owns no data of its own: the Workflow Engine
// remains the single source of truth.

import type { BaggageCase, Delivery, WorkflowRecord } from "../store";

export type TrackingMatchKind =
  | "Delivery ID"
  | "PIR Number"
  | "Bag ID"
  | "Bag Tag"
  | "PNR";

export interface TrackingResult {
  matchedBy: TrackingMatchKind;
  kase?: BaggageCase;
  delivery?: Delivery;
  workflow?: WorkflowRecord;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function resolveTracking(
  query: string,
  data: {
    cases: BaggageCase[];
    deliveries: Delivery[];
    workflow: WorkflowRecord[];
  },
): TrackingResult | null {
  const q = norm(query);
  if (!q) return null;

  const finish = (
    matchedBy: TrackingMatchKind,
    kase?: BaggageCase,
    delivery?: Delivery,
  ): TrackingResult => {
    const resolvedCase =
      kase ?? (delivery ? data.cases.find((c) => c.bagId === delivery.bagId) : undefined);
    const resolvedDelivery =
      delivery ??
      (resolvedCase
        ? data.deliveries.find((d) => d.bagId === resolvedCase.bagId)
        : undefined);
    const workflow = resolvedDelivery
      ? data.workflow.find((w) => w.deliveryId === resolvedDelivery.deliveryId)
      : undefined;
    return { matchedBy, kase: resolvedCase, delivery: resolvedDelivery, workflow };
  };

  // 1. Delivery ID
  const byDelivery = data.deliveries.find((d) => norm(d.deliveryId) === q);
  if (byDelivery) return finish("Delivery ID", undefined, byDelivery);

  // 2. PIR Number
  const byPir =
    data.cases.find((c) => norm(c.pirNumber) === q) ??
    (data.deliveries.find((d) => norm(d.pirNumber) === q)
      ? undefined
      : undefined);
  if (byPir) return finish("PIR Number", byPir);
  const delByPir = data.deliveries.find((d) => norm(d.pirNumber) === q);
  if (delByPir) return finish("PIR Number", undefined, delByPir);

  // 3. Bag ID
  const byBagId = data.cases.find((c) => norm(c.bagId) === q);
  if (byBagId) return finish("Bag ID", byBagId);

  // 4. Bag Tag (single tag or per-bag tag list)
  const byTag = data.cases.find(
    (c) =>
      norm(c.bagTagNumber) === q ||
      (c.baggage?.bagTags ?? []).some((t) => norm(t) === q),
  );
  if (byTag) return finish("Bag Tag", byTag);

  // 5. PNR
  const byPnr = data.cases.find((c) => norm(c.passenger?.pnr) === q);
  if (byPnr) return finish("PNR", byPnr);

  return null;
}
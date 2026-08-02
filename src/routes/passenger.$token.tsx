import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  passengerViewQuery,
  isTerminalPassengerStage,
  type PassengerView,
} from "@/lib/passenger.functions";
import type {
  BaggageCase,
  Delivery,
  DeliveryStatus,
} from "@/lib/store";
import type { DeliveryStage } from "@/lib/delivery/stages";
import type { LFStatus } from "@/lib/lost-found/statuses";
import { DELIVERY_STAGES, stageToLegacyStatus } from "@/lib/delivery/stages";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import { PassengerPortal } from "./passenger.index";

export const Route = createFileRoute("/passenger/$token")({
  head: () => ({
    meta: [
      { title: "Your Baggage Delivery — IAB" },
      {
        name: "description",
        content: "Secure passenger tracking link for your IAB home baggage delivery.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(passengerViewQuery(params.token)),
  component: TokenPortal,
  notFoundComponent: TokenNotFound,
});

function TokenPortal() {
  const { token } = Route.useParams();
  const { data: view } = useSuspenseQuery({
    ...passengerViewQuery(token),
    refetchInterval: (q) => {
      const v = q.state.data as PassengerView | undefined;
      if (!v || !v.found) return false;
      if (isTerminalPassengerStage(v.stage)) return false;
      return 5000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  if (!view.found) return <TokenNotFound />;

  const { delivery, kase } = synthesizeFromView(view);
  return (
    <PassengerPortal
      token={token}
      journey={view.journey}
      resolvedDelivery={delivery}
      resolvedCase={kase}
    />
  );
}

// Reshape the minimum passenger-facing fields returned by the RPC into the
// Delivery / BaggageCase shapes that PassengerPortal was originally written
// against. Fields that are not exposed publicly (deliveryId, mobile, driver,
// bagId) are intentionally left empty — the portal degrades gracefully.
function synthesizeFromView(view: PassengerView): {
  delivery: Delivery;
  kase: BaggageCase;
} {
  const stage = normaliseStage(view);
  const status = stageToLegacyStatus(stage);
  const pickup = view.journey === "pickup";
  const delivery: Delivery = {
    deliveryId: "",
    bagId: "",
    pirNumber: view.pirNumber ?? "",
    passengerName: view.passengerName,
    mobile: "",
    address: "",
    method: pickup ? "Airport Pickup" : "Home Delivery",
    driver: "—",
    priority: "Normal",
    stage,
    status,
    otpCode: pickup ? "" : (view.otpCode ?? ""),
    otpStatus: !pickup && view.otpCode ? "Sent" : "Pending",
  } as unknown as Delivery;
  const kase: BaggageCase = {
    bagId: "",
    pirNumber: view.pirNumber ?? "",
    passengerName: view.passengerName,
    email: "",
    contact: "",
    flightNumber: view.flightNo ?? "",
    arrivalDate: view.flightDate ?? "",
    description: "",
    priority: "Normal",
    status: statusToCaseStatus(stage),
    lfStatus: pickup ? pickupLfStatus(view.status) : undefined,
    bagTagNumber: view.bagTag ?? "",
    storage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flight: view.airline ? { airline: view.airline } : undefined,
    baggage: view.bagTag ? { bagTags: [view.bagTag] } : undefined,
  } as unknown as BaggageCase;
  return { delivery, kase };
}

// The RPC returns the canonical `delivery_stage` label in `stage` and the
// canonical `workflow_status` enum in `status`. Prefer the stage; fall back to
// the workflow enum so the portal can never silently regress to "Pending".
const WORKFLOW_TO_STAGE: Record<string, DeliveryStage> = {
  PIR_CREATED: "Ready for Delivery",
  HOME_DELIVERY_REQUESTED: "Ready for Delivery",
  DELIVERY_APPROVED: "Ready for Delivery",
  DRIVER_ASSIGNED: "Assigned",
  READY_FOR_COLLECTION: "Driver Accepted",
  CLAIMED_ON_HAND: "Collected Bag",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DRIVER_ARRIVED: "Out for Delivery",
  OTP_VERIFIED: "Delivered",
  DELIVERED: "Delivered",
  FEEDBACK_SUBMITTED: "Delivered",
  CLOSED: "Delivered",
};

// Airport Pickup links carry the L&F status in `stage`; map the workflow
// enum as a fallback so the pickup timeline never regresses.
function pickupLfStatus(status: string | undefined): LFStatus {
  const s = (status ?? "").trim();
  if (s === "PASSENGER_PICKED_UP") return "Passenger Picked Up";
  if (s === "READY_FOR_AIRPORT_PICKUP") return "Ready for Airport Pickup";
  if (s === "DELIVERY_APPROVED") return "Arrived at Airport";
  if (s === "HOME_DELIVERY_REQUESTED") return "Located";
  return "Open";
}

function normaliseStage(view: PassengerView): DeliveryStage {
  const stage = (view.stage ?? "").trim();
  if ((DELIVERY_STAGES as readonly string[]).includes(stage)) {
    return stage as DeliveryStage;
  }
  return WORKFLOW_TO_STAGE[(view.status ?? "").trim()] ?? "Ready for Delivery";
}

function statusToCaseStatus(stage: DeliveryStage): BaggageCase["status"] {
  const legacy: DeliveryStatus = stageToLegacyStatus(stage);
  if (legacy === "Delivered") return "Delivered";
  if (legacy === "Out For Delivery") return "Out For Delivery";
  return "Ready For Delivery";
}

function TokenLoading() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <img
          src={iabLogo.url}
          alt="IAB"
          className="h-12 w-auto opacity-90"
        />
        <div
          aria-hidden
          className="h-6 w-6 rounded-full border-2 border-neutral-200 border-t-neutral-900 animate-spin"
        />
        <p className="text-sm text-muted-foreground">Loading your delivery…</p>
      </div>
    </div>
  );
}

function TokenNotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Tracking link not found</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          This link is invalid or has expired. Please contact IAB Baggage
          Services or check your original SMS/WhatsApp message.
        </p>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import {
  getPassengerViewByToken,
  type PassengerView,
} from "@/lib/passenger.functions";
import type {
  BaggageCase,
  Delivery,
  DeliveryStatus,
} from "@/lib/store";
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
  loader: ({ params }) => getPassengerViewByToken({ data: { token: params.token } }),
  component: TokenPortal,
  notFoundComponent: TokenNotFound,
});

function TokenPortal() {
  const { token } = Route.useParams();
  const view = Route.useLoaderData();

  if (!view.found) return <TokenNotFound />;

  const { delivery, kase } = synthesizeFromView(view);
  return (
    <PassengerPortal
      token={token}
      resolvedDelivery={delivery}
      resolvedCase={kase}
    />
  );
}

// Reshape the minimum passenger-facing fields returned by the RPC into the
// Delivery / BaggageCase shapes that PassengerPortal was originally written
// against. Fields that are not exposed publicly (deliveryId, mobile, driver,
// PIR, bagId) are intentionally left empty — the portal degrades gracefully.
function synthesizeFromView(view: PassengerView): {
  delivery: Delivery;
  kase: BaggageCase;
} {
  const status = normaliseDeliveryStatus(view.status);
  const delivery: Delivery = {
    deliveryId: "",
    bagId: "",
    pirNumber: "",
    passengerName: view.passengerName,
    mobile: "",
    address: "",
    method: "Home Delivery",
    driver: "—",
    priority: "Normal",
    status,
    otpCode: view.otpCode ?? "",
    otpStatus: view.otpCode ? "Sent" : "Pending",
  } as unknown as Delivery;
  const kase: BaggageCase = {
    bagId: "",
    pirNumber: "",
    passengerName: view.passengerName,
    email: "",
    contact: "",
    flightNumber: view.flightNo ?? "",
    arrivalDate: view.flightDate ?? "",
    description: "",
    priority: "Normal",
    status: statusToCaseStatus(view.status),
    bagTagNumber: view.bagTag ?? "",
    storage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flight: view.airline ? { airline: view.airline } : undefined,
    baggage: view.bagTag ? { bagTags: [view.bagTag] } : undefined,
  } as unknown as BaggageCase;
  return { delivery, kase };
}

function normaliseDeliveryStatus(s: string): DeliveryStatus {
  switch (s) {
    case "Delivered":
      return "Delivered";
    case "Out For Delivery":
    case "Out for Delivery":
      return "Out For Delivery";
    case "Picked Up":
      return "Picked Up";
    case "Assigned":
      return "Assigned";
    default:
      return "Pending";
  }
}

function statusToCaseStatus(s: string): BaggageCase["status"] {
  switch (s) {
    case "Delivered":
      return "Delivered";
    case "Out For Delivery":
    case "Out for Delivery":
      return "Out For Delivery";
    default:
      return "Ready For Delivery";
  }
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

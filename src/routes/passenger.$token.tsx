import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPassengerViewByToken } from "@/lib/passenger.functions";
import { PassengerPortal } from "./passenger";

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
  if (!view.found || !view.workflow || !view.delivery || !view.case) throw notFound();
  return (
    <PassengerPortal
      deliveryIdOverride={view.workflow.deliveryId}
      token={token}
      resolvedDelivery={view.delivery}
      resolvedCase={view.case}
    />
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

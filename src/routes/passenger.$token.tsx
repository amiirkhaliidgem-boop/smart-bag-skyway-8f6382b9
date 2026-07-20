import { createFileRoute } from "@tanstack/react-router";
import { getPassengerViewByToken } from "@/lib/passenger.functions";
import { useStore } from "@/lib/store";
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
  const storeWorkflow = useStore((s) => s.workflow.find((w) => w.token === token));
  const storeDelivery = useStore((s) =>
    storeWorkflow ? s.deliveries.find((d) => d.deliveryId === storeWorkflow.deliveryId) : undefined,
  );
  const storeCase = useStore((s) =>
    storeDelivery ? s.cases.find((c) => c.bagId === storeDelivery.bagId) : undefined,
  );

  const workflow = view.found && view.workflow ? view.workflow : storeWorkflow;
  const delivery = view.delivery ?? storeDelivery;
  const kase = view.case ?? storeCase;

  if (!workflow || !delivery || !kase) return <TokenNotFound />;
  return (
    <PassengerPortal
      deliveryIdOverride={workflow.deliveryId}
      token={token}
      resolvedDelivery={delivery}
      resolvedCase={kase}
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

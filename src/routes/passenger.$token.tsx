import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPassengerViewByToken } from "@/lib/passenger.functions";
import { useStore } from "@/lib/store";
import { isHydrated, onHydrated } from "@/lib/persistence";
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

  const resolved = Boolean(workflow && delivery && kase);

  const [hydrated, setHydrated] = useState(() =>
    typeof window === "undefined" ? false : isHydrated(),
  );
  useEffect(() => {
    if (hydrated) return;
    return onHydrated(() => setHydrated(true));
  }, [hydrated]);

  if (resolved) {
    return (
      <PassengerPortal
        deliveryIdOverride={workflow!.deliveryId}
        token={token}
        resolvedDelivery={delivery!}
        resolvedCase={kase!}
      />
    );
  }

  // Loader has run (view is present). If the server resolved it, `resolved`
  // would be true above. Otherwise we need the client store to finish
  // hydrating before we can declare the token invalid.
  if (!hydrated) return <TokenLoading />;
  return <TokenNotFound />;
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

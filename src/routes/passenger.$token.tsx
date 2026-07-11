import { createFileRoute, notFound } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
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
  component: TokenPortal,
  notFoundComponent: TokenNotFound,
});

function TokenPortal() {
  const { token } = Route.useParams();
  const rec = useStore((s) => s.workflow.find((w) => w.token === token));
  if (!rec) {
    // On first render (SSR / pre-hydration) the workflow may not be
    // seeded yet — render a small placeholder and let hydration finish.
    return <TokenLoading />;
  }
  return <PassengerPortal deliveryIdOverride={rec.deliveryId} />;
}

function TokenLoading() {
  return (
    <div className="min-h-[60vh] grid place-items-center text-sm text-muted-foreground">
      Loading your delivery…
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

// Suppress unused import warning for notFound (kept for future guard).
void notFound;
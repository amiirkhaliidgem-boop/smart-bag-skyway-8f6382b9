import { createFileRoute } from "@tanstack/react-router";
import { TrackBaggage } from "@/components/tracking/track-baggage";

export const Route = createFileRoute("/tracking")({
  head: () => ({
    meta: [
      { title: "Baggage Tracking — Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Locate any baggage case by PIR, PNR, Bag Tag, Bag ID or Delivery ID and view its live status.",
      },
      { property: "og:title", content: "Baggage Tracking — Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content:
          "Locate any baggage case by PIR, PNR, Bag Tag, Bag ID or Delivery ID and view its live status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackingRoute,
});

function TrackingRoute() {
  return <TrackBaggage />;
}

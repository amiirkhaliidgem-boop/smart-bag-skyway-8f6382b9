import { createFileRoute } from "@tanstack/react-router";
import { FeedbackDashboard } from "@/components/feedback/feedback-dashboard";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Customer Feedback — Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Read-only dashboard of passenger feedback collected through the Passenger Portal after delivery completion.",
      },
      { property: "og:title", content: "Customer Feedback Dashboard" },
      {
        property: "og:description",
        content: "Operational analytics for passenger-submitted baggage delivery feedback.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeedbackRoute,
});

function FeedbackRoute() {
  return <FeedbackDashboard />;
}

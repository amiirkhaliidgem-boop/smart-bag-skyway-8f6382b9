import { createFileRoute } from "@tanstack/react-router";
import { ContactCenterComingSoon } from "@/components/contact-center/contact-center-coming-soon";

export const Route = createFileRoute("/contact-center")({
  head: () => ({
    meta: [
      { title: "Contact Center — Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Contact Center module — coming in a future release.",
      },
      { property: "og:title", content: "Contact Center — Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content:
          "Contact Center module — coming in a future release.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactCenterRoute,
});

function ContactCenterRoute() {
  return <ContactCenterComingSoon />;
}

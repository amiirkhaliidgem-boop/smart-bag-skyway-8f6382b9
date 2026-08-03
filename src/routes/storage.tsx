import { createFileRoute } from "@tanstack/react-router";
import { Warehouse } from "lucide-react";
import { ModuleComingSoon } from "@/components/module-coming-soon";
// Storage Control is a planned module. The screen intentionally has no backend
// wiring until the Warehouse phase is specified.

export const Route = createFileRoute("/storage")({
  head: () => ({
    meta: [
      { title: "Storage Control — Smart Baggage Ecosystem" },
      { name: "description", content: "Storage Control module — coming in a future release." },
      { property: "og:title", content: "Storage Control — Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content: "Storage Control module — coming in a future release.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoragePage,
});

function StoragePage() {
  // Warehouse phase: swap the line below for <StorageControlFull /> to re-enable.
  return (
    <ModuleComingSoon
      title="Storage Control"
      subtitle="Warehouse zone, shelf and position assignment for all located baggage."
      icon={Warehouse}
    />
  );
}

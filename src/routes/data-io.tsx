import { createFileRoute } from "@tanstack/react-router";
import { ArrowRightLeft } from "lucide-react";
import { ModuleComingSoon } from "@/components/module-coming-soon";
// PRESERVED: the full implementation lives in the component below. To re-enable
// the Import / Export phase, render <DataIoFull /> instead of <ModuleComingSoon />.
// import { DataIoFull } from "@/components/io/data-io-full";

export const Route = createFileRoute("/data-io")({
  head: () => ({
    meta: [
      { title: "Import / Export — IAB Smart Baggage Ecosystem" },
      { name: "description", content: "Import / Export module — coming in a future release." },
      { property: "og:title", content: "Import / Export — IAB Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content: "Import / Export module — coming in a future release.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataIoPage,
});

function DataIoPage() {
  // Import / Export phase: swap the line below for <DataIoFull /> to re-enable.
  return (
    <ModuleComingSoon
      title="Import / Export"
      subtitle="Bulk data import and export across every operational module."
      icon={ArrowRightLeft}
    />
  );
}

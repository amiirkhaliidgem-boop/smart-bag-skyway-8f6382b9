import { createFileRoute } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { ModuleComingSoon } from "@/components/module-coming-soon";
// QR Scan is a planned module. The screen intentionally has no backend wiring
// until the Warehouse phase is specified.

export const Route = createFileRoute("/qr-scan")({
  head: () => ({
    meta: [
      { title: "QR Scan — Smart Baggage Ecosystem" },
      { name: "description", content: "QR Scan module — coming in a future release." },
      { property: "og:title", content: "QR Scan — Smart Baggage Ecosystem" },
      { property: "og:description", content: "QR Scan module — coming in a future release." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QrScanPage,
});

function QrScanPage() {
  // Warehouse phase: swap the line below for <QrScanFull /> to re-enable.
  return (
    <ModuleComingSoon
      title="QR Scan & Lookup"
      subtitle="Scan or enter a Bag ID, PIR, or passenger to open a record and update its status."
      icon={QrCode}
    />
  );
}

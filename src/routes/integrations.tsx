import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, Database, MessageCircle, MapPin, KeyRound, Mail, Cloud, Smartphone, Building2 } from "lucide-react";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [{ title: "Integrations — IAB Smart Baggage Ecosystem" }] }),
  component: IntegrationsPage,
});

type Status = "Connected" | "Disconnected" | "Pending";

const INTEGRATIONS: {
  key: string;
  name: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  status: Status;
}[] = [
  { key: "odoo", name: "Odoo ERP", desc: "Financials, CRM and operations sync for baggage cases.", Icon: Building2, status: "Pending" },
  { key: "sms", name: "SMS Gateway", desc: "Transactional SMS delivery for passenger notifications.", Icon: MessageCircle, status: "Pending" },
  { key: "wa", name: "WhatsApp Business", desc: "Two-way passenger messaging over WhatsApp Cloud API.", Icon: MessageCircle, status: "Pending" },
  { key: "maps", name: "Google Maps Platform", desc: "Directions, distance matrix and live driver tracking.", Icon: MapPin, status: "Pending" },
  { key: "otp", name: "OTP Provider", desc: "One-time password service for handover verification.", Icon: KeyRound, status: "Pending" },
  { key: "email", name: "Email Provider", desc: "Transactional email for tracking links and receipts.", Icon: Mail, status: "Pending" },
  { key: "db", name: "Cloud Database", desc: "Managed Postgres for enterprise data persistence.", Icon: Database, status: "Pending" },
  { key: "driver-app", name: "Driver Mobile App", desc: "Native iOS/Android companion for field operations.", Icon: Smartphone, status: "Pending" },
];

function IntegrationsPage() {
  const badge = (s: Status) =>
    s === "Connected"
      ? "bg-emerald-100 text-emerald-700"
      : s === "Pending"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-700";
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Plug className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">System Integrations</h1>
          <p className="text-sm text-muted-foreground">Manage third-party services that power the Smart Baggage Ecosystem.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {INTEGRATIONS.map((i) => (
          <Card key={i.key}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <i.Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{i.name}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${badge(i.status)}`}>
                      {i.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{i.desc}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="text-[11px] text-muted-foreground">Environment · Production</p>
                <Button size="sm" variant="secondary" disabled>Configure</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5 flex items-start gap-3">
          <Cloud className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Integration credentials are managed via workspace secrets. Live wiring will be enabled per environment
            once provider approvals are received from IAB's IT department.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStore,
  updateDelivery,
  addDelivery,
  driverPool,
  ensurePassengerToken,
  createTestNotification,
  type DeliveryStatus,
  type OtpStatus,
  type Delivery,
} from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import {
  Truck,
  Plus,
  ShieldCheck,
  Clock,
  CheckCircle2,
  ShieldAlert,
  MoreHorizontal,
  ExternalLink,
  Link as LinkIcon,
  Send,
  MessageCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const STATUSES: DeliveryStatus[] = ["Pending", "Assigned", "Out For Delivery", "Delivered"];

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery Management — Smart Baggage Ecosystem" },
      { name: "description", content: "Schedule and dispatch home baggage delivery." },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const deliveries = useStore((s) => s.deliveries);
  const [open, setOpen] = useState(false);

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = deliveries.filter((d) => d.status === s).length;
    return acc;
  }, {});

  const otpVerified = deliveries.filter((d) => d.otpStatus === "Verified").length;
  const otpPending = deliveries.filter((d) => d.otpStatus === "Pending" || d.otpStatus === "Sent").length;
  const inTransit = counts["Out For Delivery"] ?? 0;
  const completed = counts["Delivered"] ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Home Baggage Delivery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Coordinate last-mile delivery to passenger addresses across Greater Cairo.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Schedule Delivery</Button>
          </DialogTrigger>
          <NewDeliveryDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="In Transit" value={inTransit} icon={<Truck className="h-5 w-5" />} tone="primary" />
        <KpiCard label="Completed Today" value={completed} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <KpiCard label="OTP Verified" value={otpVerified} icon={<ShieldCheck className="h-5 w-5" />} tone="indigo" />
        <KpiCard label="Awaiting OTP" value={otpPending} icon={<ShieldAlert className="h-5 w-5" />} tone="amber" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUSES.map((s) => (
          <Card key={s}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s}</p>
                <p className="text-lg font-bold tabular-nums">{counts[s] ?? 0}</p>
              </div>
              <StatusBadge status={s} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Delivery ID</th>
                  <th className="text-left px-4 py-3 font-medium">Bag</th>
                  <th className="text-left px-4 py-3 font-medium">Passenger</th>
                  <th className="text-left px-4 py-3 font-medium">Address</th>
                  <th className="text-left px-4 py-3 font-medium">Driver</th>
                  <th className="text-left px-4 py-3 font-medium">ETA</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">OTP</th>
                  <th className="text-left px-4 py-3 font-medium">Passenger</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.map((d) => (
                  <DeliveryRow key={d.deliveryId} d={d} />
                ))}
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No deliveries scheduled.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "primary" | "emerald" | "indigo" | "amber";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    indigo: "bg-indigo-100 text-indigo-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-10 w-10 rounded-lg grid place-items-center ${tones[tone]}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatEta(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    // Force UTC to avoid SSR/client timezone hydration mismatches.
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}

function otpStyles(status: OtpStatus) {
  switch (status) {
    case "Verified":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Sent":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Failed":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function DeliveryRow({ d }: { d: Delivery }) {
  const [otpOpen, setOtpOpen] = useState(false);
  return (
    <tr className="hover:bg-muted/40">
      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{d.deliveryId}</td>
      <td className="px-4 py-3 font-mono text-xs">{d.bagId}</td>
      <td className="px-4 py-3">{d.passengerName}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">{d.address}</td>
      <td className="px-4 py-3">{d.driver}</td>
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          {formatEta(d.eta)}
        </span>
      </td>
      <td className="px-4 py-3">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={d.status}
          onChange={(e) => {
            const next = e.target.value as DeliveryStatus;
            const driver =
              next !== "Pending" && d.driver === "—"
                ? driverPool[Math.floor(Math.random() * driverPool.length)]
                : d.driver;
            const otpStatus =
              next === "Out For Delivery" && d.otpStatus === "Pending" ? "Sent" : d.otpStatus;
            updateDelivery(d.deliveryId, { status: next, driver, otpStatus });
            toast.success(`${d.deliveryId} → ${next}`);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${otpStyles(
            d.otpStatus,
          )}`}
        >
          <ShieldCheck className="h-3 w-3" />
          {d.otpStatus}
        </span>
      </td>
      <td className="px-4 py-3">
        <PassengerActions d={d} />
      </td>
      <td className="px-4 py-3 text-right">
        <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={d.otpStatus === "Verified"}>
              Verify OTP
            </Button>
          </DialogTrigger>
          <OtpDialog d={d} onClose={() => setOtpOpen(false)} />
        </Dialog>
      </td>
    </tr>
  );
}

function OtpDialog({ d, onClose }: { d: Delivery; onClose: () => void }) {
  const [code, setCode] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim() === d.otpCode) {
      updateDelivery(d.deliveryId, { otpStatus: "Verified", status: "Delivered" });
      toast.success(`OTP verified · ${d.deliveryId} delivered`);
      onClose();
    } else {
      updateDelivery(d.deliveryId, { otpStatus: "Failed" });
      toast.error("Invalid OTP code");
    }
  }
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>OTP Verification</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code shared with{" "}
          <span className="font-medium text-foreground">{d.passengerName}</span> to
          confirm handover of <span className="font-mono">{d.bagId}</span>.
        </p>
        <div className="space-y-1.5">
          <Label>OTP Code</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            inputMode="numeric"
            maxLength={6}
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Demo code: <span className="font-mono">{d.otpCode}</span>
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Confirm Delivery</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function NewDeliveryDialog({ onClose }: { onClose: () => void }) {
  const readyCases = useStore((s) =>
    s.cases.filter(
      (c) => c.status === "Ready For Delivery" || c.status === "Stored",
    ),
  );
  const [bagId, setBagId] = useState(readyCases[0]?.bagId ?? "");
  const [address, setAddress] = useState("");
  const [driver, setDriver] = useState(driverPool[0]);
  const [eta, setEta] = useState(() => {
    const t = new Date(Date.now() + 4 * 60 * 60 * 1000);
    return t.toISOString().slice(0, 16);
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = readyCases.find((x) => x.bagId === bagId);
    if (!c) {
      toast.error("Please select a bag.");
      return;
    }
    if (!address.trim()) {
      toast.error("Address is required.");
      return;
    }
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const d = addDelivery({
      bagId: c.bagId,
      passengerName: c.passengerName,
      address,
      mobile: c.contact,
      pirNumber: c.pirNumber,
      priority: "Normal",
      status: "Assigned",
      driver,
      eta: new Date(eta).toISOString(),
      otpStatus: "Pending",
      otpCode,
    });
    toast.success(`Scheduled ${d.deliveryId} · OTP ${otpCode}`);
    onClose();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Schedule Home Delivery</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Baggage</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={bagId}
            onChange={(e) => setBagId(e.target.value)}
          >
            {readyCases.length === 0 && <option value="">No eligible bags</option>}
            {readyCases.map((c) => (
              <option key={c.bagId} value={c.bagId}>
                {c.bagId} · {c.passengerName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Delivery Address</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, district, governorate"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Estimated Arrival</Label>
          <Input
            type="datetime-local"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Assigned Driver</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
          >
            {driverPool.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Schedule Delivery</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function PassengerActions({ d }: { d: Delivery }) {
  function withToken(action: (token: string, url: string) => void) {
    const token = ensurePassengerToken(d.deliveryId);
    if (!token) {
      toast.error("Tracking token unavailable for this delivery");
      return;
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/passenger/${token}`;
    action(token, url);
  }

  function previewPortal() {
    withToken((token) => {
      if (typeof window !== "undefined") {
        window.open(`/passenger/${token}`, "_blank", "noopener");
      }
    });
  }

  function copyTrackingLink() {
    withToken(async (_token, url) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const ta = document.createElement("textarea");
          ta.value = url;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        toast.success("Tracking link copied");
      } catch {
        toast.error("Failed to copy link");
      }
    });
  }

  function sendSms() {
    withToken(() => {
      const events = createTestNotification({
        deliveryId: d.deliveryId,
        channel: "sms",
        operator: "Delivery Desk",
      });
      toast.success(events.length ? "SMS queued" : "SMS template unavailable");
    });
  }

  function sendWhatsApp() {
    withToken(() => {
      const events = createTestNotification({
        deliveryId: d.deliveryId,
        channel: "whatsapp",
        operator: "Delivery Desk",
      });
      toast.success(
        events.length ? "WhatsApp queued" : "WhatsApp template unavailable",
      );
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2">
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Portal</span>
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Passenger Experience</DropdownMenuLabel>
        <DropdownMenuItem onClick={previewPortal}>
          <ExternalLink className="h-4 w-4" /> Preview Passenger Portal
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyTrackingLink}>
          <LinkIcon className="h-4 w-4" /> Copy Tracking Link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={sendSms}>
          <Send className="h-4 w-4" /> Send SMS
        </DropdownMenuItem>
        <DropdownMenuItem onClick={sendWhatsApp}>
          <MessageCircle className="h-4 w-4" /> Send WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
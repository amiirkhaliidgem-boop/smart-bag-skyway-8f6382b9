import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStore,
  updateDelivery,
  driverPool,
  type Delivery,
  type DeliveryStatus,
} from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Truck,
  MapPin,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  PackageCheck,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/driver-portal")({
  head: () => ({ meta: [{ title: "Driver Portal — Smart Baggage Ecosystem" }] }),
  component: DriverPortalPage,
});

function DriverPortalPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [driver, setDriver] = useState(driverPool[0]);
  if (!signedIn) {
    return <DriverLogin driver={driver} setDriver={setDriver} onSignIn={() => setSignedIn(true)} />;
  }
  return <DriverDashboard driver={driver} onSignOut={() => setSignedIn(false)} />;
}

function DriverLogin({
  driver,
  setDriver,
  onSignIn,
}: {
  driver: string;
  setDriver: (s: string) => void;
  onSignIn: () => void;
}) {
  const [pin, setPin] = useState("");
  return (
    <div className="max-w-md mx-auto pt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" /> Driver Sign In
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Driver</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            >
              {driverPool.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>PIN</Label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Demo PIN: 1234"
              maxLength={4}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (pin !== "1234") {
                toast.error("Invalid PIN — demo uses 1234");
                return;
              }
              onSignIn();
              toast.success(`Welcome, ${driver}`);
            }}
          >
            Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DriverDashboard({ driver, onSignOut }: { driver: string; onSignOut: () => void }) {
  const deliveries = useStore((s) =>
    s.deliveries.filter((d) => d.driver === driver),
  );
  const assigned = deliveries.filter((d) => d.status === "Assigned");
  const inProgress = deliveries.filter(
    (d) => d.status === "Picked Up" || d.status === "Out For Delivery",
  );
  const completed = deliveries.filter((d) => d.status === "Delivered");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Driver Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in as <span className="font-medium text-foreground">{driver}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onSignOut} className="gap-2">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Assigned" value={assigned.length} icon={<PackageCheck />} tone="indigo" />
        <Kpi label="In Transit" value={inProgress.length} icon={<Truck />} tone="primary" />
        <Kpi label="Completed" value={completed.length} icon={<CheckCircle2 />} tone="emerald" />
      </div>

      <Section title="Assigned" items={assigned} empty="No new assignments." />
      <Section title="In Progress" items={inProgress} empty="Nothing in transit." />
      <Section title="Completed Today" items={completed} empty="No deliveries completed yet." />
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "primary" | "indigo" | "emerald";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    indigo: "bg-indigo-100 text-indigo-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg grid place-items-center ${tones[tone]}`}>
          <div className="h-5 w-5">{icon}</div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: Delivery[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">{empty}</p>
        )}
        {items.map((d) => <DeliveryCard key={d.deliveryId} d={d} />)}
      </CardContent>
    </Card>
  );
}

function DeliveryCard({ d }: { d: Delivery }) {
  const [otpOpen, setOtpOpen] = useState(false);
  const next: Record<DeliveryStatus, DeliveryStatus | null> = {
    Pending: "Assigned",
    Assigned: "Picked Up",
    "Picked Up": "Out For Delivery",
    "Out For Delivery": "Delivered",
    Delivered: null,
  };
  const nextStatus = next[d.status];
  const priorityTone: Record<string, string> = {
    VIP: "bg-rose-100 text-rose-700",
    High: "bg-amber-100 text-amber-700",
    Normal: "bg-slate-100 text-slate-700",
    Low: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{d.passengerName}</p>
          <p className="text-xs font-mono text-muted-foreground">
            {d.deliveryId} · {d.bagId} · PIR {d.pirNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${priorityTone[d.priority]}`}>
            {d.priority}
          </span>
          <StatusBadge status={d.status} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-sm">
        <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />{d.address}</p>
        <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{d.mobile}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> ETA {new Date(d.eta).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        <p className="flex items-center gap-2 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> OTP: <span className="font-medium">{d.otpStatus}</span></p>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {nextStatus && nextStatus !== "Delivered" && (
          <Button
            size="sm"
            onClick={() => {
              updateDelivery(d.deliveryId, { status: nextStatus });
              toast.success(`${d.deliveryId} → ${nextStatus}`);
            }}
          >
            Mark {nextStatus}
          </Button>
        )}
        {d.status === "Out For Delivery" && (
          <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default">Complete with OTP</Button>
            </DialogTrigger>
            <OtpDialog d={d} onClose={() => setOtpOpen(false)} />
          </Dialog>
        )}
      </div>
    </div>
  );
}

function OtpDialog({ d, onClose }: { d: Delivery; onClose: () => void }) {
  const [code, setCode] = useState("");
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Verify OTP</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim() === d.otpCode) {
            updateDelivery(d.deliveryId, { status: "Delivered", otpStatus: "Verified" });
            toast.success(`Delivered · OTP verified`);
            onClose();
          } else {
            updateDelivery(d.deliveryId, { otpStatus: "Failed" });
            toast.error("Invalid OTP");
          }
        }}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          Ask <span className="font-medium text-foreground">{d.passengerName}</span> for the 6-digit code.
        </p>
        <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="6-digit code" />
        <p className="text-[11px] text-muted-foreground">Demo OTP: <span className="font-mono">{d.otpCode}</span></p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Confirm</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
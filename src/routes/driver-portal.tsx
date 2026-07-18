import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  driverStartTrip,
  driverMarkDelivered,
  driverPool,
  type Delivery,
} from "@/lib/store";
import { getDeliveryStage } from "@/lib/store";
import { optimizeRoute, navigationHref } from "@/lib/routing/optimize";
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
import {
  Truck,
  MapPin,
  Phone,
  CheckCircle2,
  PackageCheck,
  LogOut,
  Navigation,
  Package,
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
  const mine = useStore((s) => s.deliveries.filter((d) => d.driver === driver));

  // Today's Route — every stop assigned to this driver that has not been
  // delivered yet, optimized from the airport (nearest-neighbor).
  const route = useMemo(() => {
    const open = mine.filter((d) => getDeliveryStage(d) !== "Delivered");
    return optimizeRoute(open);
  }, [mine]);
  const completed = mine.filter((d) => getDeliveryStage(d) === "Delivered");

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
        <Kpi label="Stops Today" value={route.length} icon={<Package />} tone="indigo" />
        <Kpi
          label="Out for Delivery"
          value={route.filter((d) => getDeliveryStage(d) === "Out for Delivery").length}
          icon={<Truck />}
          tone="primary"
        />
        <Kpi label="Completed" value={completed.length} icon={<CheckCircle2 />} tone="emerald" />
      </div>

      <RouteSection route={route} />
      <Section title="Completed" items={completed} empty="No deliveries completed yet." />
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

function RouteSection({ route }: { route: Delivery[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Navigation className="h-4 w-4" /> Today's Route
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {route.length} {route.length === 1 ? "stop" : "stops"} · optimized from airport
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {route.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No stops assigned. New deliveries will appear here automatically.
          </p>
        )}
        {route.map((d, i) => (
          <DeliveryCard key={d.deliveryId} d={d} stopNumber={i + 1} />
        ))}
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

function DeliveryCard({ d, stopNumber }: { d: Delivery; stopNumber?: number }) {
  const [otpOpen, setOtpOpen] = useState(false);
  const stage = getDeliveryStage(d);
  const cases = useStore((s) => s.cases);
  const kase = cases.find((c) => c.bagId === d.bagId);
  const bagTag =
    kase?.baggage?.bagTags?.filter(Boolean).join(", ") ||
    kase?.bagTagNumber ||
    "—";
  const priorityTone: Record<string, string> = {
    VIP: "bg-rose-100 text-rose-700",
    High: "bg-amber-100 text-amber-700",
    Normal: "bg-slate-100 text-slate-700",
    Low: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          {stopNumber !== undefined && (
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-bold shrink-0">
              {stopNumber}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold">{d.passengerName}</p>
          <p className="text-xs font-mono text-muted-foreground">
              {d.deliveryId} · PIR {d.pirNumber} · Tag {bagTag}
          </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${priorityTone[d.priority]}`}>
            {d.priority}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-sm">
        <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />{d.address}</p>
        <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{d.mobile}</p>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <a
          href={navigationHref(d)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted"
        >
          <Navigation className="h-4 w-4" /> Open Navigation
        </a>
        {stage === "Assigned" && (
          <Button
            size="sm"
            onClick={() => {
              driverStartTrip(d.deliveryId, { actor: d.driver, role: "Driver" });
              toast.success(`${d.deliveryId} — Out for Delivery`);
            }}
            className="gap-1.5"
          >
            <Truck className="h-4 w-4" /> Start Delivery
          </Button>
        )}
        {stage === "Out for Delivery" && (
          <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default" className="gap-1.5">
                <PackageCheck className="h-4 w-4" /> Complete with OTP
              </Button>
            </DialogTrigger>
            <OtpDialog d={d} onClose={() => setOtpOpen(false)} />
          </Dialog>
        )}
        {stage === "Delivered" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4" /> Delivered
          </span>
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
            driverMarkDelivered(d.deliveryId, { actor: d.driver, role: "Driver" });
            toast.success(`Delivered · OTP verified`);
            onClose();
          } else {
            toast.error("Invalid OTP");
          }
        }}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          Ask <span className="font-medium text-foreground">{d.passengerName}</span> for the 6-digit code.
        </p>
        <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} placeholder="6-digit code" />
        <p className="text-[11px] text-muted-foreground">Ask the passenger for the OTP shown in their Passenger Portal.</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Confirm</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
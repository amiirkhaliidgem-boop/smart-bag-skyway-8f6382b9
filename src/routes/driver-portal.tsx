import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useStore,
  driverAccept,
  driverCollect,
  driverStartTrip,
  driverMarkDelivered,
  driverPool,
  reportDriverPosition,
  type Delivery,
} from "@/lib/store";
import { getDeliveryStage } from "@/lib/store";
import {
  stopNavigationHref,
  routeNavigationHref,
  type LatLng,
} from "@/lib/routing/optimize";
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
  Crosshair,
  Route as RouteIcon,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  DriverLanguageProvider,
  LanguageToggle,
  useDriverLang,
} from "@/lib/i18n/driver-language";

export const Route = createFileRoute("/driver-portal")({
  head: () => ({ meta: [{ title: "Driver Portal — Smart Baggage Ecosystem" }] }),
  component: DriverPortalPage,
});

function DriverPortalPage() {
  return (
    <DriverLanguageProvider>
      <DriverPortalBody />
    </DriverLanguageProvider>
  );
}

function DriverPortalBody() {
  const [signedIn, setSignedIn] = useState(false);
  const [driver, setDriver] = useState(driverPool[0]);
  const { dir, lang } = useDriverLang();
  return (
    <div dir={dir} lang={lang}>
      {!signedIn ? (
        <DriverLogin driver={driver} setDriver={setDriver} onSignIn={() => setSignedIn(true)} />
      ) : (
        <DriverDashboard driver={driver} onSignOut={() => setSignedIn(false)} />
      )}
    </div>
  );
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
  const { t } = useDriverLang();
  return (
    <div className="max-w-md mx-auto pt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            <Truck className="h-4 w-4" /> {t.signInTitle}
            <LanguageToggle className="ms-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.driverLabel}</Label>
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
            <Label>{t.pinLabel}</Label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t.pinPlaceholder}
              maxLength={4}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (pin !== "1234") {
                toast.error(t.invalidPin);
                return;
              }
              onSignIn();
              toast.success(t.welcome(driver));
            }}
          >
            {t.signInAction}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DriverDashboard({ driver, onSignOut }: { driver: string; onSignOut: () => void }) {
  const { t } = useDriverLang();
  // Route optimization is owned by the Workflow Engine (see
  // `computeDriverRoute` in src/lib/store.ts). The Driver Portal only
  // reads `driverRoutes[driver]` and reports live GPS back to the engine.
  const mine = useStore((s) => s.deliveries.filter((d) => d.driver === driver));
  const engineRoute = useStore((s) => s.driverRoutes[driver]);
  const completed = mine.filter((d) => getDeliveryStage(d) === "Delivered");
  const route: Delivery[] = useMemo(() => {
    if (!engineRoute) return [];
    const byId = new Map(mine.map((d) => [d.deliveryId, d]));
    return engineRoute.stops
      .map((id) => byId.get(id))
      .filter((d): d is Delivery => !!d);
  }, [engineRoute, mine]);
  const origin: LatLng | null = engineRoute
    ? { lat: engineRoute.origin.lat, lng: engineRoute.origin.lng }
    : null;
  const originSource = engineRoute?.origin.source ?? null;

  // GPS reporter — pushes throttled position fixes to the Workflow Engine.
  const [gpsStatus, setGpsStatus] = useState<
    "idle" | "requesting" | "on" | "denied" | "unsupported" | "error"
  >("idle");
  const lastFixRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("unsupported");
      return;
    }
    setGpsStatus("requesting");
    const push = (p: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = p.coords;
      const now = Date.now();
      const last = lastFixRef.current;
      // Throttle: only report if moved >75m or 30s elapsed.
      if (last) {
        const dt = now - last.at;
        const dLat = (latitude - last.lat) * 111_320;
        const dLng = (longitude - last.lng) * 111_320 * Math.cos((latitude * Math.PI) / 180);
        const distM = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dt < 30_000 && distM < 75) return;
      }
      lastFixRef.current = { lat: latitude, lng: longitude, at: now };
      setGpsStatus("on");
      reportDriverPosition(driver, { lat: latitude, lng: longitude, accuracy });
    };
    const onError = (e: GeolocationPositionError) => {
      setGpsStatus(e.code === e.PERMISSION_DENIED ? "denied" : "error");
    };
    navigator.geolocation.getCurrentPosition(push, onError, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 15_000,
    });
    const watchId = navigator.geolocation.watchPosition(push, onError, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [driver]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t.portalTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.signedInAs} <span className="font-medium text-foreground">{driver}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button variant="outline" size="sm" onClick={onSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> {t.signOut}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label={t.stopsToday} value={route.length} icon={<Package />} tone="indigo" />
        <Kpi
          label={t.outForDelivery}
          value={route.filter((d) => getDeliveryStage(d) === "Out for Delivery").length}
          icon={<Truck />}
          tone="primary"
        />
        <Kpi label={t.completed} value={completed.length} icon={<CheckCircle2 />} tone="emerald" />
      </div>

      <RouteSection
        route={route}
        origin={origin}
        originSource={originSource}
        gpsStatus={gpsStatus}
      />
      <Section title={t.completed} items={completed} empty={t.noCompleted} />
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

function RouteSection({
  route,
  origin,
  originSource,
  gpsStatus,
}: {
  route: Delivery[];
  origin: LatLng | null;
  originSource: "gps" | "lastStop" | "station" | null;
  gpsStatus: "idle" | "requesting" | "on" | "denied" | "unsupported" | "error";
}) {
  const { t } = useDriverLang();
  const fullRouteHref = origin ? routeNavigationHref(origin, route) : null;
  const originLabel =
    originSource === "gps"
      ? t.originGps
      : originSource === "lastStop"
        ? t.originLastStop
        : originSource === "station"
          ? t.originStation
          : t.originUnknown;
  const gpsBadge =
    gpsStatus === "on"
      ? { text: t.gpsOn, tone: "bg-emerald-100 text-emerald-700" }
      : gpsStatus === "requesting"
        ? { text: t.gpsLocating, tone: "bg-amber-100 text-amber-700" }
        : gpsStatus === "denied"
          ? { text: t.gpsDenied, tone: "bg-slate-100 text-slate-600" }
          : gpsStatus === "unsupported"
            ? { text: t.gpsUnsupported, tone: "bg-slate-100 text-slate-600" }
            : gpsStatus === "error"
              ? { text: t.gpsError, tone: "bg-rose-100 text-rose-700" }
              : { text: t.gpsIdle, tone: "bg-slate-100 text-slate-600" };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <Navigation className="h-4 w-4" /> {t.todaysRoute}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${gpsBadge.tone}`}>
            <Crosshair className="inline h-3 w-3 me-1" />
            {gpsBadge.text}
          </span>
          <span className="ms-auto text-xs font-normal text-muted-foreground">
            {t.stopsCount(route.length)} · {t.fromOrigin(originLabel)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {route.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t.noStops}
          </p>
        )}
        {route.length > 0 && fullRouteHref && (
          <a
            href={fullRouteHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <RouteIcon className="h-4 w-4" /> {t.navigateFullRoute}
          </a>
        )}
        {route.map((d, i) => (
          <DeliveryCard
            key={d.deliveryId}
            d={d}
            stopNumber={i + 1}
            isCurrent={i === 0}
            legOrigin={
              i === 0
                ? origin
                : route[i - 1].destination
                  ? { lat: route[i - 1].destination!.lat, lng: route[i - 1].destination!.lng }
                  : origin
            }
          />
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

function DeliveryCard({
  d,
  stopNumber,
  isCurrent,
  legOrigin,
}: {
  d: Delivery;
  stopNumber?: number;
  isCurrent?: boolean;
  legOrigin?: LatLng | null;
}) {
  const [otpOpen, setOtpOpen] = useState(false);
  const { t } = useDriverLang();
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
    <div
      className={`rounded-lg border p-4 transition-colors ${
        isCurrent
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:bg-muted/30 opacity-90"
      }`}
    >
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
          {isCurrent && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary text-primary-foreground">
              {t.currentStop}
            </span>
          )}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${priorityTone[d.priority]}`}>
            {t.priority(d.priority)}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-sm">
        <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />{d.address}</p>
        <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{d.mobile}</p>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {legOrigin && (
          <a
            href={stopNavigationHref(legOrigin, d)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted"
          >
            <Navigation className="h-4 w-4" /> {t.navigateToStop}
          </a>
        )}
        {stage === "Assigned" && (
          <Button
            size="sm"
            onClick={() => {
              driverAccept(d.deliveryId, { actor: d.driver, role: "Driver" });
              toast.success(t.acceptedToast(d.deliveryId));
            }}
            className="gap-1.5"
          >
            <UserCheck className="h-4 w-4" /> {t.accept}
          </Button>
        )}
        {stage === "Driver Accepted" && (
          <Button
            size="sm"
            onClick={() => {
              driverCollect(d.deliveryId, { actor: d.driver, role: "Driver" });
              toast.success(t.collectedToast(d.deliveryId));
            }}
            className="gap-1.5"
          >
            <Package className="h-4 w-4" /> {t.collectBag}
          </Button>
        )}
        {stage === "Collected Bag" && (
          <Button
            size="sm"
            onClick={() => {
              driverStartTrip(d.deliveryId, { actor: d.driver, role: "Driver" });
              toast.success(t.outForDeliveryToast(d.deliveryId));
            }}
            className="gap-1.5"
          >
            <Truck className="h-4 w-4" /> {t.startDelivery}
          </Button>
        )}
        {stage === "Out for Delivery" && (
          <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default" className="gap-1.5">
                <PackageCheck className="h-4 w-4" /> {t.completeWithOtp}
              </Button>
            </DialogTrigger>
            <OtpDialog d={d} onClose={() => setOtpOpen(false)} />
          </Dialog>
        )}
        {stage === "Delivered" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4" /> {t.deliveredBadge}
          </span>
        )}
      </div>
    </div>
  );
}

function OtpDialog({ d, onClose }: { d: Delivery; onClose: () => void }) {
  const [code, setCode] = useState("");
  const { t, dir, lang } = useDriverLang();
  return (
    <DialogContent className="max-w-sm" dir={dir} lang={lang}>
      <DialogHeader>
        <DialogTitle>{t.verifyOtp}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim() === d.otpCode) {
            driverMarkDelivered(d.deliveryId, { actor: d.driver, role: "Driver" });
            toast.success(t.deliveredToast);
            onClose();
          } else {
            toast.error(t.invalidOtp);
          }
        }}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          {t.otpHint}
        </p>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          maxLength={4}
          inputMode="numeric"
          placeholder={t.otpPlaceholder}
          dir="ltr"
          className="text-center tabular-nums"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit">{t.confirm}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
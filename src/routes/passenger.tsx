import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  updateDelivery,
  addFeedback,
  addQualityIncident,
  addCallLog,
  type Delivery,
} from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import {
  CheckCircle2,
  Circle,
  Clock,
  Truck,
  MapPin,
  Phone,
  MessageCircle,
  Mail,
  ShieldCheck,
  Plane,
  PackageCheck,
  Star,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/passenger")({
  head: () => ({
    meta: [
      { title: "Passenger Portal — IAB Smart Baggage Delivery" },
      {
        name: "description",
        content:
          "Track your home baggage delivery, verify OTP, and share feedback with IAB.",
      },
    ],
  }),
  component: PassengerPortal,
});

type Stage = "track" | "feedback" | "done";

export function PassengerPortal({
  deliveryIdOverride,
}: { deliveryIdOverride?: string } = {}) {
  const deliveries = useStore((s) => s.deliveries);
  const cases = useStore((s) => s.cases);

  const active = useMemo(
    () =>
      deliveries.filter(
        (d) =>
          d.status === "Assigned" ||
          d.status === "Picked Up" ||
          d.status === "Out For Delivery" ||
          d.status === "Delivered",
      ),
    [deliveries],
  );

  const [selectedId, setSelectedId] = useState(
    deliveryIdOverride ??
      active.find((d) => d.status === "Out For Delivery")?.deliveryId ??
      active[0]?.deliveryId ??
      "",
  );

  const delivery = active.find((d) => d.deliveryId === selectedId) ?? active[0];
  const kase = delivery ? cases.find((c) => c.bagId === delivery.bagId) : undefined;

  const [stage, setStage] = useState<Stage>(
    delivery?.status === "Delivered" ? "feedback" : "track",
  );

  if (!delivery || !kase) {
    return <EmptyState />;
  }

  return (
    <div className="-mx-4 -my-4 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8 min-h-[calc(100vh-3.5rem)] bg-[#f5f7fb]">
      <PortalHeader />
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-6 space-y-5">
        {active.length > 1 && !deliveryIdOverride && (
          <DemoSwitcher
            active={active}
            selectedId={delivery.deliveryId}
            onChange={(id) => {
              setSelectedId(id);
              const d = active.find((x) => x.deliveryId === id);
              setStage(d?.status === "Delivered" ? "feedback" : "track");
            }}
          />
        )}
        {stage === "track" && (
          <TrackStage
            delivery={delivery}
            onConfirm={() => {
              updateDelivery(delivery.deliveryId, {
                status: "Delivered",
                otpStatus: "Verified",
              });
              toast.success("Baggage delivery confirmed");
              setStage("feedback");
            }}
          />
        )}
        {stage === "feedback" && (
          <FeedbackStage
            delivery={delivery}
            onSubmit={() => {
              setStage("done");
            }}
          />
        )}
        {stage === "done" && <DoneStage delivery={delivery} />}
        <PortalFooter />
      </div>
    </div>
  );
}

function PortalHeader() {
  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 h-16 flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-white grid place-items-center shadow-sm ring-1 ring-white/20 overflow-hidden shrink-0">
          <img src={iabLogo.url} alt="IAB" className="h-10 w-10 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-primary-foreground/70 leading-none">
            IAB
          </p>
          <p className="text-sm sm:text-base font-semibold truncate leading-tight mt-1">
            Smart Baggage Delivery
          </p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary-foreground/80">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Secure Portal
        </div>
      </div>
    </header>
  );
}

function DemoSwitcher({
  active,
  selectedId,
  onChange,
}: {
  active: Delivery[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white/70 px-3 py-2 flex items-center gap-2 text-xs">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
        Demo passenger
      </span>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="ml-auto bg-transparent font-medium text-foreground focus:outline-none"
      >
        {active.map((d) => (
          <option key={d.deliveryId} value={d.deliveryId}>
            {d.passengerName} · {d.deliveryId}
          </option>
        ))}
      </select>
    </div>
  );
}

function etaHours(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Arriving now";
  const hours = Math.round(diff / (1000 * 60 * 60));
  if (hours <= 0) {
    const mins = Math.max(5, Math.round(diff / (1000 * 60)));
    return `${mins} Minutes`;
  }
  return `${String(hours).padStart(2, "0")} Hours`;
}

function TrackStage({
  delivery,
  onConfirm,
}: {
  delivery: Delivery;
  onConfirm: () => void;
}) {
  const [tags, setTags] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [otpAfter, setOtpAfter] = useState(false);
  const [noBribe, setNoBribe] = useState(true);
  const [showContact, setShowContact] = useState(false);
  const [reported, setReported] = useState(false);

  const allChecked = tags && sealed && otpAfter && noBribe;

  function handleNoBribeChange(next: boolean) {
    setNoBribe(next);
    if (!next && !reported) {
      addQualityIncident({
        bagId: delivery.bagId,
        deliveryId: delivery.deliveryId,
        passengerName: delivery.passengerName,
        driver: delivery.driver,
        category: "Possible Misconduct",
        severity: "High",
        status: "Open",
        description:
          "Passenger indicated an employee requested money, tips, gifts or unofficial payment during delivery. Auto-flagged from Passenger Portal.",
      });
      addCallLog({
        passengerName: delivery.passengerName,
        phone: delivery.mobile,
        pirNumber: delivery.pirNumber,
        bagId: delivery.bagId,
        agent: "System Alert",
        direction: "Callback Required",
        durationSec: 0,
        notes:
          "HIGH PRIORITY — Possible misconduct reported via Passenger Portal. Escalated to Contact Center Supervisor.",
      });
      setReported(true);
      toast.error(
        "High priority incident created. Contact Center Supervisor notified.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <WelcomeCard delivery={delivery} />
      <SummaryCard delivery={delivery} />
      <TimelineCard delivery={delivery} />
      <DriverCard delivery={delivery} onContact={() => setShowContact(true)} />
      <OtpCard code={delivery.otpCode.slice(0, 4)} />

      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
              Before receiving your baggage
            </p>
            <h3 className="text-lg font-semibold mt-1">
              Please confirm the following
            </h3>
          </div>
          <div className="space-y-3">
            <CheckItem
              checked={tags}
              onChange={setTags}
              label="I verified my baggage tag numbers."
            />
            <CheckItem
              checked={sealed}
              onChange={setSealed}
              label="I confirmed the baggage is sealed and in good condition."
            />
            <CheckItem
              checked={otpAfter}
              onChange={setOtpAfter}
              label="I will provide the OTP only after receiving my baggage."
            />
            <CheckItem
              checked={noBribe}
              onChange={handleNoBribeChange}
              label="No employee requested money, tips, gifts or any unofficial payment."
              sublabel="أؤكد أننى لم أتعرض لأى طلب أموال أو إكرامية أو أى مقابل مادى غير رسمى."
            />
          </div>

          {reported && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 flex gap-2 text-rose-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed">
                A <span className="font-semibold">High Priority Quality Incident</span>{" "}
                has been opened and the Contact Center Supervisor has been notified.
                An IAB representative will contact you shortly.
              </div>
            </div>
          )}

          <Button
            size="lg"
            className="w-full h-12 text-base"
            disabled={!allChecked}
            onClick={onConfirm}
          >
            <PackageCheck className="h-5 w-5 mr-2" />
            Confirm Baggage Received
          </Button>
          {!allChecked && (
            <p className="text-[11px] text-muted-foreground text-center">
              Please tick every confirmation above to enable the button.
            </p>
          )}
        </CardContent>
      </Card>

      {showContact && (
        <ContactModal
          delivery={delivery}
          onClose={() => setShowContact(false)}
        />
      )}
    </div>
  );
}

function WelcomeCard({ delivery }: { delivery: Delivery }) {
  const eta = etaHours(delivery.eta);
  return (
    <Card className="overflow-hidden border-0 shadow-md">
      <div className="bg-gradient-to-br from-primary to-[#0b1e4a] text-primary-foreground p-6 sm:p-7">
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/70">
          Welcome
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">
          Welcome Mr. {delivery.passengerName}
        </h1>
        <p className="text-sm text-primary-foreground/80 mt-1" dir="rtl">
          مرحباً أستاذ / {delivery.passengerName}
        </p>
        <p className="mt-4 text-primary-foreground/90">Your baggage is on the way.</p>
        <p className="text-primary-foreground/70 text-sm" dir="rtl">
          أمتعتك فى الطريق إليك.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/10 backdrop-blur px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-primary-foreground/70">
              Estimated Arrival
            </p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1">{eta}</p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-primary-foreground/70">
              Current Status
            </p>
            <p className="text-base sm:text-lg font-semibold mt-1">{delivery.status}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SummaryCard({ delivery }: { delivery: Delivery }) {
  const cases = useStore((s) => s.cases);
  const kase = cases.find((c) => c.bagId === delivery.bagId);
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Flight Number", value: kase?.flightNumber ?? "—" },
    { label: "PIR Number", value: delivery.pirNumber, mono: true },
    { label: "Bag Tag", value: kase?.bagTagNumber ?? "—", mono: true },
    { label: "Number of Bags", value: "1" },
    { label: "Delivery Address", value: delivery.address },
  ];
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plane className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Delivery Details</p>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col">
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.label}
              </dt>
              <dd className={cn("text-sm font-medium mt-0.5", r.mono && "font-mono")}>
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

const TIMELINE: {
  key: "pir" | "located" | "storage" | "assigned" | "out" | "delivered";
  label: string;
}[] = [
  { key: "pir", label: "PIR Created" },
  { key: "located", label: "Bag Located" },
  { key: "storage", label: "Storage Assigned" },
  { key: "assigned", label: "Driver Assigned" },
  { key: "out", label: "Out For Delivery" },
  { key: "delivered", label: "Delivered" },
];

function TimelineCard({ delivery }: { delivery: Delivery }) {
  const cases = useStore((s) => s.cases);
  const kase = cases.find((c) => c.bagId === delivery.bagId);

  let reachedIdx = 0;
  if (kase) {
    if (kase.status !== "Missing") reachedIdx = 1;
    if (kase.storage) reachedIdx = 2;
  }
  if (delivery.driver && delivery.driver !== "—" && delivery.status !== "Pending")
    reachedIdx = Math.max(reachedIdx, 3);
  if (delivery.status === "Picked Up" || delivery.status === "Out For Delivery")
    reachedIdx = 4;
  if (delivery.status === "Delivered") reachedIdx = 5;

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Delivery Timeline</p>
          <StatusBadge status={delivery.status} />
        </div>
        <ol className="space-y-3">
          {TIMELINE.map((step, i) => {
            const state =
              i < reachedIdx
                ? "done"
                : i === reachedIdx
                  ? "current"
                  : "pending";
            return (
              <li key={step.key} className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full grid place-items-center shrink-0",
                    state === "done" && "bg-emerald-500 text-white",
                    state === "current" && "bg-primary text-primary-foreground ring-4 ring-primary/15 animate-pulse",
                    state === "pending" && "bg-muted text-muted-foreground",
                  )}
                >
                  {state === "done" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : state === "current" ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      state === "pending" && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {state === "done"
                      ? "Completed"
                      : state === "current"
                        ? "In progress"
                        : "Pending"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function DriverCard({
  delivery,
  onContact,
}: {
  delivery: Delivery;
  onContact: () => void;
}) {
  const vehicle = "IAB · " + delivery.deliveryId.replace("DEL-", "V-");
  const eta = new Date(delivery.eta).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
            <Truck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Assigned Driver
            </p>
            <p className="font-semibold truncate">{delivery.driver}</p>
          </div>
          <Button variant="outline" onClick={onContact} className="shrink-0">
            Contact Us
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Vehicle Number" value={vehicle} />
          <InfoRow icon={<Clock className="h-4 w-4" />} label="Estimated Arrival Time" value={eta} />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="h-7 w-7 rounded bg-white text-primary grid place-items-center shrink-0 ring-1 ring-border">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function OtpCard({ code }: { code: string }) {
  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-white to-primary/5">
      <CardContent className="p-6 text-center">
        <div className="inline-flex items-center gap-2 text-primary text-xs uppercase tracking-[0.2em] font-semibold">
          <ShieldCheck className="h-4 w-4" />
          Verification Code
        </div>
        <p className="mt-3 text-5xl sm:text-6xl font-black tracking-[0.3em] tabular-nums text-primary">
          {code}
        </p>
        <p className="mt-4 text-sm text-foreground/80 max-w-md mx-auto">
          Please provide this OTP only after receiving and checking your baggage.
        </p>
        <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto" dir="rtl">
          يرجى مشاركة رمز التحقق فقط بعد استلام وفحص الأمتعة.
        </p>
      </CardContent>
    </Card>
  );
}

function CheckItem({
  checked,
  onChange,
  label,
  sublabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <div className="text-sm leading-relaxed">
        <p>{label}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-1" dir="rtl">
            {sublabel}
          </p>
        )}
      </div>
    </label>
  );
}

function ContactModal({
  delivery,
  onClose,
}: {
  delivery: Delivery;
  onClose: () => void;
}) {
  const options = [
    { icon: Phone, label: "Phone", value: "+20 2 2696 0000", href: "tel:+20226960000" },
    { icon: MessageCircle, label: "WhatsApp", value: "+20 100 000 1234", href: "https://wa.me/201000001234" },
    { icon: Mail, label: "Email", value: "support@iab.aero", href: "mailto:support@iab.aero" },
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-semibold">Contact Us</p>
            <p className="text-xs text-muted-foreground">
              Reference {delivery.deliveryId} · IAB Customer Care
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-2">
          {options.map((o) => (
            <a
              key={o.label}
              href={o.href}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                <o.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-xs text-muted-foreground truncate">{o.value}</p>
              </div>
            </a>
          ))}
          <p className="text-[11px] text-muted-foreground pt-2 text-center">
            For your safety, IAB does not enable direct driver communication.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeedbackStage({
  delivery,
  onSubmit,
}: {
  delivery: Delivery;
  onSubmit: () => void;
}) {
  const [overall, setOverall] = useState(5);
  const [prof, setProf] = useState(5);
  const [time, setTime] = useState(5);
  const [safe, setSafe] = useState<"yes" | "no">("yes");
  const [recommend, setRecommend] = useState<"yes" | "no">("yes");
  const [comments, setComments] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const avg = Math.round((overall + prof + time) / 3);
    addFeedback({
      bagId: delivery.bagId,
      passengerName: delivery.passengerName,
      resolved: safe === "yes",
      rating: avg,
      comments:
        `Overall ${overall}★ · Professionalism ${prof}★ · Time ${time}★ · Safe: ${safe} · Recommend: ${recommend}` +
        (comments ? ` — ${comments}` : ""),
    });
    toast.success("Thank you for your feedback");
    onSubmit();
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-7">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          Customer Satisfaction
        </p>
        <h2 className="text-xl sm:text-2xl font-bold mt-1">How was your delivery?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your feedback helps IAB improve the service.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-5">
          <RatingRow label="Overall Service" value={overall} onChange={setOverall} />
          <RatingRow
            label="Delivery Professionalism"
            value={prof}
            onChange={setProf}
          />
          <RatingRow label="Delivery Time" value={time} onChange={setTime} />

          <YesNoRow
            label="Was your baggage delivered safely?"
            value={safe}
            onChange={setSafe}
          />
          <YesNoRow
            label="Would you recommend IAB?"
            value={recommend}
            onChange={setRecommend}
          />

          <div>
            <label className="text-sm font-medium">Comments</label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Share anything you'd like the team to know..."
              className="mt-1"
              rows={4}
              maxLength={500}
            />
          </div>

          <Button type="submit" size="lg" className="w-full h-12">
            Submit Feedback
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-1"
            aria-label={`${n} star`}
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                n <= value
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function YesNoRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "yes" | "no";
  onChange: (v: "yes" | "no") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm font-medium">{label}</p>
      <div className="inline-flex rounded-lg border border-border overflow-hidden">
        {(["yes", "no"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              value === v
                ? "bg-primary text-primary-foreground"
                : "bg-white text-foreground hover:bg-muted",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function DoneStage({ delivery }: { delivery: Delivery }) {
  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardContent className="p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-500 text-white grid place-items-center mx-auto shadow-lg">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-2xl font-bold">Thank You</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Your baggage delivery has been completed successfully.
          <br />
          Your case is now closed.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground bg-white/80 border border-border rounded-full px-3 py-1">
          <span className="font-mono">{delivery.deliveryId}</span>
          <span>·</span>
          <span>{delivery.passengerName}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PortalFooter() {
  return (
    <div className="text-center text-[11px] text-muted-foreground pt-4 pb-2">
      © 2026 IAB · Smart Baggage Delivery · Cairo International Airport
    </div>
  );
}

function EmptyState() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] grid place-items-center p-6">
      <div className="text-center max-w-sm">
        <div className="h-14 w-14 rounded-full bg-muted grid place-items-center mx-auto">
          <Truck className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">No active delivery</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your delivery link will open here once IAB dispatches your baggage.
        </p>
      </div>
    </div>
  );
}
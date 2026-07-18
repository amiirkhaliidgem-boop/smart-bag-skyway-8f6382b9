import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  useStore,
  updateDelivery,
  addFeedback,
  addQualityIncident,
  addCallLog,
  getDeliveryStage,
  type Delivery,
  type BaggageCase,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import {
  CheckCircle2,
  Circle,
  PackageSearch,
  ShieldCheck,
  PackageCheck,
  Truck,
  Sparkles,
  Copy,
  Phone,
  MessageCircle,
  Mail,
  X,
  AlertTriangle,
  Star,
  Plane,
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

type Screen = "track" | "celebrating" | "feedback" | "thanks";

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

  const [screen, setScreen] = useState<Screen>(
    delivery?.status === "Delivered" ? "feedback" : "track",
  );

  if (!delivery || !kase) {
    return <EmptyState />;
  }

  return (
    <div
      className="-mx-4 -my-4 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8 min-h-[calc(100vh-3.5rem)] font-[family-name:var(--font-sans)] text-[color:var(--iab-ink)]"
      style={{
        background:
          "radial-gradient(1200px 600px at 10% -10%, color-mix(in oklab, #1B2A5B 12%, transparent), transparent 60%), radial-gradient(900px 500px at 110% 10%, color-mix(in oklab, #D6284B 10%, transparent), transparent 60%), var(--iab-ivory)",
      }}
    >
      <BrandHeader />
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {active.length > 1 && !deliveryIdOverride && (
          <DemoSwitcher
            active={active}
            selectedId={delivery.deliveryId}
            onChange={(id) => {
              setSelectedId(id);
              const d = active.find((x) => x.deliveryId === id);
              setScreen(d?.status === "Delivered" ? "feedback" : "track");
            }}
          />
        )}

        {screen === "track" && (
          <TrackScreen
            delivery={delivery}
            kase={kase}
            onConfirmed={() => setScreen("celebrating")}
          />
        )}

        {screen === "celebrating" && (
          <DeliveredCelebration
            passengerName={delivery.passengerName}
            onDone={() => setScreen("feedback")}
          />
        )}

        {screen === "feedback" && (
          <FeedbackScreen
            delivery={delivery}
            onSubmit={() => setScreen("thanks")}
          />
        )}

        {screen === "thanks" && <ThanksScreen delivery={delivery} />}

        <PortalFooter />
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <header className="w-full">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 pt-6 flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-white grid place-items-center overflow-hidden shrink-0 shadow-[0_10px_30px_-12px_rgba(27,42,91,0.35)] ring-1 ring-black/5">
          <img src={iabLogo.url} alt="IAB" className="h-11 w-11 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--iab-navy)]/70 leading-none">
            IAB
          </p>
          <p
            className="text-lg leading-tight mt-1 truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Baggage Concierge
          </p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--iab-navy)]/70">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--iab-crimson)" }}
          />
          Secure
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
    <div className="rounded-2xl border border-dashed border-[color:var(--iab-navy)]/20 bg-white/60 backdrop-blur px-4 py-2.5 flex items-center gap-3 text-xs">
      <span className="uppercase tracking-[0.18em] text-[10px] font-semibold text-[color:var(--iab-navy)]/70">
        Demo passenger
      </span>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="ml-auto bg-transparent font-medium focus:outline-none"
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

// ---------------------------------------------------------------------------
// Track screen
// ---------------------------------------------------------------------------

function TrackScreen({
  delivery,
  kase,
  onConfirmed,
}: {
  delivery: Delivery;
  kase: BaggageCase;
  onConfirmed: () => void;
}) {
  const [tags, setTags] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [otpAfter, setOtpAfter] = useState(false);
  const [noBribe, setNoBribe] = useState(true);
  const [showContact, setShowContact] = useState(false);
  const [reported, setReported] = useState(false);

  const allChecked = tags && sealed && otpAfter && noBribe;
  const stage = getDeliveryStage(delivery);
  const showExpected =
    stage === "Assigned" ||
    stage === "Driver Accepted" ||
    stage === "Collected Bag" ||
    stage === "Out for Delivery";

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

  function confirm() {
    updateDelivery(delivery.deliveryId, {
      status: "Delivered",
      otpStatus: "Verified",
    });
    onConfirmed();
  }

  return (
    <div className="space-y-6 iab-rise">
      <StatusHero delivery={delivery} kase={kase} />
      <SimpleTimeline delivery={delivery} kase={kase} />
      {showExpected && <ExpectedDeliveryCard />}
      <OtpHeroCard
        code={delivery.otpCode}
        tags={tags}
        sealed={sealed}
        otpAfter={otpAfter}
        noBribe={noBribe}
        onTags={setTags}
        onSealed={setSealed}
        onOtpAfter={setOtpAfter}
        onNoBribe={handleNoBribeChange}
        reported={reported}
        allChecked={allChecked}
        onConfirm={confirm}
      />
      <SupportCard onOpen={() => setShowContact(true)} />
      {showContact && (
        <ContactModal delivery={delivery} onClose={() => setShowContact(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bilingual helper — Arabic and English rendered at equal weight.
// ---------------------------------------------------------------------------

function Bi({
  en,
  ar,
  className,
  size = "sm",
}: {
  en: string;
  ar: string;
  className?: string;
  size?: "xs" | "sm" | "base" | "lg";
}) {
  const s = {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
  }[size];
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className={cn(s, "leading-relaxed")}>{en}</p>
      <p
        className={cn(s, "leading-relaxed opacity-80")}
        dir="rtl"
        lang="ar"
        style={{ fontFamily: "var(--font-arabic)" }}
      >
        {ar}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status hero — big navy gradient card with the passenger's name.
// ---------------------------------------------------------------------------

function StatusHero({ delivery, kase }: { delivery: Delivery; kase: BaggageCase }) {
  const stage = getDeliveryStage(delivery);
  const heroCopy = heroCopyForStage(stage);
  const bagTag =
    kase.baggage?.bagTags?.filter(Boolean).join(" · ") ?? kase.bagTagNumber ?? "—";
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-7 sm:p-9 text-white shadow-[0_30px_80px_-30px_rgba(15,24,48,0.55)]"
      style={{ background: "var(--gradient-iab-hero)" }}
    >
      <div
        className="absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--iab-crimson)" }}
      />
      <div className="relative">
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/70">
          Welcome · مرحباً
        </p>
        <h1
          className="mt-2 text-3xl sm:text-4xl leading-[1.05] tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {delivery.passengerName}
        </h1>
        <p
          className="mt-1 text-white/85 text-lg"
          dir="rtl"
          lang="ar"
          style={{ fontFamily: "var(--font-arabic)" }}
        >
          أهلاً بك {delivery.passengerName}
        </p>

        <div className="mt-6">
          <p className="text-white/70 text-sm">{heroCopy.en}</p>
          <p
            className="text-white/80 text-sm mt-0.5"
            dir="rtl"
            lang="ar"
            style={{ fontFamily: "var(--font-arabic)" }}
          >
            {heroCopy.ar}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em]">
          <Chip icon={<Plane className="h-3 w-3" />}>Flight {kase.flightNumber ?? "—"}</Chip>
          <Chip>PIR {delivery.pirNumber}</Chip>
          <Chip>Tag {bagTag}</Chip>
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-white/90 backdrop-blur">
      {icon}
      {children}
    </span>
  );
}

function heroCopyForStage(stage: ReturnType<typeof getDeliveryStage>): {
  en: string;
  ar: string;
} {
  switch (stage) {
    case "Delivered":
      return { en: "Your baggage has arrived. Thank you for flying with IAB.", ar: "لقد وصلت أمتعتك. شكراً لسفرك مع IAB." };
    case "Out for Delivery":
      return { en: "Your baggage is on the way to you.", ar: "أمتعتك في الطريق إليك الآن." };
    case "Collected Bag":
    case "Driver Accepted":
    case "Assigned":
      return { en: "Your baggage is prepared and awaiting dispatch.", ar: "تم تجهيز أمتعتك وستُشحن قريباً." };
    case "Scheduled":
    case "Ready for Delivery":
      return { en: "Your baggage is ready and will be dispatched shortly.", ar: "أمتعتك جاهزة للتسليم قريباً." };
    default:
      return { en: "We are locating your baggage.", ar: "نعمل على تحديد موقع أمتعتك." };
  }
}

// ---------------------------------------------------------------------------
// Simple 5-step timeline — derived from Workflow Engine, not new state.
// ---------------------------------------------------------------------------

function SimpleTimeline({ delivery, kase }: { delivery: Delivery; kase: BaggageCase }) {
  const steps: { en: string; ar: string; reached: boolean; current: boolean }[] =
    passengerSteps(delivery, kase);
  return (
    <div className="iab-glass rounded-3xl p-6 sm:p-7">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="h-4 w-4" style={{ color: "var(--iab-crimson)" }} />
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[color:var(--iab-navy)]">
          Journey · الرحلة
        </p>
      </div>
      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={step.en} className="flex items-start gap-4">
            <div className="relative">
              <div
                className={cn(
                  "h-9 w-9 rounded-full grid place-items-center shrink-0 transition-all",
                  step.reached && !step.current && "text-white",
                  step.current && "text-white iab-pulse-ring",
                  !step.reached && "bg-[color:var(--iab-mist)] text-[color:var(--iab-navy)]/40",
                )}
                style={
                  step.current
                    ? { background: "var(--gradient-iab-crimson)" }
                    : step.reached
                      ? { background: "var(--iab-navy)" }
                      : undefined
                }
              >
                {step.reached && !step.current ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : step.current ? (
                  <PackageSearch className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "absolute left-1/2 top-9 -translate-x-1/2 w-px h-6",
                    step.reached
                      ? "bg-[color:var(--iab-navy)]/30"
                      : "bg-[color:var(--iab-navy)]/10",
                  )}
                />
              )}
            </div>
            <div
              className={cn(
                "flex-1 pt-1",
                !step.reached && "opacity-50",
              )}
            >
              <Bi en={step.en} ar={step.ar} size="sm" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function passengerSteps(delivery: Delivery, kase: BaggageCase) {
  const stage = getDeliveryStage(delivery);
  const lf = kase.lfStatus ?? "Open";
  const definitions = [
    { en: "Bag Located", ar: "تم العثور على الأمتعة" },
    { en: "Customs Cleared", ar: "تم التخليص الجمركي" },
    { en: "Assigned to Delivery", ar: "تم التعيين للتسليم" },
    { en: "Out for Delivery", ar: "في الطريق إليك" },
    { en: "Delivered", ar: "تم التسليم" },
  ];
  // Determine the highest reached index.
  let reached = 0;
  const locatedish = ["Located", "In Transit to Cairo", "Arrived at Cairo"];
  const customs = ["Waiting Customs Clearance"];
  const assignedish: Array<typeof stage> = [
    "Ready for Delivery",
    "Scheduled",
    "Assigned",
    "Driver Accepted",
    "Collected Bag",
  ];
  if (locatedish.includes(lf) || kase.status !== "Missing") reached = 1;
  if (customs.includes(lf)) reached = 2;
  if (assignedish.includes(stage)) reached = 3;
  if (stage === "Out for Delivery") reached = 4;
  if (stage === "Delivered") reached = 5;
  return definitions.map((d, i) => ({
    ...d,
    reached: i < reached,
    current: i === reached - 1 && stage !== "Delivered",
  }));
}

// ---------------------------------------------------------------------------
// Expected Delivery card — no ETA, no map, no driver tracking.
// ---------------------------------------------------------------------------

function ExpectedDeliveryCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 iab-glass">
      <div
        className="absolute -bottom-14 -right-14 h-40 w-40 rounded-full opacity-20 blur-2xl"
        style={{ background: "var(--iab-crimson)" }}
      />
      <div className="relative flex items-start gap-4">
        <div
          className="h-12 w-12 rounded-2xl grid place-items-center shrink-0 iab-float"
          style={{
            background: "var(--gradient-iab-hero)",
            boxShadow: "var(--shadow-iab-glass)",
          }}
        >
          <Truck className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--iab-navy)]/60 font-semibold">
            Expected Delivery · موعد التسليم
          </p>
          <p
            className="mt-1 text-3xl leading-tight text-[color:var(--iab-navy)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Expected Today
          </p>
          <p
            className="text-2xl text-[color:var(--iab-navy)] leading-tight"
            dir="rtl"
            lang="ar"
            style={{ fontFamily: "var(--font-arabic)" }}
          >
            متوقع اليوم
          </p>
          <div className="mt-3">
            <Bi
              en="Our delivery partner will contact you shortly."
              ar="سيتواصل معك مندوب التسليم قريباً."
              size="sm"
              className="text-[color:var(--iab-navy)]/80"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OTP hero + bilingual checklist + confirm CTA — the single focus card.
// ---------------------------------------------------------------------------

function OtpHeroCard({
  code,
  tags,
  sealed,
  otpAfter,
  noBribe,
  onTags,
  onSealed,
  onOtpAfter,
  onNoBribe,
  reported,
  allChecked,
  onConfirm,
}: {
  code: string;
  tags: boolean;
  sealed: boolean;
  otpAfter: boolean;
  noBribe: boolean;
  onTags: (v: boolean) => void;
  onSealed: (v: boolean) => void;
  onOtpAfter: (v: boolean) => void;
  onNoBribe: (v: boolean) => void;
  reported: boolean;
  allChecked: boolean;
  onConfirm: () => void;
}) {
  const digits = (code ?? "").padEnd(4, "•").slice(0, 4).split("");
  function copyCode() {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(
      () => toast.success("Code copied · تم نسخ الرمز"),
      () => toast.error("Copy failed"),
    );
  }
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white"
      style={{
        background: "var(--gradient-iab-hero)",
        boxShadow: "0 40px 80px -30px rgba(15,24,48,0.55)",
      }}
    >
      <div
        className="absolute -top-20 -left-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--iab-crimson)" }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/70">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verification · رمز التحقق
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 sm:gap-3">
          {digits.map((d, i) => (
            <div
              key={i}
              className="h-16 w-14 sm:h-20 sm:w-16 rounded-2xl grid place-items-center bg-white/10 border border-white/15 backdrop-blur"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)" }}
            >
              <span
                className="text-4xl sm:text-5xl tabular-nums text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {d}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 active:scale-[0.98] transition px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/85"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>

        <div className="mt-5 text-center">
          <Bi
            en="Show this code to the driver only after you receive your baggage."
            ar="أظهر هذا الرمز للسائق فقط بعد استلام أمتعتك."
            size="sm"
            className="text-white/85"
          />
        </div>

        <div className="mt-6 rounded-2xl bg-white/6 border border-white/10 p-3 sm:p-4 backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/70 mb-3">
            Confirm before receiving · تأكيد قبل الاستلام
          </p>
          <div className="space-y-2">
            <BilingualCheck
              checked={tags}
              onChange={onTags}
              en="I verified my baggage tag numbers."
              ar="لقد تحققت من أرقام بطاقات الأمتعة."
            />
            <BilingualCheck
              checked={sealed}
              onChange={onSealed}
              en="I confirmed the baggage is sealed and in good condition."
              ar="أؤكد أن الأمتعة مختومة وبحالة جيدة."
            />
            <BilingualCheck
              checked={otpAfter}
              onChange={onOtpAfter}
              en="I will provide the OTP only after receiving my baggage."
              ar="لن أشارك رمز التحقق إلا بعد استلام الأمتعة."
            />
            <BilingualCheck
              checked={noBribe}
              onChange={onNoBribe}
              en="No employee requested money, tips, or unofficial payment."
              ar="أؤكد أنني لم أتعرض لأي طلب أموال أو إكراميات أو أي مدفوعات غير رسمية."
            />
          </div>

          {reported && (
            <div
              className="mt-3 rounded-xl border p-3 flex gap-2"
              style={{
                background: "color-mix(in oklab, #D6284B 15%, transparent)",
                borderColor: "color-mix(in oklab, #D6284B 45%, transparent)",
              }}
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-white" />
              <Bi
                en="A high-priority incident has been opened. An IAB representative will contact you shortly."
                ar="تم فتح بلاغ عالي الأولوية. سيتواصل معك ممثل IAB قريباً."
                size="xs"
                className="text-white"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!allChecked}
          onClick={onConfirm}
          className={cn(
            "mt-6 w-full h-14 rounded-2xl font-semibold text-base transition-all",
            "flex items-center justify-center gap-2",
            allChecked
              ? "bg-white text-[color:var(--iab-navy)] hover:brightness-105 active:scale-[0.99] shadow-[0_18px_40px_-12px_rgba(255,255,255,0.45)]"
              : "bg-white/10 text-white/50 cursor-not-allowed",
          )}
        >
          <PackageCheck className="h-5 w-5" />
          Confirm Baggage Received · تأكيد استلام الأمتعة
        </button>
        {!allChecked && (
          <p className="mt-2 text-center text-[11px] text-white/60">
            Please tick every confirmation above · يرجى تأكيد جميع البنود بالأعلى
          </p>
        )}
      </div>
    </div>
  );
}

function BilingualCheck({
  checked,
  onChange,
  en,
  ar,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  en: string;
  ar: string;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-xl p-3 cursor-pointer transition-colors",
        "bg-white/5 hover:bg-white/10 border border-white/10",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5 border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-[color:var(--iab-navy)]"
      />
      <Bi en={en} ar={ar} size="sm" className="text-white" />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Support card (contact channels)
// ---------------------------------------------------------------------------

function SupportCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left iab-glass rounded-3xl p-5 flex items-center gap-4 hover:brightness-[0.99] transition"
    >
      <div
        className="h-11 w-11 rounded-2xl grid place-items-center text-white shrink-0"
        style={{ background: "var(--gradient-iab-crimson)" }}
      >
        <MessageCircle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[color:var(--iab-navy)]">
          Need help? · هل تحتاج للمساعدة؟
        </p>
        <p className="text-xs text-[color:var(--iab-navy)]/60 mt-0.5">
          IAB Customer Care · +20 2 2696 0000
        </p>
      </div>
      <span className="text-[color:var(--iab-navy)]/50 text-xs">›</span>
    </button>
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
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "color-mix(in oklab, #0F1830 60%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl iab-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--iab-mist)]">
          <div>
            <p className="font-semibold text-[color:var(--iab-navy)]">Contact Us · تواصل معنا</p>
            <p className="text-xs text-[color:var(--iab-navy)]/60">
              Reference {delivery.deliveryId} · IAB Customer Care
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[color:var(--iab-mist)]"
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
              className="flex items-center gap-3 rounded-2xl border border-[color:var(--iab-mist)] p-3 hover:bg-[color:var(--iab-mist)]/50 transition-colors"
            >
              <div
                className="h-10 w-10 rounded-full grid place-items-center text-white"
                style={{ background: "var(--gradient-iab-crimson)" }}
              >
                <o.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[color:var(--iab-navy)]">{o.label}</p>
                <p className="text-xs text-[color:var(--iab-navy)]/60 truncate">{o.value}</p>
              </div>
            </a>
          ))}
          <p className="text-[11px] text-[color:var(--iab-navy)]/60 pt-2 text-center">
            For your safety, IAB does not enable direct driver communication.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delivered celebration — 1.6s success screen then auto-advance to feedback.
// ---------------------------------------------------------------------------

function DeliveredCelebration({
  passengerName,
  onDone,
}: {
  passengerName: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="min-h-[70vh] grid place-items-center iab-rise">
      <div className="text-center max-w-md">
        <div className="mx-auto h-24 w-24 rounded-3xl bg-white grid place-items-center shadow-[0_30px_60px_-20px_rgba(27,42,91,0.35)] overflow-hidden">
          <img src={iabLogo.url} alt="IAB" className="h-20 w-20 object-contain" />
        </div>
        <div
          className="mx-auto mt-6 h-20 w-20 rounded-full grid place-items-center text-white"
          style={{ background: "var(--gradient-iab-crimson)", boxShadow: "var(--shadow-iab-crimson)" }}
        >
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
            <path
              d="M10 22 L18 30 L32 14"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="60"
              style={{ animation: "iab-check-draw 700ms ease-out forwards" }}
            />
          </svg>
        </div>
        <h2
          className="mt-6 text-3xl text-[color:var(--iab-navy)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Delivered
        </h2>
        <p
          className="text-2xl mt-1 text-[color:var(--iab-navy)]"
          dir="rtl"
          lang="ar"
          style={{ fontFamily: "var(--font-arabic)" }}
        >
          تم التسليم
        </p>
        <p className="mt-3 text-sm text-[color:var(--iab-navy)]/70">
          Thank you, {passengerName}.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback screen — luxury rating form.
// ---------------------------------------------------------------------------

function FeedbackScreen({
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
    onSubmit();
  }

  return (
    <div className="iab-glass rounded-3xl p-6 sm:p-8 iab-rise">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-white grid place-items-center overflow-hidden ring-1 ring-black/5">
          <img src={iabLogo.url} alt="IAB" className="h-10 w-10 object-contain" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--iab-navy)]/60 font-semibold">
            Feedback · تقييم
          </p>
          <h2
            className="text-2xl text-[color:var(--iab-navy)] leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            How was your delivery?
          </h2>
        </div>
      </div>
      <p
        className="mt-2 text-lg text-[color:var(--iab-navy)]/80"
        dir="rtl"
        lang="ar"
        style={{ fontFamily: "var(--font-arabic)" }}
      >
        كيف كانت تجربتك؟
      </p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <RatingRow label="Overall Service" ar="التقييم العام" value={overall} onChange={setOverall} />
        <RatingRow label="Delivery Professionalism" ar="احترافية التسليم" value={prof} onChange={setProf} />
        <RatingRow label="Delivery Time" ar="وقت التسليم" value={time} onChange={setTime} />

        <YesNoRow
          en="Was your baggage delivered safely?"
          ar="هل تم تسليم أمتعتك بأمان؟"
          value={safe}
          onChange={setSafe}
        />
        <YesNoRow
          en="Would you recommend IAB?"
          ar="هل توصي بخدمات IAB؟"
          value={recommend}
          onChange={setRecommend}
        />

        <div>
          <label className="text-sm font-medium text-[color:var(--iab-navy)]">
            Comments · ملاحظات
          </label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Share anything you'd like the team to know…"
            className="mt-2 rounded-2xl border-[color:var(--iab-mist)] bg-white/70 min-h-24"
            rows={4}
            maxLength={500}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full h-14 rounded-2xl text-base"
          style={{
            background: "var(--gradient-iab-hero)",
            boxShadow: "var(--shadow-iab-glass)",
          }}
        >
          Submit Feedback · إرسال التقييم
        </Button>
      </form>
    </div>
  );
}

function RatingRow({
  label,
  ar,
  value,
  onChange,
}: {
  label: string;
  ar: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-[color:var(--iab-navy)]">{label}</p>
        <p
          className="text-sm text-[color:var(--iab-navy)]/70"
          dir="rtl"
          lang="ar"
          style={{ fontFamily: "var(--font-arabic)" }}
        >
          {ar}
        </p>
      </div>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-1.5 active:scale-90 transition-transform"
            aria-label={`${n} star`}
          >
            <Star
              className={cn(
                "h-8 w-8 transition-all duration-200",
                n <= value
                  ? "fill-[color:var(--iab-crimson)] text-[color:var(--iab-crimson)] drop-shadow-[0_4px_10px_rgba(214,40,75,0.35)]"
                  : "text-[color:var(--iab-navy)]/25",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function YesNoRow({
  en,
  ar,
  value,
  onChange,
}: {
  en: string;
  ar: string;
  value: "yes" | "no";
  onChange: (v: "yes" | "no") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <Bi en={en} ar={ar} size="sm" className="text-[color:var(--iab-navy)]" />
      <div className="inline-flex rounded-full border border-[color:var(--iab-mist)] bg-white/70 p-1">
        {(["yes", "no"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium capitalize rounded-full transition-all",
              value === v
                ? "text-white shadow-sm"
                : "text-[color:var(--iab-navy)]/70 hover:text-[color:var(--iab-navy)]",
            )}
            style={
              value === v
                ? { background: "var(--gradient-iab-hero)" }
                : undefined
            }
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThanksScreen({ delivery }: { delivery: Delivery }) {
  return (
    <div className="min-h-[60vh] grid place-items-center iab-rise">
      <div className="text-center max-w-md">
        <div className="mx-auto h-24 w-24 rounded-3xl bg-white grid place-items-center shadow-[0_30px_60px_-20px_rgba(27,42,91,0.35)] overflow-hidden">
          <img src={iabLogo.url} alt="IAB" className="h-20 w-20 object-contain" />
        </div>
        <h2
          className="mt-6 text-4xl text-[color:var(--iab-navy)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Thank you
        </h2>
        <p
          className="text-3xl mt-1 text-[color:var(--iab-navy)]"
          dir="rtl"
          lang="ar"
          style={{ fontFamily: "var(--font-arabic)" }}
        >
          شكراً لك
        </p>
        <p className="mt-4 text-sm text-[color:var(--iab-navy)]/70 max-w-sm mx-auto">
          Your feedback helps IAB deliver a better experience for every passenger.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs text-[color:var(--iab-navy)]/70 bg-white/70 border border-[color:var(--iab-mist)] rounded-full px-3 py-1">
          <span className="font-mono">{delivery.deliveryId}</span>
          <span>·</span>
          <span>{delivery.passengerName}</span>
        </div>
      </div>
    </div>
  );
}

function PortalFooter() {
  return (
    <div className="text-center text-[11px] text-[color:var(--iab-navy)]/60 pt-6 pb-4 tracking-wide">
      © 2026 IAB · Baggage Concierge
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] grid place-items-center p-6 -mx-4 -my-4 sm:-mx-6 sm:-my-6"
      style={{ background: "var(--iab-ivory)" }}
    >
      <div className="text-center max-w-sm">
        <div className="h-16 w-16 rounded-2xl bg-white grid place-items-center mx-auto overflow-hidden shadow-sm">
          <img src={iabLogo.url} alt="IAB" className="h-14 w-14 object-contain" />
        </div>
        <h2
          className="mt-5 text-2xl text-[color:var(--iab-navy)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          No active delivery
        </h2>
        <p className="text-sm text-[color:var(--iab-navy)]/60 mt-2">
          Your delivery link will open here once IAB dispatches your baggage.
        </p>
      </div>
    </div>
  );
}
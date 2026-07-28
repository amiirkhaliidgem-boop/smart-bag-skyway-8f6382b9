import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  useStore,
  getDeliveryStage,
  type Delivery,
  type BaggageCase,
} from "@/lib/store";
import { mutatePassengerView } from "@/lib/passenger.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import suitcaseImg from "@/assets/passenger-suitcase.png";
import {
  CheckCircle2,
  Circle,
  PackageSearch,
  ShieldCheck,
  PackageCheck,
  Truck,
  Sparkles,
  PhoneCall,
  MessageCircle,
  Mail,
  AlertTriangle,
  Star,
  ChevronRight,
  MapPin,
  Headphones,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/passenger/")({
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
  token,
  resolvedDelivery,
  resolvedCase,
}: {
  deliveryIdOverride?: string;
  token?: string;
  resolvedDelivery?: Delivery;
  resolvedCase?: BaggageCase;
} = {}) {
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

  const selectedId =
    deliveryIdOverride ??
    active.find((d) => d.status === "Out For Delivery")?.deliveryId ??
    active[0]?.deliveryId ??
    "";

  // A token-scoped portal must render only the server-resolved pair. It must
  // never substitute the first staff delivery when a record is unavailable.
  const delivery = resolvedDelivery ?? active.find((d) => d.deliveryId === selectedId);
  const kase = resolvedCase ?? (delivery ? cases.find((c) => c.bagId === delivery.bagId) : undefined);

  const [screen, setScreen] = useState<Screen>(
    delivery?.status === "Delivered" ? "feedback" : "track",
  );

  if (!delivery || !kase) {
    return <EmptyState />;
  }

  return (
    <div
      className="iab-grain relative -mx-4 sm:-mx-6 lg:-mx-8 min-h-[calc(100vh-3.5rem)] font-[family-name:var(--font-sans)] text-[color:var(--iab-ink)]"
      style={{
        ["--font-display" as any]:
          '"General Sans", "Fraunces", ui-serif, Georgia, serif',
        ["--font-heading" as any]:
          '"Manrope", "Inter", ui-sans-serif, system-ui, sans-serif',
        ["--font-sans" as any]:
          '"Manrope", "Inter", ui-sans-serif, system-ui, sans-serif',
        ["--font-arabic" as any]:
          '"IBM Plex Sans Arabic", system-ui, sans-serif',
        ["--font-arabic-display" as any]:
          '"IBM Plex Sans Arabic", system-ui, sans-serif',
        ["--font-passenger-display" as any]:
          '"General Sans", "Fraunces", ui-serif, Georgia, serif',
        ["--font-passenger-ui" as any]:
          '"Manrope", "Inter", ui-sans-serif, system-ui, sans-serif',
        ["--iab-gold" as any]: "#C9A84C",
        ["--iab-navy-card" as any]: "#081C3A",
        background: "#FFFFFF",
      }}
    >
      <BrandHeader />
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {screen === "track" && (
          <TrackScreen
            delivery={delivery}
            kase={kase}
            token={token}
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
            token={token}
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
    <header className="w-full bg-white">
      <div className="relative mx-auto w-full max-w-2xl px-4 sm:px-6 py-4 flex items-center gap-4">
        <img
          src={iabLogo.url}
          alt="IAB"
          className="h-[60px] w-[60px] object-contain shrink-0"
          style={{ height: 60, width: 60 }}
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-[17px] sm:text-[18px] font-medium leading-tight text-[color:var(--iab-navy)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            IAB Baggage Delivery Service
          </p>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Track screen
// ---------------------------------------------------------------------------

function TrackScreen({
  delivery,
  kase,
  token,
  onConfirmed,
}: {
  delivery: Delivery;
  kase: BaggageCase;
  token?: string;
  onConfirmed: () => void;
}) {
  const [tags, setTags] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [otpAfter, setOtpAfter] = useState(false);
  const [noBribe, setNoBribe] = useState(true);
  const [reported, setReported] = useState(false);
  const mutatePassenger = useServerFn(mutatePassengerView);

  const allChecked = tags && sealed && otpAfter && noBribe;
  const stage = getDeliveryStage(delivery);
  // OTP card stays hidden until the workflow reaches Out for Delivery, then
  // remains visible through completion.
  const showOtpCard =
    stage === "Out for Delivery" ||
    stage === "Delivered" ||
    stage === "Delivery Failed";

  async function handleNoBribeChange(next: boolean) {
    setNoBribe(next);
    if (!next && !reported) {
      if (token) {
        await mutatePassenger({ data: { token, action: "report-misconduct" } });
      }
      setReported(true);
      toast.error(
        "High priority incident created. Contact Center Supervisor notified.",
      );
    }
  }

  async function confirm() {
    if (token) {
      await mutatePassenger({ data: { token, action: "confirm-delivery" } });
    }
    onConfirmed();
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
      }}
      className="space-y-4 sm:space-y-5"
    >
      <MotionSection>
        <WelcomeCard delivery={delivery} kase={kase} />
      </MotionSection>
      <MotionSection>
        <StatusHero delivery={delivery} kase={kase} />
      </MotionSection>
      <MotionSection>
        <SimpleTimeline delivery={delivery} kase={kase} />
      </MotionSection>
      {showOtpCard && (
        <MotionSection>
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
        </MotionSection>
      )}
      <MotionSection>
        <ContactCard delivery={delivery} />
      </MotionSection>
    </motion.div>
  );
}

function MotionSection({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] },
        },
      }}
    >
      {children}
    </motion.div>
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
// Welcome card — the emotional entrance: greeting, name, elegant pills.
// ---------------------------------------------------------------------------

function WelcomeCard({ delivery, kase }: { delivery: Delivery; kase: BaggageCase }) {
  const bagTag =
    kase.baggage?.bagTags?.filter(Boolean).join(" · ") ??
    kase.bagTagNumber ??
    "—";
  const ease = [0.2, 0.7, 0.2, 1] as const;
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease, delay },
  });
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease }}
      aria-label="Welcome"
      className="iab-white-glass rounded-[32px] px-6 py-7 sm:px-10 sm:py-9"
    >
      <motion.p
        {...rise(0.05)}
        className="text-[color:var(--iab-navy)]/70"
        style={{
          fontFamily: "var(--font-passenger-display)",
          fontSize: "clamp(1rem, 2.4vw, 1.25rem)",
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: "0.01em",
        }}
      >
        Welcome
      </motion.p>
      <motion.h1
        {...rise(0.1)}
        className="text-[color:var(--iab-navy)]"
        style={{
          fontFamily: "var(--font-passenger-display)",
          fontOpticalSizing: "auto",
          fontVariationSettings: '"opsz" 144, "SOFT" 40',
          fontSize: "clamp(1.85rem, 5.5vw, 2.75rem)",
          fontWeight: 400,
          lineHeight: 1.05,
          letterSpacing: "-0.015em",
        }}
      >
        {delivery.passengerName}
      </motion.h1>

      <motion.div {...rise(0.2)} className="mt-4 space-y-1">
        <p
          className="text-[color:var(--iab-navy)]/75"
          style={{
            fontFamily: "var(--font-passenger-display)",
            fontWeight: 400,
            fontSize: "clamp(1.05rem, 2.6vw, 1.35rem)",
            lineHeight: 1.35,
            letterSpacing: "0.005em",
          }}
        >
          Your baggage is safely with the IAB Baggage Team.
        </p>
        <p
          dir="rtl"
          lang="ar"
          className="text-[color:var(--iab-navy)]/70"
          style={{
            fontFamily: "var(--font-arabic)",
            fontWeight: 400,
            fontSize: "clamp(0.95rem, 2.3vw, 1.2rem)",
            lineHeight: 1.45,
          }}
        >
          امتعتك بأمان بعهدة فريق IAB.
        </p>
      </motion.div>

      <motion.div {...rise(0.3)} className="mt-6">
        <div
          className="h-px w-full"
          style={{ background: "color-mix(in oklab, #0B1B3B 12%, transparent)" }}
        />
        <dl
          className="mt-4 grid grid-cols-3 gap-4 text-[color:var(--iab-navy)]/70"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <MetaCell label="Flight" value={kase.flightNumber ?? "—"} />
          <MetaCell label="PIR" value={delivery.pirNumber} />
          <MetaCell label="Bag Tag" value={bagTag} />
        </dl>
      </motion.div>
    </motion.section>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt
        className="text-[9.5px] uppercase font-semibold text-[color:var(--iab-navy)]/55"
        style={{ letterSpacing: "0.24em" }}
      >
        {label}
      </dt>
      <dd
        className="mt-1 truncate text-[13px] font-medium text-[color:var(--iab-navy)]"
        style={{ letterSpacing: "0.02em" }}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status hero — navy gradient card with 3D floating suitcase.
// ---------------------------------------------------------------------------

function StatusHero({ delivery, kase }: { delivery: Delivery; kase: BaggageCase }) {
  const stage = getDeliveryStage(delivery);
  const heroCopy = heroCopyForStage(stage);
  const reduce = useReducedMotion();
  void kase;
  const delivered = stage === "Delivered";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      className="iab-grain relative overflow-hidden rounded-[32px] px-6 py-8 sm:px-10 sm:py-10 text-white"
      style={{
        background:
          "linear-gradient(180deg, #0E2C5C 0%, #0A2248 55%, #06142E 100%)",
        boxShadow:
          "0 20px 50px -30px rgba(8,28,58,0.45), 0 8px 20px -14px rgba(8,28,58,0.18)",
      }}

    >
      {/* Gold hairline top border */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, #C9A84C 70%, transparent), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(120% 60% at 0% 0%, rgba(255,255,255,0.14), transparent 55%)",
        }}
      />
      <MapPin
        className="absolute top-5 right-5 h-5 w-5 text-white/60"
        strokeWidth={1.5}
      />

      <div className="relative grid grid-cols-[1fr_auto] gap-4 items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                !reduce && !delivered && "iab-pulse-ring",
              )}
              style={{
                background: delivered
                  ? "var(--iab-emerald)"
                  : "var(--iab-gold, #C9A84C)",
              }}
            />
            <p
              className="text-[10px] uppercase tracking-[0.28em] text-white/70 font-medium"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Current Status
            </p>
          </div>
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.55 }}
            className="mt-3 text-white leading-[1.02]"
            style={{
              fontFamily: "var(--font-display)",
              fontVariationSettings: '"opsz" 96',
              fontSize: "clamp(1.9rem, 7.2vw, 3rem)",
              fontWeight: 400,
              letterSpacing: "-0.01em",
            }}
          >
            {heroCopy.en}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="mt-2 text-white/90 leading-tight text-center"
            dir="rtl"
            lang="ar"
            style={{
              fontFamily: "var(--font-arabic-display)",
              fontSize: "clamp(1.35rem, 5.4vw, 2rem)",
              fontWeight: 500,
            }}
          >
            {heroCopy.ar}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className={cn(
            "relative shrink-0 w-36 sm:w-56 md:w-60 aspect-square",
            !reduce && "iab-float",
          )}
        >
          <div
            className="absolute inset-x-6 bottom-1 h-3 rounded-full blur-lg opacity-60"
            style={{
              background:
                "radial-gradient(closest-side, rgba(0,0,0,0.55), transparent)",
            }}
          />
          <img
            src={suitcaseImg}
            alt="Suitcase"
            width={512}
            height={512}
            loading="lazy"
            className="relative h-full w-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.45)]"
          />
        </motion.div>
      </div>

      <div
        className="relative mt-8 pt-5 flex items-center gap-6"
        style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
      >
        {delivered ? (
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.22em] text-white"
              style={{
                background: "var(--iab-emerald)",
                fontFamily: "var(--font-heading)",
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Delivered · تم التسليم
            </span>
          </div>
        ) : (
          <>
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.28em] text-white/60"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Expected
              </p>
              <p
                className="mt-1 text-white leading-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.4rem",
                  fontWeight: 400,
                }}
              >
                Today
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function heroCopyForStage(stage: ReturnType<typeof getDeliveryStage>): {
  en: string;
  ar: string;
} {
  switch (stage) {
    case "Delivered":
      return { en: "Delivered", ar: "تم التسليم" };
    case "Out for Delivery":
      return { en: "Out for Delivery", ar: "في الطريق إليك" };
    case "Collected Bag":
    case "Driver Accepted":
    case "Assigned":
      return { en: "Assigned to Delivery", ar: "تم التعيين للتسليم" };
    case "Scheduled":
    case "Ready for Delivery":
      return { en: "Ready for Dispatch", ar: "جاهزة للإرسال" };
    default:
      return { en: "Locating Your Baggage", ar: "جارٍ تحديد موقع أمتعتك" };
  }
}

// ---------------------------------------------------------------------------
// Simple 5-step timeline — derived from Workflow Engine, not new state.
// ---------------------------------------------------------------------------

function SimpleTimeline({ delivery, kase }: { delivery: Delivery; kase: BaggageCase }) {
  const steps: { en: string; ar: string; reached: boolean; current: boolean }[] =
    passengerSteps(delivery, kase);
  const reduce = useReducedMotion();
  const delivered = steps[steps.length - 1]?.reached;
  return (
    <div
      className="iab-white-glass rounded-[28px] pt-5 pb-7 px-7 sm:pt-6 sm:pb-9 sm:px-9"
    >
      <ol className="relative">
        {steps.map((step, i) => (
          <li
            key={step.en}
            className="relative flex items-start gap-6 pb-7 last:pb-0"
          >
            {/* Rail */}
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "absolute left-[5px] top-3 w-px h-full",
                )}
                style={{
                  background: step.reached
                    ? "color-mix(in oklab, #081C3A 40%, transparent)"
                    : "color-mix(in oklab, #081C3A 12%, transparent)",
                }}
              />
            )}
            {/* Dot */}
            <div
              className={cn(
                "relative mt-1.5 h-3 w-3 rounded-full shrink-0 transition-all",
                step.current && !reduce && "iab-pulse-ring",
              )}
              style={{
                background: step.reached
                  ? delivered && i === steps.length - 1
                    ? "var(--iab-emerald)"
                    : "var(--iab-navy)"
                  : "transparent",
                border: step.reached
                  ? "none"
                  : "1.5px solid var(--iab-platinum)",
              }}
            />
            <div className={cn("flex-1", !step.reached && "opacity-55")}>
              <p
                className="text-[color:var(--iab-navy)] leading-tight"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "0.95rem",
                  fontWeight: step.current ? 600 : 500,
                }}
              >
                {step.en}
              </p>
              <p
                className="text-[color:var(--iab-navy)]/85 leading-tight mt-0.5"
                dir="rtl"
                lang="ar"
                style={{
                  fontFamily: "var(--font-arabic-display)",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                }}
              >
                {step.ar}
              </p>
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
  const locatedish = ["Located", "Arrived at Airport"];
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
        style={{ background: "var(--iab-navy)" }}
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
  return (
    <div
      className="iab-grain relative overflow-hidden rounded-[32px] px-6 py-8 sm:px-10 sm:py-10 text-white"
      style={{
        background:
          "linear-gradient(180deg, #0E2C5C 0%, #0A2248 55%, #06142E 100%)",
        boxShadow:
          "0 20px 50px -30px rgba(8,28,58,0.45), 0 8px 20px -14px rgba(8,28,58,0.18)",
      }}

    >
      {/* Gold hairline top border */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, #C9A84C 70%, transparent), transparent)",
        }}
      />
      {/* Soft light wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(120% 60% at 0% 0%, rgba(255,255,255,0.14), transparent 55%)",
        }}
      />
      <div className="relative">
        <div
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/70 font-medium"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
          Verification · رمز التحقق
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 sm:gap-3">
          {digits.map((d, i) => (
            <div
              key={i}
              className="h-16 w-14 sm:h-20 sm:w-16 rounded-2xl grid place-items-center bg-white/[0.06] border border-white/10 backdrop-blur"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)" }}
            >
              <span
                className="text-4xl sm:text-5xl tabular-nums text-white"
                style={{
                  fontFamily: "var(--font-passenger-display)",
                  fontWeight: 300,
                  letterSpacing: "0.02em",
                }}
              >
                {d}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 text-center">
          <Bi
            en="Show this code to the delivery agent only after you receive your baggage."
            ar="أظهر هذا الرمز لمندوب التسليم فقط بعد استلام أمتعتك."
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
                background: "color-mix(in oklab, #C9A84C 12%, transparent)",
                borderColor: "color-mix(in oklab, #C9A84C 40%, transparent)",
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
            "flex items-center justify-center gap-2 whitespace-nowrap text-center",
            allChecked
              ? "bg-white text-[color:var(--iab-navy)] active:scale-[0.99]"
              : "bg-white/10 text-white/50 cursor-not-allowed",
          )}
        >
          <PackageCheck className="h-5 w-5 shrink-0" />
          <span className="whitespace-nowrap">Baggage Received • تم الاستلام</span>
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
// Contact card — three premium action tiles (Call · WhatsApp · Email)
// ---------------------------------------------------------------------------

function ContactCard({ delivery }: { delivery: Delivery }) {
  const waMessage = encodeURIComponent(
    `Hello IAB Support, I need assistance with delivery ${delivery.deliveryId} (PIR ${delivery.pirNumber}).`,
  );
  const mailSubject = encodeURIComponent(
    `PIR ${delivery.pirNumber} — Support request`,
  );
  const tiles = [
    {
      icon: PhoneCall,
      en: "Call Us",
      ar: "اتصل بنا",
      href: "tel:+20226960000",
      value: "+20 2 2696 0000",
    },
    {
      icon: MessageCircle,
      en: "WhatsApp",
      ar: "واتساب",
      href: `https://wa.me/201000001234?text=${waMessage}`,
      value: "+20 100 000 1234",
    },
    {
      icon: Mail,
      en: "Email",
      ar: "البريد",
      href: `mailto:support@iab.aero?subject=${mailSubject}`,
      value: "support@iab.aero",
    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
      className="space-y-3"
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((t, i) => (
          <motion.a
            key={t.en}
            href={t.href}
            target={t.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            className="iab-white-glass iab-ripple group relative rounded-3xl p-4 sm:p-5 flex flex-col items-center text-center gap-2 overflow-hidden"
            onPointerDown={(e) => {
              const target = e.currentTarget;
              const rect = target.getBoundingClientRect();
              target.style.setProperty(
                "--x",
                `${((e.clientX - rect.left) / rect.width) * 100}%`,
              );
              target.style.setProperty(
                "--y",
                `${((e.clientY - rect.top) / rect.height) * 100}%`,
              );
            }}
          >
            <div
              className="h-11 w-11 rounded-2xl grid place-items-center text-white shrink-0 transition-transform group-hover:scale-105"
              style={{
                background:
                  "linear-gradient(180deg, #0B2247 0%, #081C3A 55%, #050F24 100%)",
              }}
            >
              <t.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[color:var(--iab-navy)] leading-tight">
                {t.en}
              </p>
              <p
                className="text-[13px] text-[color:var(--iab-navy)]/75 leading-tight"
                dir="rtl"
                lang="ar"
                style={{ fontFamily: "var(--font-arabic)" }}
              >
                {t.ar}
              </p>
            </div>
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"
              style={{ background: "var(--iab-navy)" }}
            />
          </motion.a>
        ))}
      </div>
      <p className="text-[11px] text-[color:var(--iab-navy)]/55 text-center pt-1">
        For your safety, IAB does not enable direct delivery agent communication.
      </p>
    </motion.div>
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
          style={{
            background: "var(--iab-emerald)",
            boxShadow: "var(--shadow-iab-emerald)",
          }}
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
  token,
  onSubmit,
}: {
  delivery: Delivery;
  token?: string;
  onSubmit: () => void;
}) {
  const [overall, setOverall] = useState(5);
  const [prof, setProf] = useState(5);
  const [time, setTime] = useState(5);
  const [safe, setSafe] = useState<"yes" | "no">("yes");
  const [recommend, setRecommend] = useState<"yes" | "no">("yes");
  const [comments, setComments] = useState("");
  const mutatePassenger = useServerFn(mutatePassengerView);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const avg = Math.round((overall + prof + time) / 3);
    const feedbackComments =
      `Overall ${overall}★ · Professionalism ${prof}★ · Time ${time}★ · Safe: ${safe} · Recommend: ${recommend}` +
      (comments ? ` — ${comments}` : "");
    if (token) {
      await mutatePassenger({
        data: {
          token,
          action: "submit-feedback",
          resolved: safe === "yes",
          rating: avg,
          comments: feedbackComments,
        },
      });
    } else {
      addFeedback({
        bagId: delivery.bagId,
        passengerName: delivery.passengerName,
        resolved: safe === "yes",
        rating: avg,
        comments: feedbackComments,
      });
    }
    onSubmit();
  }

  return (
    <div
      className="iab-grain relative overflow-hidden rounded-[32px] px-6 py-8 sm:px-10 sm:py-10 text-white iab-rise"
      style={{
        background:
          "linear-gradient(180deg, #0E2C5C 0%, #0A2248 55%, #06142E 100%)",
        boxShadow:
          "0 20px 50px -30px rgba(8,28,58,0.45), 0 8px 20px -14px rgba(8,28,58,0.18)",
      }}
    >
      {/* Gold hairline top border */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, #C9A84C 70%, transparent), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(120% 60% at 0% 0%, rgba(255,255,255,0.14), transparent 55%)",
        }}
      />
      <div className="relative">
      <div
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/70 font-medium"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Feedback
      </div>
      <h2
        className="mt-3 text-2xl sm:text-3xl text-white leading-tight"
        style={{ fontFamily: "var(--font-display)" }}
      >
        How was your delivery?
      </h2>
      <p
        className="mt-1 text-base sm:text-lg text-white/80"
        dir="rtl"
        lang="ar"
        style={{ fontFamily: "var(--font-arabic)" }}
      >
        كيف كانت تجربتك؟
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
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
          <label className="text-sm font-medium text-white">
            Comments · ملاحظات
          </label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Share anything you'd like the team to know…"
            className="mt-2 w-full rounded-2xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/50 backdrop-blur min-h-24 focus-visible:ring-white/30"
            rows={4}
            maxLength={500}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full h-14 rounded-2xl text-base bg-white text-[color:var(--iab-navy)] active:scale-[0.99]"
        >
          Submit Feedback · إرسال التقييم
        </Button>
      </form>
      </div>
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{label}</p>
        <p
          className="text-sm text-white/70 truncate"
          dir="rtl"
          lang="ar"
          style={{ fontFamily: "var(--font-arabic)" }}
        >
          {ar}
        </p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-1 sm:p-1.5 active:scale-90 transition-transform"
            aria-label={`${n} star`}
          >
            <Star
              className={cn(
                "h-6 w-6 sm:h-8 sm:w-8 transition-all duration-200",
                n <= value
                  ? "fill-white text-white"
                  : "text-white/30",
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <Bi en={en} ar={ar} size="sm" className="text-white" />
      </div>
      <div className="inline-flex shrink-0 rounded-full border border-white/15 bg-white/[0.06] p-1 backdrop-blur">
        {(["yes", "no"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "px-3 sm:px-4 py-1.5 text-sm font-medium capitalize rounded-full transition-all",
              value === v
                ? "bg-white text-[color:var(--iab-navy)] shadow-sm"
                : "text-white/70 hover:text-white",
            )}
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
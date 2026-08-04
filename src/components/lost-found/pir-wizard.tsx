import { useMemo, useState } from "react";
import {
  addCase,
  editCase,
  type BaggageCase,
  type Priority,
  type DeliveryMethod,
} from "@/lib/store";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useSystemSettings } from "@/lib/settings/use-settings";
import {
  User,
  Plane,
  Luggage,
  Truck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PirWizardMode = "create" | "edit";

type F = {
  firstName: string;
  lastName: string;
  pnr: string;
  mobile: string;
  mobile2: string;
  email: string;
  airline: string;
  flightNumber: string;
  flightDate: string;
  originAirport: string;
  destinationAirport: string;
  pirNumber: string;
  numberOfBags: string;
  bagTags: string[];
  weightKg: string;
  color: string;
  type: string;
  distinctiveMarks: string;
  priority: Priority;
  method: DeliveryMethod;
  fullAddress: string;
  regionId: string;
  station: string;
  department: string;
  internalNotes: string;
  casePriority: Priority;
  createdBy: string;
};

function empty(): F {
  return {
    firstName: "",
    lastName: "",
    pnr: "",
    mobile: "",
    mobile2: "",
    email: "",
    airline: "",
    flightNumber: "",
    flightDate: new Date().toISOString().slice(0, 10),
    originAirport: "",
    destinationAirport: "CAI",
    pirNumber: "",
    numberOfBags: "1",
    bagTags: [""],
    weightKg: "",
    color: "",
    type: "",
    distinctiveMarks: "",
    priority: "Normal",
    method: "Home Delivery",
    fullAddress: "",
    regionId: "",
    station: "CAI - Cairo International Airport",
    department: "Lost & Found",
    internalNotes: "",
    casePriority: "Normal",
    createdBy: "Ops Console",
  };
}

function fromCase(c: BaggageCase): F {
  const p = c.passenger ?? {};
  const fl = c.flight ?? {};
  const b = c.baggage ?? {};
  const d = c.delivery ?? {};
  const i = c.internal ?? {};
  // Best-effort split of legacy passengerName when no structured names exist.
  let firstName = p.firstName ?? "";
  let lastName = p.lastName ?? "";
  if (!firstName && !lastName && c.passengerName) {
    const parts = c.passengerName.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = parts.length > 1 ? parts[parts.length - 1] : "";
  }
  const legacyAddress = [d.building, d.street, d.district, d.city, d.governorate, d.country]
    .filter(Boolean)
    .join(", ");
  const nBags = Number(b.numberOfBags ?? 1) || 1;
  const existingTags =
    b.bagTags && b.bagTags.length > 0 ? b.bagTags : c.bagTagNumber ? [c.bagTagNumber] : [""];
  const bagTags = Array.from({ length: nBags }, (_, idx) => existingTags[idx] ?? "");
  const rawPriority = c.priority ?? "Normal";
  const priority: Priority = rawPriority === "VIP" ? "VIP" : "Normal";
  const rawCasePriority = i.casePriority ?? c.priority ?? "Normal";
  const casePriority: Priority = rawCasePriority === "VIP" ? "VIP" : "Normal";
  return {
    firstName,
    lastName,
    pnr: p.pnr ?? "",
    mobile: c.contact ?? "",
    mobile2: p.mobile2 ?? "",
    email: c.email ?? "",
    airline: fl.airline ?? "",
    flightNumber: c.flightNumber ?? "",
    flightDate: c.arrivalDate ?? new Date().toISOString().slice(0, 10),
    originAirport: fl.originAirport ?? "",
    destinationAirport: fl.destinationAirport ?? "CAI",
    pirNumber: c.pirNumber ?? "",
    numberOfBags: String(nBags),
    bagTags,
    weightKg: b.weightKg ? String(b.weightKg) : "",
    color: b.color ?? "",
    type: b.type ?? "",
    distinctiveMarks: b.distinctiveMarks ?? "",
    priority,
    method: d.method ?? "Home Delivery",
    fullAddress: d.fullAddress ?? legacyAddress,
    regionId: d.regionId ?? "",
    station: i.station ?? "CAI - Cairo International Airport",
    department: i.department ?? "Lost & Found",
    internalNotes: i.internalNotes ?? "",
    casePriority,
    createdBy: i.createdBy ?? "Ops Console",
  };
}

const STEPS = [
  { key: "passenger", label: "Passenger", icon: User },
  { key: "flight", label: "Flight", icon: Plane },
  { key: "baggage", label: "Baggage", icon: Luggage },
  { key: "delivery", label: "Delivery", icon: Truck },
  { key: "review", label: "Review", icon: CheckCircle2 },
] as const;

export function PirWizard({
  mode,
  caseData,
  onClose,
}: {
  mode: PirWizardMode;
  caseData?: BaggageCase;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<F>(() =>
    mode === "edit" && caseData ? fromCase(caseData) : empty(),
  );

  // Delivery regions come from System Settings and drive the Home Delivery SLA.
  const regions = useSystemSettings().settings.regions.filter((r) => r.active);
  const regionLabel = (id: string) => regions.find((r) => r.id === id)?.name ?? "—";

  function RegionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <Fld label="Delivery Region (SLA)">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select region" />
          </SelectTrigger>
          <SelectContent>
            {regions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name} · {r.sla_hours}h
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Fld>
    );
  }

  function set<K extends keyof F>(k: K, v: F[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const canSubmit = useMemo(
    () =>
      form.firstName.trim() &&
      form.lastName.trim() &&
      form.bagTags.length > 0 &&
      form.bagTags.every((t) => t.trim()) &&
      form.flightNumber.trim() &&
      form.mobile.trim() &&
      form.airline.trim() &&
      // Airport Pickup has no delivery address, region, agent or route.
      (form.method === "Airport Pickup" || form.fullAddress.trim()),
    [form],
  );

  function validateStep(i: number): string | null {
    if (i === 0) {
      if (!form.firstName.trim() || !form.lastName.trim())
        return "First and last name are required.";
      if (!form.mobile.trim()) return "Mobile number is required.";
    }
    if (i === 1) {
      if (!form.airline.trim()) return "Airline is required.";
      if (!form.flightNumber.trim()) return "Flight number is required.";
      if (!form.flightDate) return "Flight date is required.";
    }
    if (i === 2) {
      const n = Number(form.numberOfBags);
      if (!Number.isFinite(n) || n < 1) return "Number of bags must be at least 1.";
      if (form.bagTags.length !== n) return "Bag tags must match the number of bags.";
      if (form.bagTags.some((t) => !t.trim())) return "Every bag tag is required.";
    }
    if (i === 3) {
      if (form.method !== "Airport Pickup" && !form.fullAddress.trim())
        return "Full delivery address is required.";
    }
    return null;
  }

  // Sequential-only navigation. Users can step back to any completed step
  // but cannot jump forward without passing validation on every step in
  // between — matches the enterprise PIR intake flow.
  function goToStep(target: number) {
    if (target === step) return;
    if (target < step || mode === "edit") {
      setStep(target);
      return;
    }
    for (let i = step; i < target; i++) {
      const err = validateStep(i);
      if (err) {
        toast.error(err);
        setStep(i);
        return;
      }
    }
    setStep(target);
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  function passengerName(): string {
    return [form.firstName, form.lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
  }
  function description(): string {
    return [form.color, form.type, form.distinctiveMarks].filter(Boolean).join(" — ");
  }

  // Keep bagTags length in sync with numberOfBags.
  function setNumberOfBags(raw: string) {
    const n = Math.max(1, Math.min(50, Math.floor(Number(raw) || 1)));
    setForm((f) => {
      const tags = Array.from({ length: n }, (_, i) => f.bagTags[i] ?? "");
      return { ...f, numberOfBags: String(n), bagTags: tags };
    });
  }
  function setBagTag(index: number, value: string) {
    setForm((f) => {
      const tags = [...f.bagTags];
      tags[index] = value;
      return { ...f, bagTags: tags };
    });
  }

  async function submit() {
    if (!canSubmit) {
      toast.error("Please complete every required field before submitting.");
      return;
    }
    // Guard against a double click issuing two create calls.
    if (submitting) return;
    setSubmitting(true);
    try {
      await runSubmit();
    } finally {
      setSubmitting(false);
    }
  }

  async function runSubmit() {
    const cleanTags = form.bagTags.map((t) => t.trim()).filter(Boolean);
    const commonPatch: Partial<BaggageCase> = {
      passengerName: passengerName(),
      flightNumber: form.flightNumber,
      pirNumber: form.pirNumber,
      bagTagNumber: cleanTags[0] ?? "",
      arrivalDate: form.flightDate,
      contact: form.mobile,
      email: form.email,
      description: description(),
      priority: form.priority,
      passenger: {
        firstName: form.firstName,
        lastName: form.lastName,
        pnr: form.pnr,
        mobile2: form.mobile2,
      },
      flight: {
        airline: form.airline,
        originAirport: form.originAirport,
        destinationAirport: form.destinationAirport,
      },
      baggage: {
        numberOfBags: Number(form.numberOfBags) || 1,
        weightKg: Number(form.weightKg) || undefined,
        color: form.color,
        type: form.type,
        bagTags: cleanTags,
        distinctiveMarks: form.distinctiveMarks,
      },
      delivery: {
        method: form.method,
        // Airport Pickup carries no address or delivery region.
        fullAddress: form.method === "Airport Pickup" ? "" : form.fullAddress.trim(),
        regionId: form.method === "Airport Pickup" ? undefined : form.regionId || undefined,
      },
      internal: {
        station: form.station,
        department: form.department,
        internalNotes: form.internalNotes,
        casePriority: form.casePriority,
        createdBy: form.createdBy,
      },
    };

    if (mode === "edit" && caseData) {
      editCase(caseData.bagId, commonPatch, {
        actor: form.createdBy || "Ops Console",
        note: `Case edited · PIR ${form.pirNumber}`,
      });
      toast.success(`Case ${caseData.pirNumber} updated`);
    } else {
      let created: BaggageCase | null = null;
      try {
        created = await addCase({
          ...(commonPatch as Omit<BaggageCase, "bagId" | "status" | "storage" | "createdAt">),
          documents: [],
          initialLfStatus: "Open",
        });
      } catch (err) {
        // The case was rejected before a BAG number was allocated — the
        // operator can correct the field and retry without burning a number.
        toast.error((err as Error).message || "Case could not be registered");
        return;
      }
      if (created) toast.success(`Case registered · ${created.pirNumber} · ${created.bagId}`);
    }
    onClose();
  }

  return (
    <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0 flex flex-col">
      <DialogHeader className="px-6 pt-5 pb-3 border-b">
        <DialogTitle>
          {mode === "edit" ? `Edit Case · ${caseData?.pirNumber}` : "Register New PIR / AHL Case"}
        </DialogTitle>
        <p className="text-xs text-muted-foreground">
          {mode === "edit"
            ? "Update case details. Workflow status is preserved unless changed via Status Management."
            : "Complete every applicable step. Required fields are marked."}
        </p>
      </DialogHeader>

      {/* Stepper */}
      <div className="flex items-center gap-1 px-6 py-3 border-b overflow-x-auto">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          const locked = mode === "create" && i > step;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => goToStep(i)}
              disabled={locked}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 border text-xs whitespace-nowrap transition-colors",
                active && "bg-primary text-primary-foreground border-primary font-semibold",
                done && "bg-emerald-50 text-emerald-700 border-emerald-200",
                !active && !done && "bg-muted/40 text-muted-foreground border-transparent",
                locked && "opacity-60 cursor-not-allowed",
              )}
              aria-disabled={locked}
              title={locked ? "Complete the previous steps first" : undefined}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold",
                  active && "bg-primary-foreground text-primary",
                  done && "bg-emerald-600 text-white",
                  !active && !done && "bg-muted text-muted-foreground",
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : locked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  i + 1
                )}
              </span>
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {step === 0 && (
          <Grid>
            <Fld label="First Name" required>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </Fld>
            <Fld label="Last Name" required>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </Fld>
            <Fld label="PNR">
              <Input value={form.pnr} onChange={(e) => set("pnr", e.target.value)} />
            </Fld>
            <Fld label="Mobile Number 1" required>
              <Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
            </Fld>
            <Fld label="Mobile Number 2">
              <Input value={form.mobile2} onChange={(e) => set("mobile2", e.target.value)} />
            </Fld>
            <Fld label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Fld>
          </Grid>
        )}

        {step === 1 && (
          <Grid>
            <Fld label="Airline" required>
              <Input
                value={form.airline}
                onChange={(e) => set("airline", e.target.value)}
                placeholder="e.g. MS"
              />
            </Fld>
            <Fld label="Flight Number" required>
              <Input
                value={form.flightNumber}
                onChange={(e) => set("flightNumber", e.target.value)}
              />
            </Fld>
            <Fld label="Flight Date" required>
              <Input
                type="date"
                value={form.flightDate}
                onChange={(e) => set("flightDate", e.target.value)}
              />
            </Fld>
            <Fld label="Origin">
              <Input
                maxLength={3}
                value={form.originAirport}
                onChange={(e) => set("originAirport", e.target.value.toUpperCase())}
                placeholder="e.g. JFK"
              />
            </Fld>
            <Fld label="Destination">
              <Input
                maxLength={3}
                value={form.destinationAirport}
                onChange={(e) => set("destinationAirport", e.target.value.toUpperCase())}
                placeholder="e.g. CAI"
              />
            </Fld>
          </Grid>
        )}

        {step === 2 && (
          <Grid>
            <Fld label="PIR Number">
              <Input
                value={form.pirNumber}
                onChange={(e) => set("pirNumber", e.target.value)}
                placeholder="Optional — a Case ID is generated automatically"
              />
            </Fld>
            <Fld label="Number Of Bags" required>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.numberOfBags}
                onChange={(e) => setNumberOfBags(e.target.value)}
              />
            </Fld>
            <Fld label="Weight (kg)">
              <Input
                type="number"
                step="0.1"
                value={form.weightKg}
                onChange={(e) => set("weightKg", e.target.value)}
              />
            </Fld>
            <Fld label="Priority">
              <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Normal", "VIP"] as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Fld>
            <Fld label="Color">
              <Input value={form.color} onChange={(e) => set("color", e.target.value)} />
            </Fld>
            <Fld label="Type">
              <Input value={form.type} onChange={(e) => set("type", e.target.value)} />
            </Fld>
            <Fld label="Distinctive Marks" wide>
              <Textarea
                rows={2}
                value={form.distinctiveMarks}
                onChange={(e) => set("distinctiveMarks", e.target.value)}
              />
            </Fld>
            <div className="sm:col-span-3 space-y-2 pt-1">
              <Label className="font-semibold">
                Bag Tags <span className="text-rose-500">*</span>
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  One tag per bag — every field is required.
                </span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {form.bagTags.map((tag, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-md border bg-muted text-xs font-semibold shrink-0">
                      #{i + 1}
                    </span>
                    <Input
                      value={tag}
                      onChange={(e) => setBagTag(i, e.target.value)}
                      placeholder={`Bag Tag ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <Fld label="Internal Notes" wide>
              <Textarea
                rows={2}
                value={form.internalNotes}
                onChange={(e) => set("internalNotes", e.target.value)}
              />
            </Fld>
          </Grid>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Fld label="Delivery Method">
              <Select value={form.method} onValueChange={(v) => set("method", v as DeliveryMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Home Delivery">Home Delivery</SelectItem>
                  <SelectItem value="Airport Pickup">Airport Pickup</SelectItem>
                </SelectContent>
              </Select>
            </Fld>
            {form.method === "Airport Pickup" ? (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 space-y-1">
                <p className="font-semibold">Airport Pickup — no delivery details required</p>
                <p>
                  The passenger collects the baggage at the airport Lost &amp; Found office. No
                  delivery region, address, delivery agent or route applies. The case stays with
                  Lost &amp; Found and completes at “Passenger Picked Up”.
                </p>
              </div>
            ) : (
              <>
                <RegionField value={form.regionId} onChange={(v) => set("regionId", v)} />
                <div className="space-y-1.5">
                  <Label className="font-semibold">
                    Full Delivery Address <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    rows={6}
                    value={form.fullAddress}
                    onChange={(e) => set("fullAddress", e.target.value)}
                    placeholder={
                      "Country, governorate, city, district, street, building, floor, apartment, landmark…\n" +
                      "Include any details the driver needs to locate the passenger."
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    This address is passed to Delivery Management once the case reaches Ready for
                    Delivery.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-sm">
            <ReviewGroup title="Passenger" onEdit={() => setStep(0)}>
              <ReviewKV k="Full Name" v={passengerName()} />
              <ReviewKV k="PNR" v={form.pnr} />
              <ReviewKV k="Mobile" v={form.mobile} />
              <ReviewKV k="Email" v={form.email} />
            </ReviewGroup>
            <ReviewGroup title="Flight" onEdit={() => setStep(1)}>
              <ReviewKV
                k="Airline / Flight"
                v={[form.airline, form.flightNumber].filter(Boolean).join(" ")}
              />
              <ReviewKV k="Date" v={form.flightDate} />
              <ReviewKV
                k="Route"
                v={`${form.originAirport || "—"} → ${form.destinationAirport || "CAI"}`}
              />
            </ReviewGroup>
            <ReviewGroup title="Baggage" onEdit={() => setStep(2)}>
              <ReviewKV k="PIR Number" v={form.pirNumber} />
              <ReviewKV k="Number Of Bags" v={form.numberOfBags} />
              <ReviewKV k="Bag Tags" v={form.bagTags.filter(Boolean).join(", ")} />
              <ReviewKV k="Description" v={description()} />
              <ReviewKV k="Priority" v={form.priority} />
            </ReviewGroup>
            <ReviewGroup title="Delivery" onEdit={() => setStep(3)}>
              <ReviewKV k="Method" v={form.method} />
              {form.method === "Airport Pickup" ? (
                <ReviewKV k="Collection Point" v="Airport Lost & Found office" />
              ) : (
                <>
                  <ReviewKV k="Delivery Region" v={regionLabel(form.regionId)} />
                  <ReviewKV k="Full Address" v={form.fullAddress} />
                </>
              )}
            </ReviewGroup>
            {!canSubmit && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Complete every required field before submitting.
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="px-6 py-3 border-t flex-row justify-between gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={prev} disabled={step === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={!canSubmit || submitting} className="gap-1.5">
              <Upload className="h-4 w-4" />
              {submitting
                ? "Saving…"
                : mode === "edit"
                  ? "Save Changes"
                  : "Register Case"}
            </Button>
          )}
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>;
}

function Fld({
  label,
  required,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", wide && "sm:col-span-3")}>
      <Label className={required ? "font-semibold" : ""}>
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function ReviewGroup({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-xs text-primary hover:underline">
            Edit
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">{children}</div>
    </div>
  );
}

function ReviewKV({ k, v }: { k: string; v?: string }) {
  return (
    <div className="text-sm">
      <span className="text-xs text-muted-foreground">{k}: </span>
      <span className={cn(!v && "text-muted-foreground italic")}>{v || "—"}</span>
    </div>
  );
}

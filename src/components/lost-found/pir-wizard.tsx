import { useMemo, useState } from "react";
import {
  addCase,
  editCase,
  type BaggageCase,
  type Priority,
  type DeliveryMethod,
} from "@/lib/store";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
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
  middleName: string;
  lastName: string;
  nationality: string;
  passportNumber: string;
  pnr: string;
  ticketNumber: string;
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
  vipPassenger: boolean;
  rushDelivery: boolean;
  fragile: boolean;
  method: DeliveryMethod;
  fullAddress: string;
  station: string;
  department: string;
  internalNotes: string;
  casePriority: Priority;
  createdBy: string;
};

function empty(): F {
  return {
    firstName: "", middleName: "", lastName: "", nationality: "",
    passportNumber: "", pnr: "", ticketNumber: "", mobile: "", mobile2: "",
    email: "",
    airline: "", flightNumber: "",
    flightDate: new Date().toISOString().slice(0, 10),
    originAirport: "", destinationAirport: "CAI",
    pirNumber: "", numberOfBags: "1", bagTags: [""], weightKg: "",
    color: "", type: "", distinctiveMarks: "",
    priority: "Normal", vipPassenger: false, rushDelivery: false, fragile: false,
    method: "Home Delivery",
    fullAddress: "",
    station: "CAI - Cairo International Airport",
    department: "Lost & Found", internalNotes: "", casePriority: "Normal",
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
  let middleName = p.middleName ?? "";
  if (!firstName && !lastName && c.passengerName) {
    const parts = c.passengerName.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = parts.length > 1 ? parts[parts.length - 1] : "";
    middleName = parts.slice(1, -1).join(" ");
  }
  const legacyAddress = [
    d.building, d.street, d.district, d.city, d.governorate, d.country,
  ].filter(Boolean).join(", ");
  const nBags = Number(b.numberOfBags ?? 1) || 1;
  const existingTags = b.bagTags && b.bagTags.length > 0
    ? b.bagTags
    : (c.bagTagNumber ? [c.bagTagNumber] : [""]);
  const bagTags = Array.from({ length: nBags }, (_, idx) => existingTags[idx] ?? "");
  return {
    firstName, middleName, lastName,
    nationality: p.nationality ?? "",
    passportNumber: p.passportNumber ?? "",
    pnr: p.pnr ?? "",
    ticketNumber: p.ticketNumber ?? "",
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
    priority: c.priority ?? "Normal",
    vipPassenger: !!b.vipPassenger,
    rushDelivery: !!b.rushDelivery,
    fragile: !!b.fragile,
    method: d.method ?? "Home Delivery",
    fullAddress: d.fullAddress ?? legacyAddress,
    station: i.station ?? "CAI - Cairo International Airport",
    department: i.department ?? "Lost & Found",
    internalNotes: i.internalNotes ?? "",
    casePriority: i.casePriority ?? c.priority ?? "Normal",
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
  const [form, setForm] = useState<F>(() =>
    mode === "edit" && caseData ? fromCase(caseData) : empty(),
  );

  function set<K extends keyof F>(k: K, v: F[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const canSubmit = useMemo(
    () =>
      form.firstName.trim() &&
      form.lastName.trim() &&
      form.pirNumber.trim() &&
      form.bagTagNumber.trim() &&
      form.flightNumber.trim() &&
      form.mobile.trim(),
    [form],
  );

  function validateStep(i: number): string | null {
    if (i === 0) {
      if (!form.firstName.trim() || !form.lastName.trim()) return "First and last name are required.";
      if (!form.mobile.trim()) return "Mobile number is required.";
    }
    if (i === 1) {
      if (!form.flightNumber.trim()) return "Flight number is required.";
      if (!form.flightDate) return "Flight date is required.";
    }
    if (i === 2) {
      if (!form.pirNumber.trim() || !form.bagTagNumber.trim())
        return "PIR number and bag tag are required.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function prev() { setStep((s) => Math.max(0, s - 1)); }

  function passengerName(): string {
    return [form.firstName, form.middleName, form.lastName]
      .map((s) => s.trim()).filter(Boolean).join(" ");
  }
  function description(): string {
    return [form.color, form.brand, form.type, form.size, form.distinctiveMarks]
      .filter(Boolean).join(" — ");
  }

  function buildDocuments(): CaseDocument[] {
    const now = new Date().toISOString();
    const items: (CaseDocument | "" | false)[] = [
      form.passportCopy ? {
        id: `DOC-${Date.now()}-1`, type: "Passport Copy" as const,
        name: form.passportCopy, uploadedAt: now, uploadedBy: form.createdBy,
      } : "",
      form.arrivalStamp ? {
        id: `DOC-${Date.now()}-2`, type: "Arrival Stamp" as const,
        name: form.arrivalStamp, uploadedAt: now, uploadedBy: form.createdBy,
      } : "",
      form.authLetter ? {
        id: `DOC-${Date.now()}-3`, type: "Authorization Letter" as const,
        name: form.authLetter, uploadedAt: now, uploadedBy: form.createdBy,
      } : "",
      form.otherDoc ? {
        id: `DOC-${Date.now()}-4`, type: "Other" as const,
        name: form.otherDoc, uploadedAt: now, uploadedBy: form.createdBy,
      } : "",
    ];
    return items.filter(Boolean) as CaseDocument[];
  }

  function submit() {
    if (!canSubmit) {
      toast.error("Please complete required fields in Passenger, Flight, and Baggage steps.");
      return;
    }
    const commonPatch: Partial<BaggageCase> = {
      passengerName: passengerName(),
      flightNumber: form.flightNumber,
      pirNumber: form.pirNumber,
      bagTagNumber: form.bagTagNumber,
      arrivalDate: form.flightDate,
      contact: form.mobile,
      email: form.email,
      description: description(),
      priority: form.priority,
      passenger: {
        firstName: form.firstName, middleName: form.middleName, lastName: form.lastName,
        nationality: form.nationality, passportNumber: form.passportNumber,
        pnr: form.pnr, ticketNumber: form.ticketNumber, mobile2: form.mobile2,
        preferredLanguage: form.preferredLanguage,
      },
      flight: {
        airline: form.airline, arrivalTime: form.arrivalTime,
        originAirport: form.originAirport, destinationAirport: form.destinationAirport,
        terminal: form.terminal, arrivalBelt: form.arrivalBelt,
      },
      baggage: {
        numberOfBags: Number(form.numberOfBags) || 1,
        weightKg: Number(form.weightKg) || undefined,
        brand: form.brand, color: form.color, type: form.type, size: form.size,
        distinctiveMarks: form.distinctiveMarks,
        vipPassenger: form.vipPassenger, rushDelivery: form.rushDelivery, fragile: form.fragile,
      },
      delivery: {
        method: form.method, country: form.country, governorate: form.governorate,
        city: form.city, district: form.district, street: form.street,
        building: form.building, floor: form.floor, apartment: form.apartment,
        nearestLandmark: form.nearestLandmark, googleMapsLink: form.googleMapsLink,
        preferredDeliveryTime: form.preferredDeliveryTime,
      },
      internal: {
        assignedOfficer: form.assignedOfficer, station: form.station,
        department: form.department, internalNotes: form.internalNotes,
        casePriority: form.casePriority, createdBy: form.createdBy,
      },
    };

    if (mode === "edit" && caseData) {
      editCase(caseData.bagId, commonPatch, {
        actor: form.createdBy || "Ops Console",
        note: `Case edited · PIR ${form.pirNumber}`,
      });
      for (const d of buildDocuments()) {
        addCaseDocument(caseData.bagId, {
          type: d.type, name: d.name, uploadedBy: d.uploadedBy,
        });
      }
      toast.success(`Case ${caseData.pirNumber} updated`);
    } else {
      const created = addCase({
        ...commonPatch as Omit<BaggageCase, "bagId" | "status" | "storage" | "createdAt">,
        documents: buildDocuments(),
        initialLfStatus: "Open",
      });
      toast.success(`Case registered · ${created.pirNumber} · ${created.bagId}`);
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
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 border text-xs whitespace-nowrap transition-colors",
                active && "bg-primary text-primary-foreground border-primary font-semibold",
                done && "bg-emerald-50 text-emerald-700 border-emerald-200",
                !active && !done && "bg-muted/40 text-muted-foreground border-transparent",
              )}
            >
              <span className={cn(
                "inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold",
                active && "bg-primary-foreground text-primary",
                done && "bg-emerald-600 text-white",
                !active && !done && "bg-muted text-muted-foreground",
              )}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
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
            <Fld label="First Name" required><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Fld>
            <Fld label="Middle Name"><Input value={form.middleName} onChange={(e) => set("middleName", e.target.value)} /></Fld>
            <Fld label="Last Name" required><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Fld>
            <Fld label="Nationality"><Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} /></Fld>
            <Fld label="Passport Number"><Input value={form.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} /></Fld>
            <Fld label="PNR"><Input value={form.pnr} onChange={(e) => set("pnr", e.target.value)} /></Fld>
            <Fld label="Ticket Number"><Input value={form.ticketNumber} onChange={(e) => set("ticketNumber", e.target.value)} /></Fld>
            <Fld label="Mobile Number 1" required><Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} /></Fld>
            <Fld label="Mobile Number 2"><Input value={form.mobile2} onChange={(e) => set("mobile2", e.target.value)} /></Fld>
            <Fld label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Fld>
            <Fld label="Preferred Language">
              <Select value={form.preferredLanguage} onValueChange={(v) => set("preferredLanguage", v as F["preferredLanguage"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </Fld>
          </Grid>
        )}

        {step === 1 && (
          <Grid>
            <Fld label="Airline"><Input value={form.airline} onChange={(e) => set("airline", e.target.value)} placeholder="e.g. MS" /></Fld>
            <Fld label="Flight Number" required><Input value={form.flightNumber} onChange={(e) => set("flightNumber", e.target.value)} /></Fld>
            <Fld label="Flight Date" required><Input type="date" value={form.flightDate} onChange={(e) => set("flightDate", e.target.value)} /></Fld>
            <Fld label="Arrival Time"><Input type="time" value={form.arrivalTime} onChange={(e) => set("arrivalTime", e.target.value)} /></Fld>
            <Fld label="Origin (IATA)"><Input maxLength={3} value={form.originAirport} onChange={(e) => set("originAirport", e.target.value.toUpperCase())} /></Fld>
            <Fld label="Destination (IATA)"><Input maxLength={3} value={form.destinationAirport} onChange={(e) => set("destinationAirport", e.target.value.toUpperCase())} /></Fld>
            <Fld label="Terminal"><Input value={form.terminal} onChange={(e) => set("terminal", e.target.value)} /></Fld>
            <Fld label="Arrival Belt"><Input value={form.arrivalBelt} onChange={(e) => set("arrivalBelt", e.target.value)} /></Fld>
          </Grid>
        )}

        {step === 2 && (
          <Grid>
            <Fld label="PIR Number" required><Input value={form.pirNumber} onChange={(e) => set("pirNumber", e.target.value)} /></Fld>
            <Fld label="Bag Tag Number" required><Input value={form.bagTagNumber} onChange={(e) => set("bagTagNumber", e.target.value)} /></Fld>
            <Fld label="Number Of Bags"><Input type="number" min={1} value={form.numberOfBags} onChange={(e) => set("numberOfBags", e.target.value)} /></Fld>
            <Fld label="Weight (kg)"><Input type="number" step="0.1" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} /></Fld>
            <Fld label="Brand"><Input value={form.brand} onChange={(e) => set("brand", e.target.value)} /></Fld>
            <Fld label="Color"><Input value={form.color} onChange={(e) => set("color", e.target.value)} /></Fld>
            <Fld label="Type"><Input value={form.type} onChange={(e) => set("type", e.target.value)} placeholder="Hardshell / Softshell" /></Fld>
            <Fld label="Size"><Input value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="Cabin / Medium / Large" /></Fld>
            <Fld label="Priority">
              <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["Low", "Normal", "High", "VIP"] as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Fld>
            <Fld label="Distinctive Marks" wide><Textarea rows={2} value={form.distinctiveMarks} onChange={(e) => set("distinctiveMarks", e.target.value)} /></Fld>
            <div className="sm:col-span-3 flex flex-wrap gap-4 pt-1">
              <Toggle label="VIP Passenger" checked={form.vipPassenger} onChange={(v) => set("vipPassenger", v)} />
              <Toggle label="Rush Delivery" checked={form.rushDelivery} onChange={(v) => set("rushDelivery", v)} />
              <Toggle label="Fragile" checked={form.fragile} onChange={(v) => set("fragile", v)} />
            </div>
            <Fld label="Assigned Officer" wide><Input value={form.assignedOfficer} onChange={(e) => set("assignedOfficer", e.target.value)} placeholder="e.g. A. Hassan" /></Fld>
            <Fld label="Internal Notes" wide><Textarea rows={2} value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} /></Fld>
          </Grid>
        )}

        {step === 3 && (
          <Grid>
            <Fld label="Delivery Method">
              <Select value={form.method} onValueChange={(v) => set("method", v as DeliveryMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Home Delivery">Home Delivery</SelectItem>
                  <SelectItem value="Airport Pickup">Airport Pickup</SelectItem>
                </SelectContent>
              </Select>
            </Fld>
            <Fld label="Country"><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></Fld>
            <Fld label="Governorate"><Input value={form.governorate} onChange={(e) => set("governorate", e.target.value)} /></Fld>
            <Fld label="City"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Fld>
            <Fld label="District"><Input value={form.district} onChange={(e) => set("district", e.target.value)} /></Fld>
            <Fld label="Street"><Input value={form.street} onChange={(e) => set("street", e.target.value)} /></Fld>
            <Fld label="Building"><Input value={form.building} onChange={(e) => set("building", e.target.value)} /></Fld>
            <Fld label="Floor"><Input value={form.floor} onChange={(e) => set("floor", e.target.value)} /></Fld>
            <Fld label="Apartment"><Input value={form.apartment} onChange={(e) => set("apartment", e.target.value)} /></Fld>
            <Fld label="Nearest Landmark"><Input value={form.nearestLandmark} onChange={(e) => set("nearestLandmark", e.target.value)} /></Fld>
            <Fld label="Google Maps Link"><Input value={form.googleMapsLink} onChange={(e) => set("googleMapsLink", e.target.value)} placeholder="https://maps.google.com/…" /></Fld>
            <Fld label="Preferred Delivery Time"><Input value={form.preferredDeliveryTime} onChange={(e) => set("preferredDeliveryTime", e.target.value)} placeholder="e.g. 19:00 – 21:00" /></Fld>
          </Grid>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {mode === "edit" && caseData?.documents?.length ? (
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Already attached
                </p>
                <ul className="divide-y">
                  {caseData.documents.map((d) => (
                    <li key={d.id} className="py-2 flex items-center gap-3 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.type}</div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8"
                        onClick={() => { removeCaseDocument(caseData.bagId, d.id); toast.success("Document removed"); }}
                      >
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Doc label="Passport Copy" value={form.passportCopy} onChange={(v) => set("passportCopy", v)} />
              <Doc label="Arrival Stamp" value={form.arrivalStamp} onChange={(v) => set("arrivalStamp", v)} />
              <Doc label="Authorization Letter" value={form.authLetter} onChange={(v) => set("authLetter", v)} />
              <Doc label="Other Documents" value={form.otherDoc} onChange={(v) => set("otherDoc", v)} />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-sm">
            <ReviewGroup title="Passenger">
              <ReviewKV k="Full Name" v={passengerName()} />
              <ReviewKV k="Nationality" v={form.nationality} />
              <ReviewKV k="Passport" v={form.passportNumber} />
              <ReviewKV k="PNR / Ticket" v={[form.pnr, form.ticketNumber].filter(Boolean).join(" · ")} />
              <ReviewKV k="Mobile" v={form.mobile} />
              <ReviewKV k="Email" v={form.email} />
            </ReviewGroup>
            <ReviewGroup title="Flight">
              <ReviewKV k="Airline / Flight" v={[form.airline, form.flightNumber].filter(Boolean).join(" ")} />
              <ReviewKV k="Date / Time" v={[form.flightDate, form.arrivalTime].filter(Boolean).join(" ")} />
              <ReviewKV k="Route" v={`${form.originAirport || "—"} → ${form.destinationAirport || "CAI"}`} />
            </ReviewGroup>
            <ReviewGroup title="Baggage">
              <ReviewKV k="PIR / Tag" v={`${form.pirNumber} · ${form.bagTagNumber}`} />
              <ReviewKV k="Description" v={description()} />
              <ReviewKV k="Priority" v={form.priority} />
            </ReviewGroup>
            <ReviewGroup title="Delivery">
              <ReviewKV k="Method" v={form.method} />
              <ReviewKV k="Address" v={[form.building, form.street, form.district, form.city, form.governorate, form.country].filter(Boolean).join(", ")} />
            </ReviewGroup>
            {!canSubmit && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Complete the required fields before submitting: names, mobile, flight number, PIR, and bag tag.
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="px-6 py-3 border-t flex-row justify-between gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={prev} disabled={step === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={!canSubmit} className="gap-1.5">
              <Upload className="h-4 w-4" />
              {mode === "edit" ? "Save Changes" : "Register Case"}
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
  label, required, wide, children,
}: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", wide && "sm:col-span-3")}>
      <Label className={required ? "font-semibold" : ""}>
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      {label}
    </label>
  );
}

function Doc({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <Input placeholder="File reference (name / URL)" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ReviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
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
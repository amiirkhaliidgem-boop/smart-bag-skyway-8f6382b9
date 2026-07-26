import type { Delivery, BaggageCase } from "@/lib/store";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";

// Proof of Delivery (POD) — standalone printable template.
// Reuses PIR print CSS classes (.pir-*) defined in src/styles.css so it
// inherits identical A4 layout, hidden-UI print rules and page-break behavior.

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fullPassengerName(c?: BaggageCase, fallback?: string) {
  const p = c?.passenger;
  if (p?.firstName || p?.lastName) {
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
  }
  return c?.passengerName ?? fallback ?? "—";
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="pir-row">
      <div className="pir-k">{k}</div>
      <div className="pir-v">{v || "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pir-section">
      <h2 className="pir-h2">{title}</h2>
      <div className="pir-grid">{children}</div>
    </section>
  );
}

export function PodReport({
  delivery,
  caseRecord,
  assignedAt,
  outForDeliveryAt,
}: {
  delivery: Delivery;
  caseRecord?: BaggageCase;
  assignedAt?: string;
  outForDeliveryAt?: string;
}) {
  const d = delivery;
  const c = caseRecord;
  const bagTags = c?.baggage?.bagTags?.length
    ? c.baggage.bagTags
    : c?.bagTagNumber
    ? [c.bagTagNumber]
    : [];
  const verification =
    d.otpStatus === "Verified"
      ? "Verified"
      : d.deliveredAt
      ? "Delivered (Unverified)"
      : "Pending";

  return (
    <article className="pir-print">
      <header className="pir-header">
        <img src={iabLogo.url} alt="IAB" className="pir-logo" />
        <div className="pir-header-title">
          <div className="pir-brand">IAB · Smart Baggage Ecosystem</div>
          <h1 className="pir-title">Proof of Delivery (POD)</h1>
          <div className="pir-sub">Smart Baggage Ecosystem — Home Delivery</div>
        </div>
        <div className="pir-header-meta">
          <div><span>Delivery</span><b>{d.deliveryId}</b></div>
          <div><span>PIR</span><b>{d.pirNumber}</b></div>
          <div><span>Bag ID</span><b>{d.bagId}</b></div>
          <div><span>Generated</span><b>{fmtDate(new Date().toISOString())}</b></div>
        </div>
      </header>

      <Section title="Passenger Information">
        <Row k="Full Name" v={fullPassengerName(c, d.passengerName)} />
        <Row k="Mobile" v={d.mobile ?? c?.contact} />
        <Row k="Email" v={c?.email} />
        <Row k="PNR" v={c?.passenger?.pnr} />
      </Section>

      <Section title="Flight Information">
        <Row k="Airline" v={c?.flight?.airline} />
        <Row k="Flight No." v={c?.flightNumber} />
        <Row k="Flight Date" v={fmtDate(c?.arrivalDate)} />
        <Row k="Origin" v={c?.flight?.originAirport} />
        <Row k="Destination" v={c?.flight?.destinationAirport} />
      </Section>

      <Section title="Baggage Information">
        <Row
          k="Bag Tag(s)"
          v={
            bagTags.length ? (
              <span className="pir-mono">{bagTags.join(", ")}</span>
            ) : (
              "—"
            )
          }
        />
        <Row k="Number of Bags" v={c?.baggage?.numberOfBags ?? bagTags.length ?? 1} />
        <Row k="Color" v={c?.baggage?.color} />
        <Row k="Type" v={c?.baggage?.type} />
        <Row k="Weight (kg)" v={c?.baggage?.weightKg} />
        <Row k="Description" v={c?.description ?? c?.baggage?.distinctiveMarks} />
      </Section>

      <Section title="Delivery Information">
        <Row k="Method" v={c?.delivery?.method ?? "Home Delivery"} />
        <Row k="Delivery Agent" v={d.driver && d.driver !== "—" ? d.driver : "Unassigned"} />
        <Row k="Delivery Address" v={d.address} />
        <Row k="Priority" v={d.priority} />
      </Section>

      <Section title="Delivery Timeline">
        <Row k="Assigned At" v={fmtDate(assignedAt)} />
        <Row k="Accepted At" v={fmtDate(d.acceptedAt)} />
        <Row k="Collected At" v={fmtDate(d.collectedAt)} />
        <Row k="Out For Delivery" v={fmtDate(outForDeliveryAt)} />
        <Row k="Delivered At" v={fmtDate(d.deliveredAt)} />
      </Section>

      <Section title="OTP Verification">
        <Row k="OTP Status" v={d.otpStatus} />
        <Row k="Verification Status" v={verification} />
      </Section>

      <section className="pir-signatures">
        <div>
          <div className="pir-sig-line" />
          <div className="pir-sig-label">Passenger Signature</div>
          <div className="pir-sig-date">Date: __ / __ / ____</div>
        </div>
        <div>
          <div className="pir-sig-line" />
          <div className="pir-sig-label">Delivery Agent Signature</div>
          <div className="pir-sig-date">Date: __ / __ / ____</div>
        </div>
      </section>

      <footer className="pir-footer">
        <span>{d.deliveryId} · PIR {d.pirNumber}</span>
        <span>IAB Smart Baggage Ecosystem — Confidential</span>
      </footer>
    </article>
  );
}
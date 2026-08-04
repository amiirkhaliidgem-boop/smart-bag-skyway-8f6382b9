import type { BaggageCase } from "@/lib/store";
import { deriveLfFromCase } from "@/lib/lost-found/statuses";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";

// Standalone printable PIR Report template.
//
// This component intentionally does NOT depend on any application chrome
// (sidebar, header, toolbars). It is a pure presentation of PIR data and
// is safe to render inside a print-only route, a future server-side PDF
// renderer, or an email attachment builder — without changing the layout.

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

function fullPassengerName(c: BaggageCase) {
  const p = c.passenger;
  if (p?.firstName || p?.lastName) {
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
  }
  return c.passengerName;
}

function fullAddress(c: BaggageCase) {
  const d = c.delivery;
  if (!d) return "—";
  if (d.fullAddress?.trim()) return d.fullAddress;
  return (
    [d.building, d.street, d.district, d.city, d.governorate, d.country]
      .filter(Boolean)
      .join(", ") || "—"
  );
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

export function PirReport({ caseRecord }: { caseRecord: BaggageCase }) {
  const c = caseRecord;
  const lfs = c.lfStatus ?? deriveLfFromCase(c);
  const priority = c.priority ?? c.internal?.casePriority ?? "Normal";
  const bagTags = c.baggage?.bagTags?.length
    ? c.baggage.bagTags
    : c.bagTagNumber
      ? [c.bagTagNumber]
      : [];

  return (
    <article className="pir-print">
      <header className="pir-header">
        <img src={iabLogo.url} alt="IAB" className="pir-logo" />
        <div className="pir-header-title">
          <div className="pir-brand">IAB · Smart Baggage Ecosystem</div>
          <h1 className="pir-title">Property Irregularity Report</h1>
          <div className="pir-sub">Smart Baggage Ecosystem — Ground Handling</div>
        </div>
        <div className="pir-header-meta">
          <div>
            <span>PIR</span>
            <b>{c.pirNumber}</b>
          </div>
          <div>
            <span>Bag ID</span>
            <b>{c.bagId}</b>
          </div>
          <div>
            <span>Generated</span>
            <b>{fmtDate(new Date().toISOString())}</b>
          </div>
        </div>
      </header>

      <Section title="Case Overview">
        <Row k="Current Status" v={lfs} />
        <Row k="Priority" v={priority} />
        <Row k="Assigned Officer" v={c.internal?.assignedOfficer} />
        <Row k="Station" v={c.internal?.station} />
        <Row k="Created" v={fmtDate(c.createdAt)} />
        <Row k="Last Updated" v={fmtDate(c.updatedAt)} />
      </Section>

      <Section title="Passenger Information">
        <Row k="Full Name" v={fullPassengerName(c)} />
        <Row k="PNR" v={c.passenger?.pnr} />
        <Row k="Mobile" v={c.contact} />
        <Row k="Alternate Mobile" v={c.passenger?.mobile2} />
        <Row k="Email" v={c.email} />
      </Section>

      <Section title="Flight Information">
        <Row k="Airline" v={c.flight?.airline} />
        <Row k="Flight No." v={c.flightNumber} />
        <Row k="Flight Date" v={c.arrivalDate} />
        <Row k="Origin" v={c.flight?.originAirport} />
        <Row k="Destination" v={c.flight?.destinationAirport} />
        <Row k="Terminal" v={c.flight?.terminal} />
      </Section>

      <Section title="Baggage Information">
        <Row k="Number of Bags" v={c.baggage?.numberOfBags ?? bagTags.length ?? 1} />
        <Row
          k="Bag Tag(s)"
          v={bagTags.length ? <span className="pir-mono">{bagTags.join(", ")}</span> : "—"}
        />
        <Row k="Brand" v={c.baggage?.brand} />
        <Row k="Color" v={c.baggage?.color} />
        <Row k="Type" v={c.baggage?.type} />
        <Row k="Size" v={c.baggage?.size} />
        <Row k="Weight (kg)" v={c.baggage?.weightKg} />
        <Row k="Distinctive Marks" v={c.baggage?.distinctiveMarks} />
      </Section>

      <Section title="Delivery Information">
        <Row k="Method" v={c.delivery?.method} />
        <Row k="Full Address" v={fullAddress(c)} />
        <Row k="Preferred Time" v={c.delivery?.preferredDeliveryTime} />
        <Row
          k="Storage Location"
          v={
            c.storage
              ? `Zone ${c.storage.zone} · Shelf ${c.storage.shelf} · Pos ${c.storage.position}`
              : "—"
          }
        />
      </Section>

      <section className="pir-signatures">
        <div>
          <div className="pir-sig-line" />
          <div className="pir-sig-label">Passenger Signature</div>
          <div className="pir-sig-date">Date: __ / __ / ____</div>
        </div>
        <div>
          <div className="pir-sig-line" />
          <div className="pir-sig-label">Officer Signature</div>
          <div className="pir-sig-date">Date: __ / __ / ____</div>
        </div>
      </section>

      <footer className="pir-footer">
        <span>
          {c.pirNumber} · {c.bagId}
        </span>
        <span>IAB Smart Baggage Ecosystem — Confidential</span>
      </footer>
    </article>
  );
}

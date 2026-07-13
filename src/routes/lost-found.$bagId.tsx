import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  updateCase,
  updateLfStatus,
  addCaseDocument,
  removeCaseDocument,
  type BaggageCase,
  type CaseDocument,
  type Priority,
} from "@/lib/store";
import {
  LF_STATUSES,
  deriveLfFromCase,
  nextLfStatus,
  type LFStatus,
} from "@/lib/lost-found/statuses";
import { LfStatusBadge } from "@/components/lf-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  ArrowLeft,
  ChevronRight,
  Truck,
  MessageSquare,
  Phone,
  Mail,
  FileText,
  Upload,
  Trash2,
  MapPin,
  Radar,
  History as HistoryIcon,
  ShieldAlert,
  Star as StarIcon,
  ExternalLink,
} from "lucide-react";
import { WORKFLOW_LABELS } from "@/lib/workflow/statuses";

export const Route = createFileRoute("/lost-found/$bagId")({
  head: ({ params }) => ({
    meta: [
      { title: `Case ${params.bagId} — Lost & Found` },
      { name: "description", content: "Enterprise baggage case detail — tracing, delivery, and communication." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CaseDetailsPage,
});

function CaseDetailsPage() {
  const { bagId } = Route.useParams();
  const navigate = useNavigate();
  const c = useStore((s) => s.cases.find((x) => x.bagId === bagId));
  const deliveries = useStore((s) => s.deliveries);
  const notifications = useStore((s) => s.notifications);
  const callLogs = useStore((s) => s.callLogs);
  const whatsapp = useStore((s) => s.whatsapp);
  const audit = useStore((s) => s.audit);
  const workflow = useStore((s) => s.workflow);

  if (!c) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <h1 className="text-xl font-semibold">Case not found</h1>
        <p className="text-muted-foreground text-sm">
          The case <span className="font-mono">{bagId}</span> does not exist or has been removed.
        </p>
        <Button asChild variant="outline">
          <Link to="/lost-found">Back to Lost &amp; Found</Link>
        </Button>
      </div>
    );
  }

  const lfs = deriveLfFromCase(c);
  const priority = c.priority ?? c.internal?.casePriority ?? "Normal";
  const vip = c.baggage?.vipPassenger || priority === "VIP";
  const linkedDelivery = deliveries.find((d) => d.bagId === c.bagId);
  const wf = linkedDelivery
    ? workflow.find((w) => w.deliveryId === linkedDelivery.deliveryId)
    : undefined;

  const relatedNotifications = notifications.filter(
    (n) => n.pirNumber === c.pirNumber || n.deliveryId === linkedDelivery?.deliveryId,
  );
  const relatedCalls = callLogs.filter(
    (l) => l.bagId === c.bagId || l.pirNumber === c.pirNumber,
  );
  const relatedWhatsapp = whatsapp.filter(
    (w) => w.pirNumber === c.pirNumber || w.phone === c.contact,
  );
  const relatedAudit = audit.filter(
    (a) =>
      (a.entityType === "case" && a.entityId === c.bagId) ||
      (a.entityType === "delivery" && a.entityId === linkedDelivery?.deliveryId) ||
      (a.entityType === "notification" &&
        relatedNotifications.some((n) => n.id === a.entityId)),
  );

  function advance() {
    const next = nextLfStatus(lfs);
    if (!next) {
      toast.info("Case is already at the final status.");
      return;
    }
    updateLfStatus(c!.bagId, next, { actor: "Ops Console" });
    toast.success(`Status moved to ${next}`);
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/lost-found" className="hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Lost &amp; Found
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-mono">{c.pirNumber}</span>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="p-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{c.passengerName}</h1>
              {vip && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                  <StarIcon className="h-3 w-3 fill-amber-500" /> VIP
                </span>
              )}
            </div>
            <div className="mt-1 grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span>PIR <span className="font-mono text-foreground">{c.pirNumber}</span></span>
              <span>Bag <span className="font-mono text-foreground">{c.bagId}</span></span>
              <span>Tag <span className="font-mono text-foreground">{c.bagTagNumber}</span></span>
              <span>Flight <span className="font-mono text-foreground">{c.flightNumber}</span></span>
              <span>Priority <span className="text-foreground font-medium">{priority}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LfStatusBadge status={lfs} className="text-xs px-3 py-1" />
            <StatusChanger current={lfs} bagId={c.bagId} />
            <Button onClick={advance} className="gap-1.5">
              Advance <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents">
            Documents {c.documents?.length ? `(${c.documents.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="tracing">Tracing</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InfoCard title="Passenger">
            <KV k="Full Name" v={c.passengerName} />
            <KV k="Nationality" v={c.passenger?.nationality} />
            <KV k="Passport" v={c.passenger?.passportNumber} mono />
            <KV k="PNR" v={c.passenger?.pnr} mono />
            <KV k="Ticket" v={c.passenger?.ticketNumber} mono />
            <KV k="Mobile 1" v={c.contact} />
            <KV k="Mobile 2" v={c.passenger?.mobile2} />
            <KV k="Email" v={c.email} />
            <KV k="Preferred Language" v={c.passenger?.preferredLanguage?.toUpperCase()} />
          </InfoCard>
          <InfoCard title="Flight">
            <KV k="Airline" v={c.flight?.airline} />
            <KV k="Flight No." v={c.flightNumber} mono />
            <KV k="Flight Date" v={c.arrivalDate} />
            <KV k="Arrival Time" v={c.flight?.arrivalTime} />
            <KV k="Origin" v={c.flight?.originAirport} mono />
            <KV k="Destination" v={c.flight?.destinationAirport} mono />
            <KV k="Terminal" v={c.flight?.terminal} />
            <KV k="Belt" v={c.flight?.arrivalBelt} />
          </InfoCard>
          <InfoCard title="Baggage">
            <KV k="Bag Tag" v={c.bagTagNumber} mono />
            <KV k="Number Of Bags" v={c.baggage?.numberOfBags?.toString()} />
            <KV k="Weight" v={c.baggage?.weightKg ? `${c.baggage.weightKg} kg` : undefined} />
            <KV k="Brand" v={c.baggage?.brand} />
            <KV k="Color" v={c.baggage?.color} />
            <KV k="Type" v={c.baggage?.type} />
            <KV k="Size" v={c.baggage?.size} />
            <KV k="Distinctive Marks" v={c.baggage?.distinctiveMarks} />
            <KV k="VIP" v={c.baggage?.vipPassenger ? "Yes" : undefined} />
            <KV k="Rush" v={c.baggage?.rushDelivery ? "Yes" : undefined} />
            <KV k="Fragile" v={c.baggage?.fragile ? "Yes" : undefined} />
          </InfoCard>
          <InfoCard title="Delivery Address">
            <KV k="Method" v={c.delivery?.method} />
            <KV k="Country" v={c.delivery?.country} />
            <KV k="Governorate" v={c.delivery?.governorate} />
            <KV k="City" v={c.delivery?.city} />
            <KV k="District" v={c.delivery?.district} />
            <KV k="Street" v={c.delivery?.street} />
            <KV k="Building" v={c.delivery?.building} />
            <KV k="Floor / Apt" v={[c.delivery?.floor, c.delivery?.apartment].filter(Boolean).join(" / ")} />
            <KV k="Landmark" v={c.delivery?.nearestLandmark} />
            <KV k="Preferred Time" v={c.delivery?.preferredDeliveryTime} />
            {c.delivery?.googleMapsLink && (
              <div className="col-span-2 mt-1">
                <a
                  href={c.delivery.googleMapsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs inline-flex items-center gap-1 hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </InfoCard>
          <InfoCard title="Internal" className="lg:col-span-2">
            <KV k="Assigned Officer" v={c.internal?.assignedOfficer} />
            <KV k="Station" v={c.internal?.station} />
            <KV k="Department" v={c.internal?.department} />
            <KV k="Case Priority" v={c.internal?.casePriority} />
            <KV k="Created By" v={c.internal?.createdBy} />
            <KV k="Created" v={new Date(c.createdAt).toLocaleString("en-GB")} />
            <KV k="Last Updated" v={c.updatedAt ? new Date(c.updatedAt).toLocaleString("en-GB") : undefined} />
            {c.internal?.internalNotes && (
              <div className="col-span-full pt-2 border-t mt-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-line">{c.internal.internalNotes}</p>
              </div>
            )}
          </InfoCard>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
              <p className="text-xs text-muted-foreground">
                Filtered by this case — reads from the central Activity Timeline engine.
              </p>
            </CardHeader>
            <CardContent>
              <TimelineList
                items={buildTimeline(c, relatedAudit, relatedNotifications, wf)}
              />
              <div className="mt-3">
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                  <Link to="/timeline">
                    Open full timeline <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="pt-4">
          <DocumentsPanel bagId={c.bagId} docs={c.documents ?? []} />
        </TabsContent>

        {/* TRACING */}
        <TabsContent value="tracing" className="pt-4">
          <TracingPanel c={c} />
        </TabsContent>

        {/* COMMUNICATION */}
        <TabsContent value="communication" className="pt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> SMS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedNotifications.filter((n) => n.channel === "sms").length ? (
                  relatedNotifications
                    .filter((n) => n.channel === "sms")
                    .map((n) => (
                      <div key={n.id} className="text-xs border rounded p-2 bg-muted/30">
                        <div className="flex justify-between text-muted-foreground">
                          <span>{n.locale.toUpperCase()} · {n.status_}</span>
                          <span>{new Date(n.createdAt).toLocaleString("en-GB")}</span>
                        </div>
                        <div className="mt-1">{n.message.body}</div>
                      </div>
                    ))
                ) : (
                  <Empty text="No SMS on this case yet." />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedNotifications.filter((n) => n.channel === "whatsapp").length ? (
                  relatedNotifications
                    .filter((n) => n.channel === "whatsapp")
                    .map((n) => (
                      <div key={n.id} className="text-xs border rounded p-2 bg-muted/30">
                        <div className="flex justify-between text-muted-foreground">
                          <span>{n.locale.toUpperCase()} · {n.status_}</span>
                          <span>{new Date(n.createdAt).toLocaleString("en-GB")}</span>
                        </div>
                        <div className="mt-1">{n.message.body}</div>
                      </div>
                    ))
                ) : (
                  <Empty text="No WhatsApp messages yet." />
                )}
                {relatedWhatsapp.map((w) => (
                  <div key={w.id} className="text-xs border rounded p-2">
                    <div className="text-muted-foreground">{new Date(w.at).toLocaleString("en-GB")}</div>
                    {w.thread.map((t, i) => (
                      <div key={i} className="mt-1">
                        <span className="font-semibold">{t.from}:</span> {t.text}
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relatedNotifications.filter((n) => n.channel === "email").length ? (
                  relatedNotifications
                    .filter((n) => n.channel === "email")
                    .map((n) => (
                      <div key={n.id} className="text-xs border rounded p-2 bg-muted/30">
                        <div className="flex justify-between text-muted-foreground">
                          <span>{n.status_}</span>
                          <span>{new Date(n.createdAt).toLocaleString("en-GB")}</span>
                        </div>
                        {n.message.subject && (
                          <div className="font-medium mt-1">{n.message.subject}</div>
                        )}
                        <div>{n.message.body}</div>
                      </div>
                    ))
                ) : (
                  <Empty text="No email records on this case." />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Phone Calls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {relatedCalls.length ? (
                  relatedCalls.map((l) => (
                    <div key={l.id} className="text-xs border rounded p-2 bg-muted/30">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{l.direction} · {l.agent}</span>
                        <span>{new Date(l.at).toLocaleString("en-GB")}</span>
                      </div>
                      <div className="mt-1">{l.notes}</div>
                    </div>
                  ))
                ) : (
                  <Empty text="No calls logged." />
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tracking Link & OTP</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              {wf ? (
                <>
                  <div>Tracking token: <span className="font-mono">{wf.token}</span></div>
                  <a
                    href={`/passenger/${wf.token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    /passenger/{wf.token} <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              ) : (
                <Empty text="Tracking link is generated once a delivery is created." />
              )}
              {linkedDelivery && (
                <div>OTP: <span className="font-mono">{linkedDelivery.otpCode}</span> ({linkedDelivery.otpStatus})</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DELIVERY */}
        <TabsContent value="delivery" className="pt-4">
          {linkedDelivery ? (
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Delivery {linkedDelivery.deliveryId}
                </CardTitle>
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link to="/delivery">Open Delivery Module</Link>
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <KV k="Status" v={linkedDelivery.status} />
                <KV k="Assigned Driver" v={linkedDelivery.driver} />
                <KV k="Driver Phone" v={linkedDelivery.mobile} />
                <KV k="Vehicle" v="Fleet vehicle (assignment pending real API)" />
                <KV k="ETA" v={new Date(linkedDelivery.eta).toLocaleString("en-GB")} />
                <KV k="OTP" v={`${linkedDelivery.otpCode} (${linkedDelivery.otpStatus})`} mono />
                <KV k="Destination" v={linkedDelivery.destination?.label} />
                <KV k="Address" v={linkedDelivery.address} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                <Truck className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                No delivery record linked to this case yet.
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/delivery">Create in Delivery Module</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <HistoryIcon className="h-4 w-4" /> Status History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {c.lfHistory && c.lfHistory.length > 0 ? (
                <ul className="space-y-2">
                  {[...c.lfHistory].reverse().map((h, i) => (
                    <li key={i} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{h.status}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.at).toLocaleString("en-GB")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        by {h.actor}{h.note ? ` · ${h.note}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty text="No status transitions yet." />
              )}
              {wf && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Workflow Engine
                  </p>
                  <ul className="space-y-1">
                    {wf.history.map((h, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        <span className="text-foreground font-medium">
                          {WORKFLOW_LABELS[h.status].en}
                        </span>{" "}
                        · {new Date(h.at).toLocaleString("en-GB")} · {h.actor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT */}
        <TabsContent value="audit" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {relatedAudit.length ? (
                <ul className="divide-y">
                  {relatedAudit.map((a) => (
                    <li key={a.id} className="py-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{a.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.at).toLocaleString("en-GB")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.entityType}/{a.entityId} · {a.actor}
                        {a.note ? ` · ${a.note}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty text="No audit entries for this case yet." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusChanger({ current, bagId }: { current: LFStatus; bagId: string }) {
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        updateLfStatus(bagId, v as LFStatus, { actor: "Ops Console", force: true });
        toast.success(`Status updated to ${v}`);
      }}
    >
      <SelectTrigger className="w-[220px] h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LF_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>{s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InfoCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {children}
      </CardContent>
    </Card>
  );
}

function KV({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  if (v === undefined || v === "" || v === null) {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</p>
        <p className="text-muted-foreground italic">—</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className={mono ? "font-mono text-xs" : ""}>{v}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic py-3 text-center">{text}</p>;
}

// ---------- Documents panel ----------
function DocumentsPanel({ bagId, docs }: { bagId: string; docs: CaseDocument[] }) {
  const [type, setType] = useState<CaseDocument["type"]>("Passport Copy");
  const [name, setName] = useState("");
  function upload() {
    if (!name.trim()) {
      toast.error("Provide a file name or reference.");
      return;
    }
    addCaseDocument(bagId, { type, name, uploadedBy: "Ops Console" });
    setName("");
    toast.success(`${type} attached`);
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload Document
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Drag &amp; drop / cloud storage integration is future-ready.
            For now attach a file name or URL reference.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CaseDocument["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Passport Copy">Passport Copy</SelectItem>
                <SelectItem value="Arrival Stamp">Arrival Stamp</SelectItem>
                <SelectItem value="Authorization Letter">Authorization Letter</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-[2] min-w-[240px]">
            <Label className="text-xs">File name / URL</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="passport_ahmed.pdf" />
          </div>
          <Button onClick={upload} className="gap-1.5">
            <Upload className="h-4 w-4" /> Attach
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Attached Documents ({docs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length ? (
            <ul className="divide-y">
              {docs.map((d) => (
                <li key={d.id} className="py-2 flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.type} · {new Date(d.uploadedAt).toLocaleString("en-GB")}
                      {d.uploadedBy ? ` · ${d.uploadedBy}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      removeCaseDocument(bagId, d.id);
                      toast.success("Document removed");
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No documents attached yet." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Tracing panel ----------
function TracingPanel({ c }: { c: BaggageCase }) {
  const [notes, setNotes] = useState("");
  const lfs = deriveLfFromCase(c);
  const last = c.lfHistory?.[c.lfHistory.length - 1];
  const next = nextLfStatus(lfs);

  function addTracingNote() {
    if (!notes.trim()) return;
    updateCase(c.bagId, {
      internal: {
        ...(c.internal ?? {}),
        internalNotes:
          `[Tracing ${new Date().toLocaleString("en-GB")}] ${notes}\n` +
          (c.internal?.internalNotes ?? ""),
      },
    });
    setNotes("");
    toast.success("Tracing note added");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Radar className="h-4 w-4" /> Tracing
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <KV k="Current Status" v={lfs} />
          <KV k="Current Station" v={c.internal?.station} />
          <KV k="Last Update" v={last ? new Date(last.at).toLocaleString("en-GB") : undefined} />
          <KV k="Expected Arrival" v={c.flight?.arrivalTime ? `${c.arrivalDate} ${c.flight.arrivalTime}` : c.arrivalDate} />
          <KV k="Origin Station" v={c.flight?.originAirport} mono />
          <KV k="Destination Station" v={c.flight?.destinationAirport ?? "CAI"} mono />
          <div className="col-span-full pt-2 border-t mt-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              Next Recommended Action
            </p>
            <p className="text-sm">
              {next ? (
                <>Advance to <span className="font-semibold">{next}</span></>
              ) : (
                "Case is complete."
              )}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tracing Notes</CardTitle>
          <p className="text-xs text-muted-foreground">
            Notes are appended to internal notes and are visible to Baggage Ops &amp; Quality.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Contacted origin station — bag located on flight MS986, ETA 22:00."
          />
          <Button onClick={addTracingNote}>Add Tracing Note</Button>
          {c.internal?.internalNotes && (
            <div className="pt-3 border-t">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                History
              </p>
              <pre className="text-xs whitespace-pre-wrap font-sans">
                {c.internal.internalNotes}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Timeline builder ----------
type TimelineItem = {
  id: string;
  at: string;
  title: string;
  subtitle?: string;
  tag: string;
};

function buildTimeline(
  c: BaggageCase,
  audit: import("@/lib/audit/log").AuditEntry[],
  notifs: import("@/lib/store").NotificationEvent[],
  wf?: import("@/lib/store").WorkflowRecord,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  items.push({
    id: `create-${c.bagId}`,
    at: c.createdAt,
    title: `Case created · ${c.pirNumber}`,
    subtitle: `${c.passengerName} · ${c.flightNumber}`,
    tag: "Case",
  });
  for (const h of c.lfHistory ?? []) {
    items.push({
      id: `lfh-${c.bagId}-${h.at}`,
      at: h.at,
      title: `Status → ${h.status}`,
      subtitle: `${h.actor}${h.note ? ` · ${h.note}` : ""}`,
      tag: "Workflow",
    });
  }
  for (const h of wf?.history ?? []) {
    items.push({
      id: `wfh-${wf!.deliveryId}-${h.at}`,
      at: h.at,
      title: `Workflow → ${WORKFLOW_LABELS[h.status].en}`,
      subtitle: `${h.actor}`,
      tag: "Workflow",
    });
  }
  for (const n of notifs) {
    items.push({
      id: `ntf-${n.id}`,
      at: n.createdAt,
      title: `${n.channel.toUpperCase()} · ${n.status_}`,
      subtitle: n.message.body,
      tag: "Notification",
    });
  }
  for (const a of audit) {
    items.push({
      id: `aud-${a.id}`,
      at: a.at,
      title: a.action,
      subtitle: `${a.entityType}/${a.entityId} · ${a.actor}${a.note ? ` · ${a.note}` : ""}`,
      tag: "Audit",
    });
  }
  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  return items;
}

function TimelineList({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <Empty text="No activity yet." />;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.id} className="flex gap-3">
          <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">{it.title}</span>
              <span className="text-[10px] uppercase tracking-wider bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                {it.tag}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(it.at).toLocaleString("en-GB")}
              </span>
            </div>
            {it.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {it.subtitle}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
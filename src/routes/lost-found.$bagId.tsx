import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStore,
  editCase,
  updateLfStatus,
  type BaggageCase,
  type NotificationEvent,
} from "@/lib/store";
import {
  LF_OWNED_STATUSES,
  deriveLfFromCase,
  nextLfStatus,
  canTransitionLf,
  LF_STATUS_ORDER,
  type LFStatus,
} from "@/lib/lost-found/statuses";
import { LfStatusBadge } from "@/components/lf-status-badge";
import { LfStatusStepper } from "@/components/lost-found/status-stepper";
import { PirWizard } from "@/components/lost-found/pir-wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronRight, Truck, MessageSquare, Phone, Mail,
  MapPin, Star as StarIcon, ExternalLink, Pencil, MoreHorizontal,
  UserCog, Printer, Download,
  AlertTriangle,
} from "lucide-react";

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
  const c = useStore((s) => s.cases.find((x) => x.bagId === bagId));
  const deliveries = useStore((s) => s.deliveries);
  const notifications = useStore((s) => s.notifications);
  const callLogs = useStore((s) => s.callLogs);
  const whatsapp = useStore((s) => s.whatsapp);
  const workflow = useStore((s) => s.workflow);

  const [editOpen, setEditOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [assignOfficerOpen, setAssignOfficerOpen] = useState(false);

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
  const vip = priority === "VIP";
  const linkedDelivery = deliveries.find((d) => d.bagId === c.bagId);
  const wf = linkedDelivery
    ? workflow.find((w) => w.deliveryId === linkedDelivery.deliveryId)
    : undefined;
  // Ownership hand-off: once the case reaches Ready for Delivery, Delivery
  // Management owns the case and L&F can only view it. Status controls
  // become read-only here.
  const deliveryOwned =
    LF_STATUS_ORDER[lfs] >= LF_STATUS_ORDER["Ready for Delivery"];

  const relatedNotifications = notifications.filter(
    (n) => n.pirNumber === c.pirNumber || n.deliveryId === linkedDelivery?.deliveryId,
  );
  const relatedCalls = callLogs.filter(
    (l) => l.bagId === c.bagId || l.pirNumber === c.pirNumber,
  );
  const relatedWhatsapp = whatsapp.filter(
    (w) => w.pirNumber === c.pirNumber || w.phone === c.contact,
  );

  function advance() {
    if (deliveryOwned) {
      toast.info("This case is owned by Delivery Management. Update status there.");
      return;
    }
    const next = nextLfStatus(lfs);
    if (!next) {
      toast.info("Case is already at the final status.");
      return;
    }
    updateLfStatus(c!.bagId, next, { actor: "Ops Console" });
    toast.success(`Status moved to ${next}`);
  }

  function changeStatus(target: LFStatus, force = false, note?: string) {
    if (target === lfs) {
      setChangeOpen(false);
      return;
    }
    if (deliveryOwned && !force) {
      toast.info("This case is owned by Delivery Management. Update status there.");
      setChangeOpen(false);
      return;
    }
    if (!force && !canTransitionLf(lfs, target)) {
      toast.error("Backward transitions require the Change Status dialog with override.");
      return;
    }
    updateLfStatus(c!.bagId, target, { actor: "Ops Console", force, note });
    toast.success(`Status updated to ${target}`);
    setChangeOpen(false);
  }

  // ---- Quick Actions ----
  function printPir() { window.print(); }
  function exportCase() {
    const payload = JSON.stringify(c, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c!.pirNumber}-${c!.bagId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${c!.pirNumber}`);
  }
  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/lost-found" className="hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Lost &amp; Found
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-mono">{c.pirNumber}</span>
      </div>

      {/* Incomplete-data banner — shown when the case was imported/created
          with mandatory fields only and optional info is still pending. */}
      {c.incomplete && c.missingFields && c.missingFields.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Incomplete data — case created, please complete when possible
            </p>
            <p className="text-xs text-amber-800/90 dark:text-amber-200/80 mt-1">
              Airport operations continued with the mandatory fields. The
              following optional fields are still pending:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.missingFields.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center rounded-full border border-amber-300 bg-white/70 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Complete
          </Button>
        </div>
      )}

      {/* Header */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{c.passengerName}</h1>
                {vip && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                    <StarIcon className="h-3 w-3 fill-amber-500" /> VIP
                  </span>
                )}
                <LfStatusBadge status={lfs} className="text-xs px-2.5 py-1" />
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1 text-xs">
                <HeaderKV k="PIR" v={c.pirNumber} mono />
                <HeaderKV k="Bag ID" v={c.bagId} mono />
                <HeaderKV k="Bag Tag" v={c.bagTagNumber} mono />
                <HeaderKV k="Flight" v={c.flightNumber} mono />
                <HeaderKV k="Priority" v={priority} />
                <HeaderKV k="Officer" v={c.internal?.assignedOfficer || "Unassigned"} />
                <HeaderKV k="Delivery Method" v={c.delivery?.method || "—"} />
                <HeaderKV k="Created" v={new Date(c.createdAt).toLocaleString("en-GB")} />
                <HeaderKV k="Last Updated" v={c.updatedAt ? new Date(c.updatedAt).toLocaleString("en-GB") : "—"} />
                <HeaderKV k="Contact" v={c.contact || "—"} />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
                <Pencil className="h-4 w-4" /> Edit PIR
              </Button>
              <Button
                variant="outline"
                onClick={() => setChangeOpen(true)}
                className="gap-1.5"
                disabled={deliveryOwned}
                title={deliveryOwned ? "Owned by Delivery Management" : undefined}
              >
                Change Status
              </Button>
              <Button
                onClick={advance}
                className="gap-1.5"
                disabled={deliveryOwned || !nextLfStatus(lfs)}
                title={deliveryOwned ? "Owned by Delivery Management" : undefined}
              >
                Advance <ChevronRight className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit PIR
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAssignOfficerOpen(true)}>
                    <UserCog className="h-4 w-4 mr-2" /> Assign Officer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={printPir}>
                    <Printer className="h-4 w-4 mr-2" /> Print PIR
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCase}>
                    <Download className="h-4 w-4 mr-2" /> Export Case
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Workflow stepper */}
          <div className="pt-2 border-t">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Case Lifecycle
            </p>
            <LfStatusStepper
              current={lfs}
              onSelect={deliveryOwned ? undefined : (s) => changeStatus(s)}
            />
            {deliveryOwned && (
              <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 flex items-center gap-2">
                <Truck className="h-3.5 w-3.5" />
                This case has been handed over to Delivery Management. Status
                updates from Ready for Delivery onward are controlled there.
                {linkedDelivery && (
                  <Link
                    to="/delivery"
                    className="ml-auto font-semibold text-sky-900 hover:underline inline-flex items-center gap-1"
                  >
                    Open Delivery <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="passenger">Passenger</TabsTrigger>
          <TabsTrigger value="flight">Flight</TabsTrigger>
          <TabsTrigger value="baggage">Baggage</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OverviewPassenger c={c} />
          <OverviewFlight c={c} />
          <OverviewBaggage c={c} />
          <OverviewDelivery c={c} />
          <OverviewInternal c={c} />
        </TabsContent>

        <TabsContent value="passenger" className="pt-4">
          <OverviewPassenger c={c} full />
        </TabsContent>
        <TabsContent value="flight" className="pt-4">
          <OverviewFlight c={c} full />
        </TabsContent>
        <TabsContent value="baggage" className="pt-4">
          <OverviewBaggage c={c} full />
        </TabsContent>

        {/* DELIVERY */}
        <TabsContent value="delivery" className="pt-4 space-y-4">
          <OverviewDelivery c={c} full />
          {linkedDelivery ? (
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Linked Delivery {linkedDelivery.deliveryId}
                </CardTitle>
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link to="/delivery">Open Delivery Module</Link>
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <KV k="Status" v={linkedDelivery.status} />
                <KV k="Assigned Driver" v={linkedDelivery.driver} />
                <KV k="Driver Phone" v={linkedDelivery.mobile} />
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

        {/* COMMUNICATION */}
        <TabsContent value="communication" className="pt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChannelCard title="SMS" icon={<MessageSquare className="h-4 w-4" />}
              items={relatedNotifications.filter((n) => n.channel === "sms")} empty="No SMS on this case yet." />
            <ChannelCard title="WhatsApp" icon={<MessageSquare className="h-4 w-4" />}
              items={relatedNotifications.filter((n) => n.channel === "whatsapp")} empty="No WhatsApp messages yet."
              extra={
                <>
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
                </>
              } />
            <ChannelCard title="Email" icon={<Mail className="h-4 w-4" />}
              items={relatedNotifications.filter((n) => n.channel === "email")} empty="No email records on this case." />
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
              <CardTitle className="text-base">Tracking Link &amp; OTP</CardTitle>
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

      </Tabs>

      {/* Edit wizard */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        {editOpen && <PirWizard mode="edit" caseData={c} onClose={() => setEditOpen(false)} />}
      </Dialog>

      {/* Change status dialog */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <ChangeStatusDialog
          current={lfs}
          onConfirm={(target, force, note) => changeStatus(target, force, note)}
          onClose={() => setChangeOpen(false)}
        />
      </Dialog>

      {/* Assign officer dialog */}
      <Dialog open={assignOfficerOpen} onOpenChange={setAssignOfficerOpen}>
        <AssignOfficerDialog
          current={c.internal?.assignedOfficer ?? ""}
          onConfirm={(officer) => {
            editCase(
              c.bagId,
              { internal: { ...(c.internal ?? {}), assignedOfficer: officer } },
              { actor: "Ops Console", note: `Officer assigned: ${officer || "Unassigned"}` },
            );
            setAssignOfficerOpen(false);
            toast.success(officer ? `Assigned to ${officer}` : "Officer cleared");
          }}
          onClose={() => setAssignOfficerOpen(false)}
        />
      </Dialog>
    </div>
  );
}

// ---------- Change Status dialog ----------
function ChangeStatusDialog({
  current, onConfirm, onClose,
}: {
  current: LFStatus;
  onConfirm: (target: LFStatus, force: boolean, note?: string) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<LFStatus>(nextLfStatus(current) ?? current);
  const [note, setNote] = useState("");
  const [force, setForce] = useState(false);
  const backward = !force && !canTransitionLf(current, target) && target !== current;
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Change Status</DialogTitle>
        <p className="text-xs text-muted-foreground">
          Transitions are validated by the Workflow Engine and automatically update
          Timeline, Audit, Notifications, Passenger Tracking, and Delivery.
        </p>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Current</Label>
          <div className="mt-1"><LfStatusBadge status={current} /></div>
        </div>
        <div>
          <Label className="text-xs">New status</Label>
          <Select value={target} onValueChange={(v) => setTarget(v as LFStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LF_OWNED_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Note (optional)</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {backward && (
          <label className="inline-flex items-center gap-2 text-xs text-amber-700">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Override — allow backward / non-linear transition
          </label>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          disabled={backward}
          onClick={() => onConfirm(target, force, note.trim() || undefined)}
        >
          Confirm
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------- Assign Officer dialog ----------
function AssignOfficerDialog({
  current, onConfirm, onClose,
}: {
  current: string;
  onConfirm: (officer: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(current);
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Assign Officer</DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <Label className="text-xs">Officer name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. A. Hassan" autoFocus />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onConfirm(name.trim())}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------- Overview sections ----------
function OverviewPassenger({ c, full }: { c: BaggageCase; full?: boolean }) {
  return (
    <InfoCard title="Passenger" className={full ? "" : ""}>
      <KV k="Full Name" v={c.passengerName} />
      <KV k="PNR" v={c.passenger?.pnr} mono />
      <KV k="Mobile 1" v={c.contact} />
      <KV k="Mobile 2" v={c.passenger?.mobile2} />
      <KV k="Email" v={c.email} />
    </InfoCard>
  );
}
function OverviewFlight({ c }: { c: BaggageCase; full?: boolean }) {
  return (
    <InfoCard title="Flight">
      <KV k="Airline" v={c.flight?.airline} />
      <KV k="Flight No." v={c.flightNumber} mono />
      <KV k="Flight Date" v={c.arrivalDate} />
      <KV k="Origin" v={c.flight?.originAirport} mono />
      <KV k="Destination" v={c.flight?.destinationAirport} mono />
    </InfoCard>
  );
}
function OverviewBaggage({ c }: { c: BaggageCase; full?: boolean }) {
  const tags = c.baggage?.bagTags && c.baggage.bagTags.length > 0
    ? c.baggage.bagTags
    : (c.bagTagNumber ? [c.bagTagNumber] : []);
  return (
    <InfoCard title="Baggage">
      <KV k="Number Of Bags" v={c.baggage?.numberOfBags?.toString()} />
      <KV k="Weight" v={c.baggage?.weightKg ? `${c.baggage.weightKg} kg` : undefined} />
      <KV k="Color" v={c.baggage?.color} />
      <KV k="Type" v={c.baggage?.type} />
      <KV k="Distinctive Marks" v={c.baggage?.distinctiveMarks} />
      <div className="col-span-full pt-2 border-t mt-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
          Bag Tags ({tags.length})
        </p>
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-muted/40 font-mono text-xs"
              >
                <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                {t}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground italic text-xs">No bag tags recorded.</p>
        )}
      </div>
    </InfoCard>
  );
}
function OverviewDelivery({ c, full }: { c: BaggageCase; full?: boolean }) {
  const legacyAddress = [
    c.delivery?.building, c.delivery?.street, c.delivery?.district,
    c.delivery?.city, c.delivery?.governorate, c.delivery?.country,
  ].filter(Boolean).join(", ");
  const address = c.delivery?.fullAddress || legacyAddress;
  return (
    <InfoCard title="Delivery Address" className={full ? "" : ""}>
      <KV k="Method" v={c.delivery?.method} />
      <div className="col-span-full pt-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Full Delivery Address
        </p>
        {address ? (
          <p className="text-sm whitespace-pre-line">{address}</p>
        ) : (
          <p className="text-muted-foreground italic text-xs">No address recorded.</p>
        )}
      </div>
    </InfoCard>
  );
}
function OverviewInternal({ c }: { c: BaggageCase }) {
  return (
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
  );
}

// ---------- Channel card ----------
function ChannelCard({
  title, icon, items, empty, extra,
}: {
  title: string;
  icon: React.ReactNode;
  items: NotificationEvent[];
  empty: string;
  extra?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length ? (
          items.map((n) => (
            <div key={n.id} className="text-xs border rounded p-2 bg-muted/30">
              <div className="flex justify-between text-muted-foreground">
                <span>{n.locale.toUpperCase()} · {n.status_}</span>
                <span>{new Date(n.createdAt).toLocaleString("en-GB")}</span>
              </div>
              {n.message.subject && (
                <div className="font-medium mt-1">{n.message.subject}</div>
              )}
              <div className="mt-1">{n.message.body}</div>
            </div>
          ))
        ) : (
          <Empty text={empty} />
        )}
        {extra}
      </CardContent>
    </Card>
  );
}

// ---------- Common ----------
function HeaderKV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</span>
      <div className={mono ? "font-mono text-xs" : "text-xs"}>{v}</div>
    </div>
  );
}

function InfoCard({
  title, children, className = "",
}: {
  title: string; children: React.ReactNode; className?: string;
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


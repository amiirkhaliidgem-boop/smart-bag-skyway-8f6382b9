import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStore,
  updateCase,
  editCase,
  updateLfStatus,
  addCaseDocument,
  removeCaseDocument,
  createTestNotification,
  type BaggageCase,
  type CaseDocument,
  type NotificationEvent,
  type WorkflowRecord,
} from "@/lib/store";
import {
  LF_STATUSES,
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
  FileText, Upload, Trash2, MapPin, Radar, History as HistoryIcon,
  ShieldAlert, Star as StarIcon, ExternalLink, Pencil, MoreHorizontal,
  UserCog, Bell, Link as LinkIcon, Copy, Printer, Download, XCircle,
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
  const vip = c.baggage?.vipPassenger || priority === "VIP";
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
  const relatedAudit = audit.filter(
    (a) =>
      (a.entityType === "case" && a.entityId === c.bagId) ||
      (a.entityType === "delivery" && a.entityId === linkedDelivery?.deliveryId) ||
      (a.entityType === "notification" &&
        relatedNotifications.some((n) => n.id === a.entityId)),
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
  const trackingUrl = wf ? `${window.location.origin}/passenger/${wf.token}` : null;

  function copyTrackingLink() {
    if (!trackingUrl) {
      toast.error("No tracking link — link a delivery first.");
      return;
    }
    navigator.clipboard?.writeText(trackingUrl);
    toast.success("Tracking link copied");
  }
  function generateTrackingLink() {
    if (!trackingUrl) {
      toast.info("Tracking link is generated when a delivery record is linked. Open Delivery Management to create one.");
      return;
    }
    copyTrackingLink();
  }
  function notifyPassenger() {
    if (!linkedDelivery) {
      toast.info("Notifications require a linked delivery — open Delivery Management to create one.");
      return;
    }
    const events = createTestNotification({
      deliveryId: linkedDelivery.deliveryId,
      channel: "sms",
      operator: "Ops Console",
    });
    if (events.length) toast.success(`Notification queued (${events.length} messages)`);
    else toast.error("No template available for current workflow status.");
  }
  function assignDelivery() {
    if (linkedDelivery) {
      navigate({ to: "/delivery" });
    } else {
      navigate({ to: "/delivery" });
      toast.info("Create a delivery for this case in the Delivery module.");
    }
  }
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
  function closeCase() {
    if (lfs === "Closed") return;
    updateLfStatus(c!.bagId, "Closed", { actor: "Ops Console", force: true, note: "Closed via quick actions" });
    toast.success("Case closed");
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
                  <DropdownMenuItem onClick={assignDelivery}>
                    <Truck className="h-4 w-4 mr-2" /> Assign Delivery
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={notifyPassenger}>
                    <Bell className="h-4 w-4 mr-2" /> Notify Passenger
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={generateTrackingLink}>
                    <LinkIcon className="h-4 w-4 mr-2" /> Generate Tracking Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyTrackingLink}>
                    <Copy className="h-4 w-4 mr-2" /> Copy Tracking Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={printPir}>
                    <Printer className="h-4 w-4 mr-2" /> Print PIR
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCase}>
                    <Download className="h-4 w-4 mr-2" /> Export Case
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={closeCase}
                    className="text-rose-600"
                    disabled={lfs === "Closed"}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Close Case
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
          <TabsTrigger value="documents">
            Documents {c.documents?.length ? `(${c.documents.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
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

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="pt-4">
          <DocumentsPanel bagId={c.bagId} docs={c.documents ?? []} />
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="pt-4 space-y-4">
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
          <TracingPanel c={c} />
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
              {LF_STATUSES.map((s) => (
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
      <KV k="Nationality" v={c.passenger?.nationality} />
      <KV k="Passport" v={c.passenger?.passportNumber} mono />
      <KV k="PNR" v={c.passenger?.pnr} mono />
      <KV k="Ticket" v={c.passenger?.ticketNumber} mono />
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
      <KV k="VIP" v={c.baggage?.vipPassenger ? "Yes" : undefined} />
      <KV k="Rush" v={c.baggage?.rushDelivery ? "Yes" : undefined} />
      <KV k="Fragile" v={c.baggage?.fragile ? "Yes" : undefined} />
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
                    variant="ghost" size="sm" className="h-8"
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
  notifs: NotificationEvent[],
  wf?: WorkflowRecord,
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
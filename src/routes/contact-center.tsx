import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useStore,
  type WhatsAppMessage,
  type BaggageCase,
  type Delivery,
  type WorkflowRecord,
  type CallLog,
  type Feedback,
  type QualityIncident,
  type NotificationEvent,
  addCallLog,
  createTestNotification,
} from "@/lib/store";
import type { AuditEntry } from "@/lib/audit/log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { WORKFLOW_LABELS } from "@/lib/workflow/statuses";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneCall,
  MessageCircle,
  Smile,
  ClipboardList,
  Users,
  ShieldAlert,
  Send,
  Mail,
  Copy,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  ArrowUpRight,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/contact-center")({
  head: () => ({ meta: [{ title: "Contact Center — Smart Baggage Ecosystem" }] }),
  component: ContactCenterPage,
});

function ContactCenterPage() {
  const cases = useStore((s) => s.cases);
  const calls = useStore((s) => s.callLogs);
  const whatsapp = useStore((s) => s.whatsapp);
  const feedback = useStore((s) => s.feedback);
  const incidents = useStore((s) => s.qualityIncidents);
  const notifications = useStore((s) => s.notifications);
  const deliveries = useStore((s) => s.deliveries);
  const workflow = useStore((s) => s.workflow);
  const audit = useStore((s) => s.audit);

  const openCases = cases.filter((c) => c.status !== "Delivered").length;
  const closedCases = cases.filter((c) => c.status === "Delivered").length;
  const callsToday = calls.length;
  const waConversations = whatsapp.length;
  const csat = feedback.length
    ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
    : 0;
  const pendingFollowups = calls.filter(
    (c) => c.direction === "Callback Required" || c.direction === "No Answer",
  ).length;

  const kpis = [
    { label: "Open Cases", value: openCases, icon: ClipboardList, tone: "amber" },
    { label: "Closed Cases", value: closedCases, icon: Users, tone: "emerald" },
    { label: "Calls Today", value: callsToday, icon: PhoneCall, tone: "primary" },
    { label: "WhatsApp Chats", value: waConversations, icon: MessageCircle, tone: "indigo" },
    { label: "CSAT", value: `${csat.toFixed(1)}/5`, icon: Smile, tone: "rose" },
    { label: "Pending Follow-ups", value: pendingFollowups, icon: PhoneMissed, tone: "amber" },
    { label: "Quality Incidents", value: incidents.length, icon: ShieldAlert, tone: "rose" },
  ];
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    indigo: "bg-indigo-100 text-indigo-700",
    rose: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contact Center Operations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Unified view of inbound calls, WhatsApp conversations, and passenger follow-ups.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className={`h-9 w-9 rounded-lg grid place-items-center ${tones[k.tone]}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-xl font-bold tabular-nums">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="conversations">
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="calls">Call Log</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="incidents">
            Quality Incidents{incidents.length ? ` (${incidents.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="outbox">
            Notification Outbox{notifications.length ? ` (${notifications.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="timeline">Communication Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="mt-4">
          <ConversationsView
            cases={cases}
            deliveries={deliveries}
            workflow={workflow}
            calls={calls}
            whatsapp={whatsapp}
            feedback={feedback}
            incidents={incidents}
            notifications={notifications}
            audit={audit}
          />
        </TabsContent>

        <TabsContent value="calls" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Direction</th>
                      <th className="text-left px-4 py-3 font-medium">Passenger</th>
                      <th className="text-left px-4 py-3 font-medium">Phone</th>
                      <th className="text-left px-4 py-3 font-medium">PIR</th>
                      <th className="text-left px-4 py-3 font-medium">Agent</th>
                      <th className="text-left px-4 py-3 font-medium">Duration</th>
                      <th className="text-left px-4 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {calls.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3"><DirectionBadge dir={c.direction} /></td>
                        <td className="px-4 py-3">{c.passengerName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.pirNumber ?? "—"}</td>
                        <td className="px-4 py-3">{c.agent}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {c.durationSec > 0
                            ? `${Math.floor(c.durationSec / 60)}:${String(c.durationSec % 60).padStart(2, "0")}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-md">{c.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppView conversations={whatsapp} />
        </TabsContent>

        <TabsContent value="outbox" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Notification Outbox
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No outbound messages yet. SMS/WhatsApp notifications triggered by workflow
                  transitions will queue here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Channel</th>
                        <th className="text-left px-4 py-3 font-medium">Locale</th>
                        <th className="text-left px-4 py-3 font-medium">To</th>
                        <th className="text-left px-4 py-3 font-medium">Trigger</th>
                        <th className="text-left px-4 py-3 font-medium">Message</th>
                        <th className="text-left px-4 py-3 font-medium">Sent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {notifications.map((n) => (
                        <tr key={n.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 text-xs uppercase font-semibold">{n.channel}</td>
                          <td className="px-4 py-3 text-xs uppercase">{n.locale}</td>
                          <td className="px-4 py-3 font-mono text-xs">{n.to}</td>
                          <td className="px-4 py-3 font-mono text-[10px]">{n.status}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-md">
                            {n.message.body}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(n.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                Quality Incidents
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No quality incidents reported. Passenger-flagged issues from the
                  Passenger Portal will appear here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">ID</th>
                        <th className="text-left px-4 py-3 font-medium">Category</th>
                        <th className="text-left px-4 py-3 font-medium">Severity</th>
                        <th className="text-left px-4 py-3 font-medium">Passenger</th>
                        <th className="text-left px-4 py-3 font-medium">Driver</th>
                        <th className="text-left px-4 py-3 font-medium">Bag</th>
                        <th className="text-left px-4 py-3 font-medium">Reported</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {incidents.map((i) => (
                        <tr key={i.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 font-mono text-xs">{i.id}</td>
                          <td className="px-4 py-3">{i.category}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                i.severity === "High"
                                  ? "bg-rose-100 text-rose-700"
                                  : i.severity === "Medium"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {i.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3">{i.passengerName}</td>
                          <td className="px-4 py-3">{i.driver}</td>
                          <td className="px-4 py-3 font-mono text-xs">{i.bagId}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(i.at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                              {i.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Passenger Communication Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative border-l-2 border-border pl-5 space-y-5">
                {[...calls.map((c) => ({
                  at: c.at,
                  kind: "call" as const,
                  title: `${c.direction} call · ${c.passengerName}`,
                  detail: c.notes,
                  agent: c.agent,
                })),
                ...whatsapp.flatMap((w) =>
                  w.thread.map((t) => ({
                    at: t.at,
                    kind: "wa" as const,
                    title: `WhatsApp · ${w.passengerName} (${t.from})`,
                    detail: t.text,
                    agent: t.from === "Agent" ? "Agent" : "—",
                  })),
                )]
                  .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                  .map((e, i) => (
                    <li key={i} className="relative">
                      <span
                        className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-background ${
                          e.kind === "call" ? "bg-primary" : "bg-emerald-500"
                        }`}
                      />
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(e.at).toLocaleString()} · {e.agent}
                      </p>
                      <p className="text-sm mt-1">{e.detail}</p>
                    </li>
                  ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DirectionBadge({ dir }: { dir: string }) {
  const map: Record<string, { c: string; Icon: React.ComponentType<{ className?: string }> }> = {
    Inbound: { c: "bg-emerald-100 text-emerald-700", Icon: PhoneIncoming },
    Outbound: { c: "bg-blue-100 text-blue-700", Icon: PhoneOutgoing },
    "No Answer": { c: "bg-rose-100 text-rose-700", Icon: PhoneMissed },
    "Callback Required": { c: "bg-amber-100 text-amber-700", Icon: PhoneCall },
  };
  const { c, Icon } = map[dir] ?? map.Inbound;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${c}`}>
      <Icon className="h-3 w-3" /> {dir}
    </span>
  );
}

function WhatsAppView({ conversations }: { conversations: WhatsAppMessage[] }) {
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const selected = conversations.find((c) => c.id === selectedId) ?? conversations[0];
  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-3 min-h-[420px]">
          <div className="border-r border-border md:col-span-1">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left p-3 border-b border-border transition-colors ${
                  selected?.id === c.id ? "bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{c.passengerName}</p>
                  {c.unread > 0 && (
                    <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                      {c.unread}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(c.at).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
          <div className="md:col-span-2 p-4 bg-muted/20 space-y-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Select a conversation.
              </p>
            ) : (
              <>
                <div className="border-b border-border pb-2">
                  <p className="font-semibold">{selected.passengerName}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {selected.phone} · PIR {selected.pirNumber}
                  </p>
                </div>
                <div className="space-y-2">
                  {selected.thread.map((t, i) => (
                    <div
                      key={i}
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        t.from === "Agent"
                          ? "bg-emerald-500 text-white ml-auto"
                          : "bg-white border border-border"
                      }`}
                    >
                      <p>{t.text}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          t.from === "Agent" ? "text-white/70" : "text-muted-foreground"
                        }`}
                      >
                        {new Date(t.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Conversations View ----------

type ConversationsProps = {
  cases: BaggageCase[];
  deliveries: Delivery[];
  workflow: WorkflowRecord[];
  calls: CallLog[];
  whatsapp: WhatsAppMessage[];
  feedback: Feedback[];
  incidents: QualityIncident[];
  notifications: NotificationEvent[];
  audit: AuditEntry[];
};

function ConversationsView(p: ConversationsProps) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const items = useMemo(() => {
    return p.cases
      .map((c) => {
        const del = p.deliveries.find((d) => d.bagId === c.bagId);
        const wf = del ? p.workflow.find((w) => w.deliveryId === del.deliveryId) : undefined;
        return { c, del, wf };
      })
      .filter((x) => {
        if (statusFilter === "open" && x.c.status === "Delivered") return false;
        if (statusFilter === "closed" && x.c.status !== "Delivered") return false;
        if (q) {
          const s = q.toLowerCase();
          const hay = `${x.c.passengerName} ${x.c.pirNumber} ${x.c.bagId} ${x.del?.deliveryId ?? ""} ${x.c.contact}`.toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      });
  }, [p.cases, p.deliveries, p.workflow, q, statusFilter]);

  const [selectedBag, setSelectedBag] = useState<string | undefined>(items[0]?.c.bagId);
  const active = items.find((i) => i.c.bagId === selectedBag) ?? items[0];

  const relatedNotifications = active
    ? p.notifications.filter((n) => active.del && n.deliveryId === active.del.deliveryId)
    : [];
  const relatedCalls = active ? p.calls.filter((c) => c.bagId === active.c.bagId || c.pirNumber === active.c.pirNumber) : [];
  const relatedWa = active ? p.whatsapp.filter((w) => w.pirNumber === active.c.pirNumber) : [];
  const relatedFeedback = active ? p.feedback.filter((f) => f.bagId === active.c.bagId) : [];
  const relatedIncidents = active ? p.incidents.filter((i) => i.bagId === active.c.bagId) : [];
  const relatedAudit = active
    ? p.audit.filter((a) => a.entityId === active.del?.deliveryId || a.entityId === active.c.bagId)
    : [];

  const trackingUrl = active?.wf ? `${typeof window !== "undefined" ? window.location.origin : ""}/passenger/${active.wf.token}` : "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Passenger Cases</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7 h-8" placeholder="Search passenger, PIR, delivery…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-1 mt-2">
            {(["all", "open", "closed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[11px] px-2 py-1 rounded-full font-medium capitalize ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[560px] overflow-y-auto">
          {items.length === 0 && <p className="text-sm text-muted-foreground p-6 text-center">No matching cases.</p>}
          {items.map(({ c, del, wf }) => (
            <button
              key={c.bagId}
              onClick={() => setSelectedBag(c.bagId)}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${active?.c.bagId === c.bagId ? "bg-primary/5" : "hover:bg-muted/50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm truncate">{c.passengerName}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c.status === "Delivered" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{c.status}</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">PIR {c.pirNumber} · {del?.deliveryId ?? c.bagId}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{wf ? WORKFLOW_LABELS[wf.status].en : c.status}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        {!active ? (
          <CardContent className="p-10 text-center text-sm text-muted-foreground">Select a conversation.</CardContent>
        ) : (
          <CardContent className="p-5 space-y-5">
            {/* Passenger profile */}
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div>
                <p className="text-lg font-semibold">{active.c.passengerName}</p>
                <p className="text-xs text-muted-foreground">Flight {active.c.flightNumber} · Arrived {active.c.arrivalDate}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => { addCallLog({ passengerName: active.c.passengerName, phone: active.c.contact, agent: "Contact Center", direction: "Outbound", durationSec: 0, notes: "Manual call initiated", pirNumber: active.c.pirNumber, bagId: active.c.bagId }); toast.success("Call logged"); }}><PhoneCall className="h-3.5 w-3.5 mr-1" />Call</Button>
                <Button size="sm" variant="secondary" onClick={() => { if (active.del) { createTestNotification({ deliveryId: active.del.deliveryId, channel: "sms", operator: "Contact Center" }); toast.success("SMS queued"); } }}><Send className="h-3.5 w-3.5 mr-1" />SMS</Button>
                <Button size="sm" variant="secondary" onClick={() => { if (active.del) { createTestNotification({ deliveryId: active.del.deliveryId, channel: "whatsapp", operator: "Contact Center" }); toast.success("WhatsApp queued"); } }}><MessageCircle className="h-3.5 w-3.5 mr-1" />WhatsApp</Button>
                <Button size="sm" variant="secondary" onClick={() => { if (active.del) { createTestNotification({ deliveryId: active.del.deliveryId, channel: "email", operator: "Contact Center" }); toast.success("Email queued"); } }}><Mail className="h-3.5 w-3.5 mr-1" />Email</Button>
                {trackingUrl && <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(trackingUrl); toast.success("Tracking link copied"); }}><Copy className="h-3.5 w-3.5 mr-1" />Copy Link</Button>}
                <Button size="sm" variant="secondary" onClick={() => toast.success("New tracking link generated")}><RefreshCw className="h-3.5 w-3.5 mr-1" />New Link</Button>
                <Button size="sm" variant="secondary" onClick={() => toast.success("OTP resent to passenger")}><ShieldCheck className="h-3.5 w-3.5 mr-1" />Resend OTP</Button>
                <Button size="sm" variant="secondary" onClick={() => toast.info("Escalated to supervisor")}><ArrowUpRight className="h-3.5 w-3.5 mr-1" />Escalate</Button>
                <Button size="sm" variant="secondary" onClick={() => toast.success("Employee assigned")}><UserPlus className="h-3.5 w-3.5 mr-1" />Assign</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <ProfileField k="PIR" v={active.c.pirNumber} mono />
              <ProfileField k="Delivery ID" v={active.del?.deliveryId ?? "—"} mono />
              <ProfileField k="Phone" v={active.c.contact} mono />
              <ProfileField k="Email" v={active.c.email} />
              <ProfileField k="Workflow" v={active.wf ? WORKFLOW_LABELS[active.wf.status].en : "—"} />
              <ProfileField k="Delivery Status" v={active.del?.status ?? "—"} />
              <ProfileField k="Driver" v={active.del?.driver ?? "—"} />
              <ProfileField k="OTP" v={active.del?.otpStatus ?? "—"} />
            </div>

            {/* Communication history */}
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Communication History</p>
              <div className="border border-border rounded-md divide-y divide-border max-h-72 overflow-y-auto">
                {[
                  ...relatedNotifications.map((n) => ({ at: n.createdAt, kind: `${n.channel.toUpperCase()} · ${n.status_}`, text: n.message.body })),
                  ...relatedCalls.map((c) => ({ at: c.at, kind: `Call · ${c.direction}`, text: c.notes })),
                  ...relatedWa.flatMap((w) => w.thread.map((t) => ({ at: t.at, kind: `WhatsApp · ${t.from}`, text: t.text }))),
                ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).map((e, i) => (
                  <div key={i} className="p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase font-medium text-primary">{e.kind}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm">{e.text}</p>
                  </div>
                ))}
                {relatedNotifications.length + relatedCalls.length + relatedWa.length === 0 && (
                  <p className="text-xs text-muted-foreground p-4 text-center">No communication yet for this case.</p>
                )}
              </div>
            </div>

            {/* Feedback + Incidents + Audit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MiniList title="Feedback" empty="No feedback" rows={relatedFeedback.map((f) => `${f.rating}★ — ${f.comments}`)} />
              <MiniList title="Quality Incidents" empty="No incidents" rows={relatedIncidents.map((i) => `${i.severity} · ${i.category}`)} />
              <MiniList title="Audit Log" empty="No audit entries" rows={relatedAudit.slice(0, 10).map((a) => `${a.action} · ${a.actor}`)} />
            </div>

            {/* Internal notes */}
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Internal Notes</p>
              <div className="flex gap-2">
                <Input placeholder="Add an internal note (visible to Contact Center only)" value={notes[active.c.bagId] ?? ""} onChange={(e) => setNotes({ ...notes, [active.c.bagId]: e.target.value })} />
                <Button onClick={() => { const t = notes[active.c.bagId]?.trim(); if (!t) return; addCallLog({ passengerName: active.c.passengerName, phone: active.c.contact, agent: "Contact Center", direction: "Callback Required", durationSec: 0, notes: `Note: ${t}`, pirNumber: active.c.pirNumber, bagId: active.c.bagId }); setNotes({ ...notes, [active.c.bagId]: "" }); toast.success("Note saved"); }}>Save</Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function ProfileField({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{k}</p>
      <p className={`text-sm ${mono ? "font-mono" : ""}`}>{v}</p>
    </div>
  );
}

function MiniList({ title, rows, empty }: { title: string; rows: string[]; empty: string }) {
  return (
    <div className="border border-border rounded-md p-3">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="text-xs space-y-1">
          {rows.map((r, i) => <li key={i} className="truncate">{r}</li>)}
        </ul>
      )}
    </div>
  );
}
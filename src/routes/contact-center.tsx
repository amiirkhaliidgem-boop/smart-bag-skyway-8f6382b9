import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, type WhatsAppMessage } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneCall,
  MessageCircle,
  Smile,
  ClipboardList,
  Users,
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

      <Tabs defaultValue="calls">
        <TabsList>
          <TabsTrigger value="calls">Call Log</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="timeline">Communication Timeline</TabsTrigger>
        </TabsList>

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
import { createFileRoute } from "@tanstack/react-router";
import { DateRangeFilter, defaultDateRange } from "@/components/filters/date-range-filter";
import { useMemo, useState } from "react";
import { useStore, useOpsLoading, type NotificationEvent } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  MessageSquare,
  Mail,
  Smartphone,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  triggerLabel,
  type NotificationChannel,
  type NotificationTrigger,
} from "@/lib/notifications/templates";
import { PageLoading } from "@/components/ops-skeleton";
import { PageHeader, DataTable, type DataColumn } from "@/components/layout";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Center — IAB Smart Baggage" },
      {
        name: "description",
        content: "Central log and preview of every workflow-driven passenger notification.",
      },
    ],
  }),
  component: NotificationCenter,
});

const CHANNEL_META: Record<NotificationChannel, { label: string; icon: typeof Mail }> = {
  sms: { label: "SMS", icon: Smartphone },
  whatsapp: { label: "WhatsApp", icon: MessageSquare },
  email: { label: "Email", icon: Mail },
  push: { label: "Push", icon: Bell },
};

function NotificationCenter() {
  const notifications = useStore((s) => s.notifications);
  const loading = useOpsLoading();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(() => defaultDateRange().from);
  const [dateTo, setDateTo] = useState(() => defaultDateRange().to);
  const [passengerFilter, setPassengerFilter] = useState<string>("");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (statusFilter !== "all" && n.status_ !== statusFilter) return false;
      if (channelFilter !== "all" && n.channel !== channelFilter) return false;
      const day = n.createdAt.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (
        passengerFilter &&
        !(n.passengerName ?? "").toLowerCase().includes(passengerFilter.toLowerCase())
      )
        return false;
      if (deliveryFilter && !n.deliveryId.toLowerCase().includes(deliveryFilter.toLowerCase()))
        return false;
      return true;
    });
  }, [
    notifications,
    statusFilter,
    channelFilter,
    dateFrom,
    dateTo,
    passengerFilter,
    deliveryFilter,
  ]);

  const selected =
    notifications.find((n) => n.id === selectedId) ?? filtered[0] ?? notifications[0] ?? null;

  const counts = useMemo(() => {
    return {
      total: notifications.length,
      queued: notifications.filter((n) => n.status_ === "queued").length,
      sending: notifications.filter((n) => n.status_ === "sending").length,
      sent: notifications.filter((n) => n.status_ === "sent").length,
      failed: notifications.filter((n) => n.status_ === "failed").length,
    };
  }, [notifications]);

  // Progressive loading: render the page shell with placeholders while this
  // screen's data tier is still in flight, instead of showing empty values.
  if (loading.activity && notifications.length === 0)
    return <PageLoading title={"Notification Center"} kpis={5} />;

  const columns: DataColumn<NotificationEvent>[] = [
    {
      id: "passenger",
      header: "Passenger",
      minWidth: "160px",
      sortValue: (n) => n.passengerName ?? "",
      cell: (n) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{n.passengerName ?? "—"}</div>
          <div className="truncate text-[11px] text-muted-foreground">{n.to}</div>
        </div>
      ),
    },
    {
      id: "reference",
      header: "PIR / Delivery",
      hideBelow: "md",
      sortValue: (n) => n.pirNumber ?? "",
      cell: (n) => (
        <div className="min-w-0">
          <div className="font-mono text-xs">{n.pirNumber ?? "—"}</div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{n.deliveryId}</div>
        </div>
      ),
    },
    {
      id: "channel",
      header: "Channel",
      hideBelow: "sm",
      sortValue: (n) => n.channel,
      cell: (n) => {
        const ChIcon = CHANNEL_META[n.channel].icon;
        return (
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <ChIcon className="h-3.5 w-3.5" />
              {CHANNEL_META[n.channel].label}
            </span>
            <div className="text-[11px] uppercase text-muted-foreground">{n.locale}</div>
          </div>
        );
      },
    },
    {
      id: "trigger",
      header: "Trigger",
      hideBelow: "lg",
      sortValue: (n) => triggerLabel(n.triggerKey as NotificationTrigger),
      cell: (n) => (
        <span className="text-xs">{triggerLabel(n.triggerKey as NotificationTrigger)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (n) => n.status_,
      cell: (n) => <StatusPill status={n.status_} />,
    },
    {
      id: "time",
      header: "Time",
      hideBelow: "sm",
      sortValue: (n) => n.sentAt ?? n.createdAt,
      cell: (n) => (
        <div className="whitespace-nowrap text-xs">
          {new Date(n.sentAt ?? n.createdAt).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })}
          <div className="text-[11px] text-muted-foreground">{n.operator ?? "system"}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Notification Center" icon={<Bell />} />

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0 mt-px text-muted-foreground" />
        <p>
          Read-only monitor. Passenger notifications are generated automatically by the Workflow
          Engine on every operational transition — they cannot be created, edited or sent manually
          from this screen.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total" value={counts.total} icon={Bell} />
        <Kpi label="Queued" value={counts.queued} icon={Clock} tone="warning" />
        <Kpi
          label="Sending"
          value={counts.sending}
          icon={Loader2}
          tone="info"
          spin={counts.sending > 0}
        />
        <Kpi label="Sent" value={counts.sent} icon={CheckCircle2} tone="success" />
        <Kpi label="Failed" value={counts.failed} icon={AlertTriangle} tone="danger" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5 [&>*]:min-w-0">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Channel</Label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(Object.keys(CHANNEL_META) as NotificationChannel[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHANNEL_META[c].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Label className="text-xs">Date range</Label>
            <DateRangeFilter
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Passenger</Label>
            <Input
              placeholder="Name"
              value={passengerFilter}
              onChange={(e) => setPassengerFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Delivery ID</Label>
            <Input
              placeholder="DEL-..."
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <DataTable
            data={filtered}
            columns={columns}
            rowId={(n) => n.id}
            ariaLabel="Notification events"
            searchText={(n) =>
              [n.passengerName, n.to, n.pirNumber, n.deliveryId, n.channel, n.status_].join(" ")
            }
            searchPlaceholder="Search notifications…"
            onRowClick={(n) => setSelectedId(n.id)}
            activeRowId={selected?.id ?? null}
            emptyTitle="No notifications"
            emptyDescription="No notifications match the current filters."
            emptyIcon={<Bell />}
            maxHeight="520px"
            pageSize={25}
          />
        </div>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Message Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected && (
              <p className="text-sm text-muted-foreground">
                Select a notification to preview the exact bilingual message that will be sent.
              </p>
            )}
            {selected && (
              <>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
                  <Row k="Notification ID" v={selected.id} mono />
                  <Row k="Passenger" v={selected.passengerName ?? "—"} />
                  <Row k="PIR Number" v={selected.pirNumber ?? "—"} mono />
                  <Row k="Delivery ID" v={selected.deliveryId} mono />
                  <Row k="Channel" v={CHANNEL_META[selected.channel].label} />
                  <Row k="Trigger" v={triggerLabel(selected.triggerKey as NotificationTrigger)} />
                  <Row k="Language" v={selected.locale === "ar" ? "Arabic" : "English"} />
                  <Row k="Operator" v={selected.operator ?? "system"} />
                  <Row
                    k="Time"
                    v={new Date(selected.sentAt ?? selected.createdAt).toLocaleString("en-GB")}
                  />
                  <Row k="Provider" v={selected.provider ?? "—"} />
                  <Row k="Provider Message ID" v={selected.providerId ?? "—"} mono />
                  <Row k="Attempts" v={String(selected.attempts ?? 0)} />
                  {selected.failureReason && <Row k="Last Failure" v={selected.failureReason} />}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      English
                    </p>
                    {selected.messageEn && <StatusPill status={selected.status_} />}
                  </div>
                  <div className="rounded-md border border-border p-3 text-sm bg-card whitespace-pre-wrap">
                    {selected.messageEn?.body ?? "Unavailable for this legacy event"}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      العربية
                    </p>
                    {selected.messageAr && <StatusPill status={selected.status_} />}
                  </div>
                  <div
                    dir="rtl"
                    lang="ar"
                    className="rounded-md border border-border p-3 text-sm bg-card whitespace-pre-wrap"
                  >
                    {selected.messageAr?.body ?? "غير متاح لهذا السجل القديم"}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("text-right truncate", mono && "font-mono")}>{v}</span>
    </div>
  );
}

function StatusPill({ status }: { status: NotificationEvent["status_"] }) {
  const map: Record<
    NotificationEvent["status_"],
    { label: string; cls: string; icon: typeof Clock; spin?: boolean }
  > = {
    queued: {
      label: "Queued",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      icon: Clock,
    },
    sending: {
      label: "Sending",
      cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      icon: Loader2,
      spin: true,
    },
    sent: {
      label: "Sent",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      icon: CheckCircle2,
    },
    failed: {
      label: "Failed",
      cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
      icon: AlertTriangle,
    },
  };
  const m = map[status];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all",
        m.cls,
      )}
    >
      <Icon className={cn("h-3 w-3", m.spin && "animate-spin")} />
      {m.label}
    </span>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  spin,
}: {
  label: string;
  value: number | string;
  icon: typeof Bell;
  tone?: "success" | "warning" | "info" | "danger";
  spin?: boolean;
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "info"
          ? "text-sky-600 dark:text-sky-400"
          : tone === "danger"
            ? "text-rose-600 dark:text-rose-400"
            : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={cn("h-4 w-4", toneCls, spin && "animate-spin")} />
      </div>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
    </div>
  );
}

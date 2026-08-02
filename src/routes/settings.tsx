import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Lock, Plus, Trash2, Timer } from "lucide-react";
import iabLogo from "@/assets/iab-logo.jpeg.asset.json";
import { toast } from "sonner";
import { useStore, setStation } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSystemSettings } from "@/lib/settings/use-settings";
import {
  DATE_FORMATS,
  TEMPLATE_TRIGGERS,
  TEMPLATE_VARIABLES,
  TIME_ZONES,
  previewTemplate,
  type ContactSettings,
  type GeneralSettings,
  type NotificationTemplateRow,
  type SlaRegion,
  type TemplateChannel,
} from "@/lib/settings/types";
import {
  deleteSlaRegion,
  saveNotificationTemplate,
  saveSlaRegion,
  saveSystemSettings,
} from "@/lib/settings.functions";
import { PageLoading } from "@/components/ops-skeleton";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "System Settings — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Live configuration centre for the Smart Baggage Ecosystem — general setup, SLA targets, notification templates and passenger contact details.",
      },
      { property: "og:title", content: "System Settings — IAB Smart Baggage Ecosystem" },
      {
        property: "og:description",
        content: "Database-backed configuration driving the workflow, notification and passenger engines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, loading, refresh } = useSystemSettings();
  const canManage = settings.canManage;

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-sm text-muted-foreground">
            Live configuration for the Smart Baggage Ecosystem. Saved values take effect immediately
            across the workflow, notification and passenger engines.
          </p>
        </div>
        {!canManage && (
          <Badge variant="outline" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Read only — Airport Administrator required
          </Badge>
        )}
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sla">SLA Management</TabsTrigger>
          <TabsTrigger value="templates">Notification Templates</TabsTrigger>
          <TabsTrigger value="contacts">Passenger Contacts</TabsTrigger>
          <TabsTrigger value="airport">Airport</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralCard general={settings.general} canManage={canManage} onSaved={refresh} />
        </TabsContent>

        <TabsContent value="sla" className="mt-4 space-y-4">
          <LostFoundSlaCard
            hours={settings.sla.lf_sla_hours}
            canManage={canManage}
            onSaved={refresh}
          />
          <RegionSlaCard regions={settings.regions} canManage={canManage} onSaved={refresh} />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplatesCard templates={settings.templates} canManage={canManage} onSaved={refresh} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ContactsCard contacts={settings.contacts} canManage={canManage} onSaved={refresh} />
        </TabsContent>

        <TabsContent value="airport" className="mt-4">
          <StationCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        value={value}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function GeneralCard({
  general,
  canManage,
  onSaved,
}: {
  general: GeneralSettings;
  canManage: boolean;
  onSaved: () => void;
}) {
  const save = useServerFn(saveSystemSettings);
  const [form, setForm] = useState<GeneralSettings>(general);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(general), [general]);

  const set = (k: keyof GeneralSettings) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as GeneralSettings);

  const submit = async () => {
    if (!form.system_name.trim() || !form.company_name.trim()) {
      toast.error("System name and company name are required.");
      return;
    }
    setBusy(true);
    try {
      await save({ data: { group: "general", payload: { ...form } } });
      toast.success("General settings saved", {
        description: "Applied across every portal in real time.",
      });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">General</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LabeledInput label="System Name" value={form.system_name} onChange={set("system_name")} disabled={!canManage} />
          <LabeledInput label="Company Name" value={form.company_name} onChange={set("company_name")} disabled={!canManage} />
          <LabeledSelect
            label="Time Zone"
            value={form.time_zone}
            disabled={!canManage}
            onChange={set("time_zone")}
            options={TIME_ZONES.map((t) => ({ value: t, label: t }))}
          />
          <LabeledSelect
            label="Date Format"
            value={form.date_format}
            disabled={!canManage}
            onChange={set("date_format")}
            options={DATE_FORMATS.map((t) => ({ value: t, label: t }))}
          />
          <LabeledSelect
            label="Default Language"
            value={form.default_language}
            disabled={!canManage}
            onChange={set("default_language")}
            options={[
              { value: "en", label: "English" },
              { value: "ar", label: "العربية — Arabic" },
            ]}
          />
          <LabeledSelect
            label="Distance Unit"
            value={form.distance_unit}
            disabled={!canManage}
            onChange={set("distance_unit")}
            options={[
              { value: "km", label: "Kilometres (km)" },
              { value: "mi", label: "Miles (mi)" },
            ]}
          />
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-border p-4">
          <img
            src={form.logo_url || iabLogo.url}
            alt={`${form.company_name} logo`}
            className="h-16 w-16 rounded-lg bg-white ring-1 ring-border p-1 object-contain"
          />
          <div className="flex-1">
            <p className="font-medium text-sm">Company Logo</p>
            <p className="text-xs text-muted-foreground mb-2">
              Paste a public image URL. Used across the portals and passenger communications.
            </p>
            <Input
              value={form.logo_url}
              placeholder="https://…/logo.png"
              disabled={!canManage}
              onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!canManage || busy}>
            {busy ? "Saving…" : "Save General Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LostFoundSlaCard({
  hours,
  canManage,
  onSaved,
}: {
  hours: number;
  canManage: boolean;
  onSaved: () => void;
}) {
  const save = useServerFn(saveSystemSettings);
  const [value, setValue] = useState(String(hours));
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(String(hours)), [hours]);

  const submit = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("The Lost & Found SLA must be a positive number of hours.");
      return;
    }
    setBusy(true);
    try {
      await save({ data: { group: "sla", payload: { lf_sla_hours: Math.round(n) } } });
      toast.success("Lost & Found SLA saved", {
        description: "The breach engine uses this target from now on.",
      });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the SLA");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" /> Lost &amp; Found SLA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Maximum time a case may sit between <strong>Arrived at Airport</strong> and{" "}
          <strong>Ready for Delivery</strong>. Exceeding it raises a quality incident and records
          timeline and audit entries automatically.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LabeledInput
            label="SLA target (hours)"
            value={value}
            onChange={setValue}
            disabled={!canManage}
            type="number"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={!canManage || busy}>
            {busy ? "Saving…" : "Save SLA"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const BLANK_REGION: SlaRegion = {
  id: "",
  name: "",
  name_ar: "",
  sla_hours: 24,
  is_default: false,
  active: true,
  sort_order: 0,
};

function RegionSlaCard({
  regions,
  canManage,
  onSaved,
}: {
  regions: SlaRegion[];
  canManage: boolean;
  onSaved: () => void;
}) {
  const upsert = useServerFn(saveSlaRegion);
  const remove = useServerFn(deleteSlaRegion);
  const [draft, setDraft] = useState<SlaRegion | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Region name is required.");
      return;
    }
    const h = Number(draft.sla_hours);
    if (!Number.isFinite(h) || h <= 0) {
      toast.error("SLA hours must be a positive number.");
      return;
    }
    setBusy(true);
    try {
      await upsert({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name.trim(),
          name_ar: draft.name_ar ?? "",
          sla_hours: Math.round(h),
          is_default: draft.is_default,
          active: draft.active,
        },
      });
      toast.success("Delivery SLA saved");
      setDraft(null);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the region");
    } finally {
      setBusy(false);
    }
  };

  const drop = async (id: string) => {
    try {
      await remove({ data: { id } });
      toast.success("Region removed");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the region");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Home Delivery SLA by Region</CardTitle>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setDraft({ ...BLANK_REGION })}>
            <Plus className="h-4 w-4 mr-1" /> Add Region
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Region</TableHead>
              <TableHead>Arabic name</TableHead>
              <TableHead className="w-32">SLA (hours)</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No delivery regions configured yet.
                </TableCell>
              </TableRow>
            )}
            {regions.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.name}
                  {r.is_default && (
                    <Badge variant="secondary" className="ml-2">
                      Default
                    </Badge>
                  )}
                </TableCell>
                <TableCell dir="rtl" className="text-right md:text-left">
                  {r.name_ar || "—"}
                </TableCell>
                <TableCell>{r.sla_hours}</TableCell>
                <TableCell>
                  <Badge variant={r.active ? "outline" : "secondary"}>
                    {r.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!canManage}
                    onClick={() => setDraft({ ...r })}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!canManage || r.is_default}
                    onClick={() => drop(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {draft && (
          <div className="rounded-lg border border-border p-4 space-y-4">
            <p className="text-sm font-medium">{draft.id ? "Edit region" : "New region"}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <LabeledInput
                label="Region name"
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
              />
              <LabeledInput
                label="Arabic name"
                value={draft.name_ar}
                onChange={(v) => setDraft({ ...draft, name_ar: v })}
              />
              <LabeledInput
                label="SLA (hours)"
                type="number"
                value={String(draft.sla_hours)}
                onChange={(v) => setDraft({ ...draft, sla_hours: Number(v) })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.is_default}
                  onCheckedChange={(c) => setDraft({ ...draft, is_default: c })}
                />
                Default region for cases without one
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.active}
                  onCheckedChange={(c) => setDraft({ ...draft, active: c })}
                />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? "Saving…" : "Save Region"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CHANNELS: TemplateChannel[] = ["sms", "whatsapp", "email"];
const CHANNEL_LABEL: Record<TemplateChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

function TemplatesCard({
  templates,
  canManage,
  onSaved,
}: {
  templates: NotificationTemplateRow[];
  canManage: boolean;
  onSaved: () => void;
}) {
  const [trigger, setTrigger] = useState(TEMPLATE_TRIGGERS[0].key);
  const [channel, setChannel] = useState<TemplateChannel>("sms");

  const current = useMemo(
    () => templates.find((t) => t.trigger_key === trigger && t.channel === channel),
    [templates, trigger, channel],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notification Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Notifications are sent automatically by the Workflow Engine. Wording saved here is used
          for the very next message — no redeployment needed.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LabeledSelect
            label="Event"
            value={trigger}
            onChange={setTrigger}
            options={TEMPLATE_TRIGGERS.map((t) => ({ value: t.key, label: t.label }))}
          />
          <LabeledSelect
            label="Channel"
            value={channel}
            onChange={(v) => setChannel(v as TemplateChannel)}
            options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
          />
        </div>
        <TemplateEditor
          key={`${trigger}:${channel}`}
          trigger={trigger}
          channel={channel}
          row={current}
          canManage={canManage}
          onSaved={onSaved}
        />
      </CardContent>
    </Card>
  );
}

function TemplateEditor({
  trigger,
  channel,
  row,
  canManage,
  onSaved,
}: {
  trigger: string;
  channel: TemplateChannel;
  row: NotificationTemplateRow | undefined;
  canManage: boolean;
  onSaved: () => void;
}) {
  const save = useServerFn(saveNotificationTemplate);
  const [subjectEn, setSubjectEn] = useState(row?.subject_en ?? "");
  const [subjectAr, setSubjectAr] = useState(row?.subject_ar ?? "");
  const [bodyEn, setBodyEn] = useState(row?.body_en ?? "");
  const [bodyAr, setBodyAr] = useState(row?.body_ar ?? "");
  const [active, setActive] = useState(row?.active ?? true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!bodyEn.trim()) {
      toast.error("The English body cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          trigger_key: trigger,
          channel,
          subject_en: subjectEn,
          subject_ar: subjectAr,
          body_en: bodyEn,
          body_ar: bodyAr,
          active,
        },
      });
      toast.success("Template saved", { description: "Live from the next notification onwards." });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the template");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        Available variables:{" "}
        {TEMPLATE_VARIABLES.map((v) => (
          <code key={v} className="mx-1 rounded bg-muted px-1.5 py-0.5">
            {v}
          </code>
        ))}
      </div>

      {channel === "email" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LabeledInput label="Subject (English)" value={subjectEn} onChange={setSubjectEn} disabled={!canManage} />
          <LabeledInput label="Subject (Arabic)" value={subjectAr} onChange={setSubjectAr} disabled={!canManage} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Body — English</label>
          <Textarea
            rows={5}
            value={bodyEn}
            disabled={!canManage}
            onChange={(e) => setBodyEn(e.target.value)}
          />
          <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
            {previewTemplate(bodyEn) || "Preview appears here."}
          </p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Body — Arabic</label>
          <Textarea
            rows={5}
            dir="rtl"
            value={bodyAr}
            disabled={!canManage}
            onChange={(e) => setBodyAr(e.target.value)}
          />
          <p dir="rtl" className="mt-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
            {previewTemplate(bodyAr) || "المعاينة تظهر هنا."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={active} disabled={!canManage} onCheckedChange={setActive} />
          Send this notification
        </label>
        <Button onClick={submit} disabled={!canManage || busy}>
          {busy ? "Saving…" : "Save Template"}
        </Button>
      </div>
    </div>
  );
}

function ContactsCard({
  contacts,
  canManage,
  onSaved,
}: {
  contacts: ContactSettings;
  canManage: boolean;
  onSaved: () => void;
}) {
  const save = useServerFn(saveSystemSettings);
  const [form, setForm] = useState<ContactSettings>(contacts);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(contacts), [contacts]);

  const submit = async () => {
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      toast.error("Enter a valid support email address.");
      return;
    }
    setBusy(true);
    try {
      await save({ data: { group: "contacts", payload: { ...form } } });
      toast.success("Passenger contact details saved", {
        description: "Shown on the Passenger Portal and tracking page.",
      });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the contact details");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Passenger Portal Contact Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          These details appear in the passenger&apos;s Need Help card. Leave a field empty to hide
          that contact option.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LabeledInput
            label="Call Us"
            value={form.call_number}
            placeholder="+20 2 2696 0000"
            disabled={!canManage}
            onChange={(v) => setForm({ ...form, call_number: v })}
          />
          <LabeledInput
            label="WhatsApp"
            value={form.whatsapp_number}
            placeholder="+20 100 000 1234"
            disabled={!canManage}
            onChange={(v) => setForm({ ...form, whatsapp_number: v })}
          />
          <LabeledInput
            label="Email"
            value={form.email}
            placeholder="support@iab.aero"
            disabled={!canManage}
            onChange={(v) => setForm({ ...form, email: v })}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={!canManage || busy}>
            {busy ? "Saving…" : "Save Contact Details"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StationCard() {
  const station = useStore((s) => s.station);
  const [code, setCode] = useState(station.code);
  const [name, setName] = useState(station.name);
  const [lat, setLat] = useState(String(station.lat));
  const [lng, setLng] = useState(String(station.lng));
  const save = () => {
    const nlat = Number(lat);
    const nlng = Number(lng);
    if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) {
      toast.error("Latitude and longitude must be valid numbers.");
      return;
    }
    setStation({ code: code.trim(), name: name.trim(), lat: nlat, lng: nlng });
    toast.success("Station updated", {
      description: "Route optimization now uses these coordinates as the origin.",
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Station (Route Optimization Origin)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          These coordinates are the starting point for the driver route optimizer.
          Update them when deploying at a different airport.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Station Code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAI" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Station Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Latitude</label>
            <Input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Longitude</label>
            <Input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save}>Save Station</Button>
        </div>
      </CardContent>
    </Card>
  );
}
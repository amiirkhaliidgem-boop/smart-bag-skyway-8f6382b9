import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plug,
  Database,
  MessageCircle,
  MapPin,
  Mail,
  Smartphone,
  Building2,
  RefreshCw,
  ShieldCheck,
  Unplug,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  ENVIRONMENTS,
  INTEGRATION_DEFINITIONS,
  definitionFor,
  type IntegrationDefinition,
  type IntegrationView,
} from "@/lib/system/catalog";
import {
  disconnectIntegrationConfig,
  loadSystemCenter,
  saveIntegrationConfig,
  testIntegrationConnection,
  toggleIntegration,
} from "@/lib/system.functions";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Integration Center — IAB Smart Baggage Ecosystem" },
      {
        name: "description",
        content:
          "Configure, test and monitor every external service powering the IAB Smart Baggage Ecosystem.",
      },
    ],
  }),
  component: IntegrationsPage,
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  google_maps: MapPin,
  sms_gateway: MessageCircle,
  whatsapp: MessageCircle,
  email: Mail,
  odoo: Building2,
  mobile_platform: Smartphone,
  cloud_database: Database,
};

const STATUS_TONE: Record<string, string> = {
  connected: "bg-emerald-100 text-emerald-700 border-emerald-200",
  error: "bg-rose-100 text-rose-700 border-rose-200",
  disabled: "bg-slate-100 text-slate-700 border-slate-200",
  not_configured: "bg-amber-100 text-amber-700 border-amber-200",
};

const STATUS_LABEL: Record<string, string> = {
  connected: "Connected",
  error: "Error",
  disabled: "Disabled",
  not_configured: "Not configured",
};

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", { timeZone: "UTC", hour12: false });
}

function IntegrationsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<IntegrationView | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["system-center"],
    queryFn: () => loadSystemCenter(),
    refetchInterval: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["system-center"] });

  const test = useMutation({
    mutationFn: (vars: { key: string; testInput?: string }) =>
      testIntegrationConnection({ data: vars }),
    onSuccess: (res, vars) => {
      const name = definitionFor(vars.key)?.name ?? vars.key;
      if (res.ok) toast.success(`${name} connected`, { description: res.detail || `${res.latencyMs} ms` });
      else toast.error(`${name} test failed`, { description: res.error });
      invalidate();
    },
    onError: (e: Error) => toast.error("Connection test failed", { description: e.message }),
  });

  const toggle = useMutation({
    mutationFn: (vars: { key: string; enabled: boolean }) => toggleIntegration({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(vars.enabled ? "Integration enabled" : "Integration disabled");
      invalidate();
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  const disconnect = useMutation({
    mutationFn: (key: string) => disconnectIntegrationConfig({ data: { key } }),
    onSuccess: () => {
      toast.success("Integration disconnected", { description: "Stored credentials were cleared." });
      invalidate();
    },
    onError: (e: Error) => toast.error("Disconnect failed", { description: e.message }),
  });

  const integrations = data?.integrations ?? [];
  const events = data?.events ?? [];
  const connected = integrations.filter((i) => i.status === "connected").length;
  const errored = integrations.filter((i) => i.status === "error").length;
  const withCredentials = integrations.filter((i) => i.secretsSet.length > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Integration Center</h1>
            <p className="text-sm text-muted-foreground">
              Enterprise configuration for every external service. Credentials are encrypted at rest
              and never returned to the browser.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => invalidate()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Integrations" value={integrations.length} />
        <StatCard label="Connected" value={connected} tone="text-emerald-600" />
        <StatCard label="In error" value={errored} tone="text-rose-600" />
        <StatCard
          label="Slots holding credentials"
          value={withCredentials}
          tone="text-primary"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {integrations.map((i) => {
            const def = definitionFor(i.key);
            const Icon = ICONS[i.key] ?? Plug;
            const busy =
              (test.isPending && test.variables?.key === i.key) ||
              (toggle.isPending && toggle.variables?.key === i.key);
            return (
              <Card key={i.key} className="flex flex-col">
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{i.name}</p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${STATUS_TONE[i.status]}`}
                        >
                          {STATUS_LABEL[i.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{def?.description}</p>
                    </div>
                    {!def?.managed && (
                      <Switch
                        checked={i.enabled}
                        disabled={busy || !i.configured}
                        onCheckedChange={(v) => toggle.mutate({ key: i.key, enabled: v })}
                        aria-label={`Enable ${i.name}`}
                        title={i.configured ? undefined : "Configure credentials first"}
                      />
                    )}
                  </div>

                  <dl className="mt-4 space-y-1 text-[11px]">
                    <Row label="Provider" value={i.provider || "—"} />
                    <Row label="Environment" value={i.environment} />
                    <Row
                      label="Credentials"
                      value={i.secretsSet.length ? `${i.secretsSet.length} stored (encrypted)` : "None"}
                    />
                    <Row label="Last success" value={fmt(i.lastSuccessAt)} />
                    <Row
                      label="Latency"
                      value={i.lastLatencyMs != null ? `${i.lastLatencyMs} ms` : "—"}
                    />
                  </dl>

                  {i.status === "error" && i.lastError && (
                    <p className="mt-3 text-[11px] text-rose-600 line-clamp-3">{i.lastError}</p>
                  )}
                  {!i.configured && !def?.managed && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Not configured — enter the required credentials to enable live health checks.
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                    {def?.managed ? (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Managed by the platform
                      </p>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setEditing(i)}>
                        Configure
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !i.configured}
                      title={i.configured ? undefined : "Configure credentials first"}
                      onClick={() => test.mutate({ key: i.key })}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Test connection"
                      )}
                    </Button>
                    {!def?.managed && i.secretsSet.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-rose-600 hover:text-rose-700"
                        onClick={() => disconnect.mutate(i.key)}
                      >
                        <Unplug className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integration Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">When</th>
                  <th className="text-left font-medium px-4 py-2">Integration</th>
                  <th className="text-left font-medium px-4 py-2">Action</th>
                  <th className="text-left font-medium px-4 py-2">Outcome</th>
                  <th className="text-left font-medium px-4 py-2">Actor</th>
                  <th className="text-left font-medium px-4 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No integration activity recorded yet.
                    </td>
                  </tr>
                )}
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-2 whitespace-nowrap">{fmt(e.occurred_at)}</td>
                    <td className="px-4 py-2">{definitionFor(e.integration_key)?.name ?? e.integration_key}</td>
                    <td className="px-4 py-2 capitalize">{e.action}</td>
                    <td className="px-4 py-2">
                      {e.outcome === "success" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Success
                        </span>
                      ) : e.outcome === "failure" ? (
                        <span className="inline-flex items-center gap-1 text-rose-600">
                          <XCircle className="h-3.5 w-3.5" /> Failure
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Info</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{e.actor_name}</td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[420px] truncate">
                      {e.error || e.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <ConfigureDialog
          integration={editing}
          definition={definitionFor(editing.key)!}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string | number;
  tone?: string;
  small?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`${small ? "text-base" : "text-2xl"} font-bold mt-1 ${tone ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium truncate">{value}</dd>
    </div>
  );
}

function ConfigureDialog({
  integration,
  definition,
  onClose,
  onSaved,
}: {
  integration: IntegrationView;
  definition: IntegrationDefinition;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [provider, setProvider] = useState(integration.provider);
  const [environment, setEnvironment] = useState(integration.environment);
  const [config, setConfig] = useState<Record<string, string | boolean>>(() => {
    const out: Record<string, string | boolean> = {};
    for (const f of definition.fields) {
      if (f.secret) continue;
      const v = integration.config[f.name];
      out[f.name] = f.kind === "boolean" ? Boolean(v) : v == null ? "" : String(v);
    }
    return out;
  });
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [testInput, setTestInput] = useState("");

  const missing = useMemo(
    () =>
      definition.fields.filter(
        (f) =>
          f.required &&
          (f.secret
            ? !secrets[f.name]?.trim() && !integration.secretsSet.includes(f.name)
            : !String(config[f.name] ?? "").trim()),
      ),
    [definition.fields, secrets, config, integration.secretsSet],
  );

  const save = useMutation({
    mutationFn: () =>
      saveIntegrationConfig({
        data: {
          key: integration.key,
          provider,
          environment: environment as "development" | "testing" | "production",
          config,
          secrets,
        },
      }),
    onSuccess: () => {
      toast.success("Configuration saved", { description: "Credentials encrypted and stored." });
      onSaved();
    },
    onError: (e: Error) => toast.error("Save failed", { description: e.message }),
  });

  const test = useMutation({
    mutationFn: () =>
      testIntegrationConnection({
        data: { key: integration.key, testInput: testInput || undefined },
      }),
    onSuccess: (res) => {
      if (res.ok) toast.success("Connection successful", { description: res.detail || `${res.latencyMs} ms` });
      else toast.error("Connection failed", { description: res.error });
      onSaved();
    },
    onError: (e: Error) => toast.error("Test failed", { description: e.message }),
  });

  const saveAndTest = async () => {
    await save.mutateAsync();
    setSecrets({});
    await test.mutateAsync();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{definition.name}</DialogTitle>
          <DialogDescription>{definition.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {definition.providers && (
            <div>
              <label className="text-xs text-muted-foreground">Provider</label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {definition.providers.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">Environment</label>
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENVIRONMENTS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {definition.fields.map((f) => {
            if (f.kind === "boolean") {
              return (
                <div
                  key={f.name}
                  className="flex items-center justify-between border-b border-border pb-3"
                >
                  <div>
                    <p className="text-sm font-medium">{f.label}</p>
                    {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
                  </div>
                  <Switch
                    checked={Boolean(config[f.name])}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, [f.name]: v }))}
                  />
                </div>
              );
            }
            const stored = integration.secretsSet.includes(f.name);
            return (
              <div key={f.name}>
                <label className="text-xs text-muted-foreground">
                  {f.label}
                  {f.required ? " *" : ""}
                </label>
                <Input
                  type={f.secret ? "password" : f.kind === "number" ? "number" : "text"}
                  autoComplete="off"
                  placeholder={f.secret && stored ? "•••••••• (stored — leave blank to keep)" : f.placeholder}
                  value={f.secret ? (secrets[f.name] ?? "") : String(config[f.name] ?? "")}
                  onChange={(e) =>
                    f.secret
                      ? setSecrets((s) => ({ ...s, [f.name]: e.target.value }))
                      : setConfig((c) => ({ ...c, [f.name]: e.target.value }))
                  }
                />
                {f.help && <p className="text-[11px] text-muted-foreground mt-1">{f.help}</p>}
              </div>
            );
          })}

          {definition.testInputLabel && (
            <div>
              <label className="text-xs text-muted-foreground">{definition.testInputLabel}</label>
              <Input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder={definition.testInputPlaceholder}
              />
            </div>
          )}

          {missing.length > 0 && (
            <p className="text-[11px] text-amber-600">
              Required: {missing.map((f) => f.label).join(", ")}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={save.isPending || test.isPending || missing.length > 0}
            onClick={saveAndTest}
          >
            {test.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save &amp; test
          </Button>
          <Button
            disabled={save.isPending || missing.length > 0}
            onClick={() =>
              save.mutate(undefined, {
                onSuccess: () => {
                  setSecrets({});
                  onClose();
                },
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
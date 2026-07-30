// Integration Center service layer. Everything here runs server-side with the
// service-role client; credentials are decrypted only for the duration of a
// provider call and never returned to the caller.
import { decryptSecrets, encryptSecrets } from "./crypto.server";
import { probeIntegration, probeInternalApi } from "./probes.server";
import { MONITORED_APIS, definitionFor } from "./catalog";
import type {
  ApiHealthView,
  IntegrationEventView,
  IntegrationView,
  SystemCenterData,
} from "./catalog";
import type { Actor } from "@/lib/admin/guard.server";

type Row = {
  key: string;
  name: string;
  category: string;
  provider: string;
  environment: string;
  version: string;
  enabled: boolean;
  status: string;
  config_public: Record<string, unknown>;
  secrets_ciphertext: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string;
  last_sync_at: string | null;
  last_latency_ms: number | null;
  updated_at: string;
  sort_order: number;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function toView(row: Row, secrets: Record<string, string>): IntegrationView {
  return {
    key: row.key,
    name: row.name,
    category: row.category,
    provider: row.provider,
    environment: row.environment,
    version: row.version,
    enabled: row.enabled,
    status: row.status as IntegrationView["status"],
    config: (row.config_public ?? {}) as IntegrationView["config"],
    secretsSet: Object.keys(secrets).filter((k) => String(secrets[k] ?? "").trim() !== ""),
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    lastError: row.last_error ?? "",
    lastSyncAt: row.last_sync_at,
    lastLatencyMs: row.last_latency_ms,
    updatedAt: row.updated_at,
  };
}

export async function recordIntegrationEvent(input: {
  key: string;
  action: string;
  outcome: "success" | "failure" | "info";
  actor?: Actor | null;
  latencyMs?: number | null;
  detail?: string;
  error?: string;
}) {
  const sb = await admin();
  await sb.from("integration_events").insert({
    integration_key: input.key,
    action: input.action,
    outcome: input.outcome,
    actor_user_id: input.actor?.userId ?? null,
    actor_name: input.actor?.name ?? "System",
    latency_ms: input.latencyMs ?? null,
    detail: (input.detail ?? "").slice(0, 1000),
    error: (input.error ?? "").slice(0, 1000),
  });
}

export async function recordHealthSample(input: {
  apiKey: string;
  ok: boolean;
  latencyMs?: number | null;
  detail?: string;
  error?: string;
  source?: string;
}) {
  const sb = await admin();
  await sb.from("api_health_checks").insert({
    api_key: input.apiKey,
    ok: input.ok,
    latency_ms: input.latencyMs ?? null,
    detail: (input.detail ?? "").slice(0, 500),
    error: (input.error ?? "").slice(0, 500),
    source: input.source ?? "probe",
  });
}

async function loadRows(): Promise<Row[]> {
  const sb = await admin();
  const { data, error } = await sb.from("integrations").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
}

async function loadRow(key: string): Promise<Row> {
  const sb = await admin();
  const { data, error } = await sb.from("integrations").select("*").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Unknown integration "${key}"`);
  return data as unknown as Row;
}

/** Aggregates the rolling health samples into the API Status view model. */
async function buildApiHealth(rows: Row[]): Promise<ApiHealthView[]> {
  const sb = await admin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("api_health_checks")
    .select("api_key, ok, latency_ms, error, checked_at")
    .gte("checked_at", since)
    .order("checked_at", { ascending: false })
    .limit(4000);

  const byKey = new Map<string, { ok: boolean; latency_ms: number | null; error: string; checked_at: string }[]>();
  for (const s of (data ?? []) as {
    api_key: string;
    ok: boolean;
    latency_ms: number | null;
    error: string;
    checked_at: string;
  }[]) {
    const list = byKey.get(s.api_key) ?? [];
    list.push(s);
    byKey.set(s.api_key, list);
  }

  const rowByKey = new Map(rows.map((r) => [r.key, r]));

  return MONITORED_APIS.map((api) => {
    const samples = byKey.get(api.key) ?? [];
    const integration = rowByKey.get(api.key);
    const successes = samples.filter((s) => s.ok);
    const failures = samples.filter((s) => !s.ok);
    const latencies = successes.map((s) => s.latency_ms ?? 0).filter((n) => n > 0);
    const configured = api.kind === "internal" || (integration?.status === "connected" || integration?.status === "error");

    let status: ApiHealthView["status"] = "not_configured";
    if (samples.length === 0) {
      status = configured ? "degraded" : "not_configured";
    } else if (samples[0].ok) {
      status = failures.length / samples.length > 0.2 ? "degraded" : "operational";
    } else {
      status = "down";
    }
    if (api.kind === "external" && integration && !integration.enabled && samples.length === 0) {
      status = "not_configured";
    }

    const noHeartbeat =
      samples.length === 0 && status === "degraded"
        ? "No heartbeat recorded yet — awaiting the first health sweep."
        : "";

    return {
      key: api.key,
      name: api.name,
      kind: api.kind,
      status,
      version: integration?.version || (api.kind === "internal" ? "v1" : "—"),
      latencyMs: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
      lastHeartbeat: samples[0]?.checked_at ?? null,
      lastSuccessAt: successes[0]?.checked_at ?? null,
      lastFailureAt: failures[0]?.checked_at ?? null,
      uptimePct: samples.length ? Math.round((successes.length / samples.length) * 1000) / 10 : null,
      errorCount: failures.length,
      successRate: samples.length
        ? Math.round((successes.length / samples.length) * 1000) / 10
        : null,
      samples: samples.length,
      lastError: failures[0]?.error ?? noHeartbeat,
    };
  });
}

export async function getSystemCenter(): Promise<SystemCenterData> {
  const rows = await loadRows();
  const sb = await admin();
  const [{ data: events }, apis] = await Promise.all([
    sb
      .from("integration_events")
      .select("id, integration_key, action, outcome, actor_name, latency_ms, detail, error, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(200),
    buildApiHealth(rows),
  ]);

  const dbRow = rows.find((r) => r.key === "cloud_database");
  const started = Date.now();
  const { error: pingError } = await sb.from("stations").select("id", { head: true, count: "exact" });
  const latency = Date.now() - started;

  return {
    integrations: rows.map((r) => toView(r, decryptSecrets(r.secrets_ciphertext))),
    events: (events ?? []) as unknown as IntegrationEventView[],
    apis,
    database: {
      provider: dbRow?.provider || "Supabase (PostgreSQL)",
      environment: dbRow?.environment || "production",
      database: process.env.SUPABASE_PROJECT_ID || "managed",
      realtime: Boolean((dbRow?.config_public as { realtime?: boolean })?.realtime),
      storage: Boolean((dbRow?.config_public as { storage?: boolean })?.storage),
      backup: pingError ? "Unknown" : "Managed daily backups (platform)",
      latencyMs: pingError ? null : latency,
    },
  };
}

export async function saveIntegration(
  actor: Actor,
  input: {
    key: string;
    provider?: string;
    environment?: string;
    config: Record<string, unknown>;
    secrets: Record<string, string>;
  },
) {
  const row = await loadRow(input.key);
  const def = definitionFor(input.key);
  if (!def) throw new Error(`Unknown integration "${input.key}"`);
  if (def.managed) throw new Error(`${def.name} is managed by the platform and cannot be edited.`);

  const existing = decryptSecrets(row.secrets_ciphertext);
  const merged = { ...existing };
  for (const [k, v] of Object.entries(input.secrets)) {
    // An empty value means "leave the stored credential untouched".
    if (String(v ?? "").trim() !== "") merged[k] = String(v).trim();
  }

  const sb = await admin();
  const { error } = await sb
    .from("integrations")
    .update({
      provider: input.provider ?? row.provider,
      environment: input.environment ?? row.environment,
      config_public: { ...(row.config_public ?? {}), ...input.config } as never,
      secrets_ciphertext: Object.keys(merged).length ? encryptSecrets(merged) : null,
      secret_fields: def.fields.filter((f) => f.secret).map((f) => f.name),
      updated_by: actor.userId,
      status: row.status === "not_configured" ? "disabled" : row.status,
    })
    .eq("key", input.key);
  if (error) throw new Error(error.message);

  await recordIntegrationEvent({
    key: input.key,
    action: "configure",
    outcome: "success",
    actor,
    detail: `Configuration saved (${input.environment ?? row.environment})`,
  });
  return { ok: true };
}

export async function testIntegration(
  actor: Actor | null,
  key: string,
  testInput?: string,
  action: "test" | "sync" = "test",
) {
  const row = await loadRow(key);
  const secrets = decryptSecrets(row.secrets_ciphertext);
  const started = Date.now();
  let result;
  try {
    result = await probeIntegration(key, row.provider, row.config_public ?? {}, secrets, testInput);
  } catch (e) {
    result = { ok: false, detail: "", error: e instanceof Error ? e.message : String(e) };
  }
  const latency = Date.now() - started;

  const sb = await admin();
  await sb
    .from("integrations")
    .update({
      status: result.ok ? "connected" : "error",
      enabled: result.ok ? true : row.enabled,
      last_success_at: result.ok ? new Date().toISOString() : row.last_success_at,
      last_failure_at: result.ok ? row.last_failure_at : new Date().toISOString(),
      last_error: result.ok ? "" : result.error.slice(0, 800),
      last_latency_ms: latency,
      last_sync_at: action === "sync" ? new Date().toISOString() : row.last_sync_at,
    })
    .eq("key", key);

  await Promise.all([
    recordIntegrationEvent({
      key,
      action,
      outcome: result.ok ? "success" : "failure",
      actor,
      latencyMs: latency,
      detail: result.detail,
      error: result.error,
    }),
    recordHealthSample({
      // The managed database slot is monitored under the "database" API key.
      apiKey: key === "cloud_database" ? "database" : key,
      ok: result.ok,
      latencyMs: latency,
      detail: result.detail,
      error: result.error,
      source: action,
    }),
  ]);

  return { ok: result.ok, detail: result.detail, error: result.error, latencyMs: latency };
}

export async function setIntegrationEnabled(actor: Actor, key: string, enabled: boolean) {
  const row = await loadRow(key);
  const sb = await admin();
  const { error } = await sb
    .from("integrations")
    .update({
      enabled,
      status: enabled ? (row.last_success_at ? "connected" : "disabled") : "disabled",
      updated_by: actor.userId,
    })
    .eq("key", key);
  if (error) throw new Error(error.message);
  await recordIntegrationEvent({
    key,
    action: enabled ? "enable" : "disable",
    outcome: "success",
    actor,
    detail: enabled ? "Integration enabled" : "Integration disabled",
  });
  return { ok: true };
}

export async function disconnectIntegration(actor: Actor, key: string) {
  const def = definitionFor(key);
  if (def?.managed) throw new Error(`${def.name} is managed by the platform and cannot be disconnected.`);
  const sb = await admin();
  const { error } = await sb
    .from("integrations")
    .update({
      secrets_ciphertext: null,
      enabled: false,
      status: "not_configured",
      last_error: "",
      updated_by: actor.userId,
    })
    .eq("key", key);
  if (error) throw new Error(error.message);
  await recordIntegrationEvent({
    key,
    action: "disconnect",
    outcome: "success",
    actor,
    detail: "Credentials cleared and integration disconnected",
  });
  return { ok: true };
}

/** Probes every internal API plus every configured external integration. */
export async function runHealthSweep(actor: Actor | null) {
  const rows = await loadRows();
  const internal = MONITORED_APIS.filter((a) => a.kind === "internal");

  for (const api of internal) {
    const started = Date.now();
    let result;
    try {
      result = await probeInternalApi(api.key);
    } catch (e) {
      result = { ok: false, detail: "", error: e instanceof Error ? e.message : String(e) };
    }
    await recordHealthSample({
      apiKey: api.key,
      ok: result.ok,
      latencyMs: Date.now() - started,
      detail: result.detail,
      error: result.error,
      source: "sweep",
    });
  }

  for (const row of rows) {
    const def = definitionFor(row.key);
    // Probe when credentials are stored, when the slot needs no secret at all
    // (e.g. Mobile Platform), or when the platform manages it (cloud database).
    const needsSecret = (def?.fields ?? []).some((f) => f.secret);
    const configured =
      row.secrets_ciphertext !== null ||
      def?.managed === true ||
      (!needsSecret && Object.keys(row.config_public ?? {}).length > 0);
    if (!configured) continue;
    await testIntegration(actor, row.key, undefined, "test");
  }

  return { ok: true, checked: internal.length + rows.length };
}
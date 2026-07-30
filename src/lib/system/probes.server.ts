// Real provider connection tests. Every function performs an actual network
// call with the stored credentials — nothing here is simulated.
import type { IntegrationKey } from "./catalog";

export interface ProbeResult {
  ok: boolean;
  detail: string;
  error: string;
  body?: string;
  /**
   * True when the slot has not been configured at all. The caller must NOT
   * record a health sample or an error status for these — they stay
   * "not configured" instead of masquerading as a failure.
   */
  notProbeable?: boolean;
}

const TIMEOUT_MS = 12_000;

async function httpProbe(
  url: string,
  init: RequestInit,
  okDetail: (body: string) => string,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = (await res.text()).slice(0, 600);
    if (!res.ok) return { ok: false, detail: "", error: `HTTP ${res.status}: ${body}` };
    return { ok: true, detail: okDetail(body), error: "", body };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: "", error: message === "The operation was aborted." ? "Connection timed out" : message };
  } finally {
    clearTimeout(timer);
  }
}

function requireFields(
  values: Record<string, unknown>,
  names: string[],
): string | null {
  const missing = names.filter((n) => !String(values[n] ?? "").trim());
  return missing.length ? `Missing configuration: ${missing.join(", ")}` : null;
}

function notConfigured(missing: string): ProbeResult {
  return { ok: false, detail: "", error: missing, notProbeable: true };
}

async function probeGoogleMaps(cfg: Record<string, unknown>, sec: Record<string, string>) {
  const missing = requireFields({ api_key: sec.api_key }, ["api_key"]);
  if (missing) return notConfigured(missing);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=Cairo+International+Airport&key=${encodeURIComponent(sec.api_key)}`;
  void cfg;
  // Google answers HTTP 200 even for a rejected key, so the JSON status is authoritative.
  const res = await httpProbe(url, { method: "GET" }, () => "Geocoding API reachable");
  if (!res.ok) return res;
  try {
    const parsed = JSON.parse(res.body ?? "{}") as { status?: string; error_message?: string };
    if (parsed.status && parsed.status !== "OK" && parsed.status !== "ZERO_RESULTS") {
      return {
        ok: false,
        detail: "",
        error: parsed.error_message || `Google Maps returned ${parsed.status}`,
      };
    }
    return { ok: true, detail: `Geocoding API responded ${parsed.status ?? "OK"}`, error: "" };
  } catch {
    return res;
  }
}

async function probeSms(
  cfg: Record<string, unknown>,
  sec: Record<string, string>,
  provider: string,
  testRecipient?: string,
) {
  const apiUrl = String(cfg.api_url ?? "").replace(/\/$/, "");
  const missing = requireFields({ api_url: apiUrl, api_key: sec.api_key }, ["api_url", "api_key"]);
  if (missing) return notConfigured(missing);

  if (provider === "twilio") {
    const auth = Buffer.from(`${sec.api_key}:${sec.api_secret ?? ""}`).toString("base64");
    const account = await httpProbe(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sec.api_key)}.json`,
      { method: "GET", headers: { Authorization: `Basic ${auth}` } },
      () => "Twilio account authenticated",
    );
    if (!account.ok || !testRecipient) return account;
    const form = new URLSearchParams({
      To: testRecipient,
      From: String(cfg.sender_id ?? ""),
      Body: "IAB Smart Baggage — integration test message.",
    });
    return httpProbe(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sec.api_key)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
      () => `Test SMS queued to ${testRecipient}`,
    );
  }

  if (provider === "infobip") {
    return httpProbe(
      `${apiUrl}/account/1/balance`,
      { method: "GET", headers: { Authorization: `App ${sec.api_key}`, Accept: "application/json" } },
      (b) => `Infobip authenticated · ${b.slice(0, 120)}`,
    );
  }

  // Vodafone / Orange / Etisalat / Custom REST all expose a bearer-authenticated
  // HTTP endpoint; we verify authentication against the configured base URL.
  return httpProbe(
    apiUrl,
    { method: "GET", headers: { Authorization: `Bearer ${sec.api_key}`, Accept: "application/json" } },
    () => "Gateway endpoint reachable and accepted the credentials",
  );
}

async function probeWhatsApp(cfg: Record<string, unknown>, sec: Record<string, string>) {
  const missing = requireFields(
    { phone_number_id: cfg.phone_number_id, access_token: sec.access_token },
    ["phone_number_id", "access_token"],
  );
  if (missing) return notConfigured(missing);
  return httpProbe(
    `https://graph.facebook.com/v20.0/${encodeURIComponent(String(cfg.phone_number_id))}?fields=display_phone_number,verified_name`,
    { method: "GET", headers: { Authorization: `Bearer ${sec.access_token}` } },
    (b) => `Cloud API verified · ${b.slice(0, 160)}`,
  );
}

/**
 * Real SMTP conversation: greeting → EHLO → optional STARTTLS → AUTH LOGIN.
 * A server that accepts the TCP connection but rejects the credentials is
 * reported as an error, never as "connected".
 */
async function probeEmail(cfg: Record<string, unknown>, sec: Record<string, string>): Promise<ProbeResult> {
  const host = String(cfg.host ?? "").trim();
  const port = Number(cfg.port ?? 0);
  const username = String(cfg.username ?? "").trim();
  const password = String(sec.password ?? "").trim();
  if (!host || !port) return notConfigured("Missing configuration: host, port");
  if (!username || !password) {
    return notConfigured("Missing configuration: username, password");
  }

  const net = await import("node:net");
  const tls = await import("node:tls");
  const implicitTls = port === 465;

  return new Promise<ProbeResult>((resolve) => {
    let socket: import("node:net").Socket = implicitTls
      ? (tls.connect({ host, port, servername: host }) as unknown as import("node:net").Socket)
      : net.connect({ host, port });
    let buffer = "";
    let settled = false;
    let awaiting: ((line: string) => void) | null = null;

    const finish = (r: ProbeResult) => {
      if (settled) return;
      settled = true;
      try {
        socket.write("QUIT\r\n");
      } catch {
        /* ignore */
      }
      socket.removeAllListeners();
      socket.destroy();
      resolve(r);
    };

    const attach = (s: import("node:net").Socket) => {
      s.setTimeout(TIMEOUT_MS);
      s.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        // A complete SMTP reply ends with "<code><space>text\r\n".
        const match = buffer.match(/^(?:\d{3}-[^\n]*\n)*(\d{3} [^\n]*)\r?\n$/);
        if (!match) return;
        const reply = buffer.trim();
        buffer = "";
        const cb = awaiting;
        awaiting = null;
        cb?.(reply);
      });
      s.on("timeout", () => finish({ ok: false, detail: "", error: "SMTP connection timed out" }));
      s.on("error", (err: Error) => finish({ ok: false, detail: "", error: err.message }));
    };

    const send = (line: string) =>
      new Promise<string>((res) => {
        awaiting = res;
        socket.write(`${line}\r\n`);
      });

    const expect = (reply: string, codes: string[], label: string) => {
      if (codes.some((c) => reply.startsWith(c))) return true;
      finish({ ok: false, detail: "", error: `${label} failed — server replied: ${reply.slice(0, 200)}` });
      return false;
    };

    attach(socket);

    const run = async () => {
      const greeting = await new Promise<string>((res) => {
        awaiting = res;
      });
      if (!expect(greeting, ["220"], "SMTP greeting")) return;

      let ehlo = await send(`EHLO iab-baggage`);
      if (!expect(ehlo, ["250"], "EHLO")) return;

      if (!implicitTls && /STARTTLS/i.test(ehlo)) {
        const starttls = await send("STARTTLS");
        if (!expect(starttls, ["220"], "STARTTLS")) return;
        const plain = socket;
        plain.removeAllListeners();
        socket = tls.connect({ socket: plain, servername: host }) as unknown as import("node:net").Socket;
        attach(socket);
        ehlo = await send(`EHLO iab-baggage`);
        if (!expect(ehlo, ["250"], "EHLO (TLS)")) return;
      }

      const auth = await send("AUTH LOGIN");
      if (!expect(auth, ["334"], "AUTH LOGIN")) return;
      const userReply = await send(Buffer.from(username, "utf8").toString("base64"));
      if (!expect(userReply, ["334"], "SMTP username")) return;
      const passReply = await send(Buffer.from(password, "utf8").toString("base64"));
      if (!expect(passReply, ["235"], "SMTP authentication")) return;

      finish({
        ok: true,
        detail: `SMTP authenticated as ${username} on ${host}:${port}`,
        error: "",
      });
    };

    run().catch((e: unknown) =>
      finish({ ok: false, detail: "", error: e instanceof Error ? e.message : String(e) }),
    );
  });
}

async function probeOdoo(cfg: Record<string, unknown>, sec: Record<string, string>) {
  const base = String(cfg.base_url ?? "").replace(/\/$/, "");
  const missing = requireFields(
    { base_url: base, database: cfg.database, username: cfg.username, api_key: sec.api_key },
    ["base_url", "database", "username", "api_key"],
  );
  if (missing) return notConfigured(missing);
  const res = await httpProbe(
    `${base}/web/session/authenticate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { db: cfg.database, login: cfg.username, password: sec.api_key },
      }),
    },
    () => "Odoo session authenticated",
  );
  if (!res.ok) return res;
  // Odoo reports authentication failures inside a 200 JSON-RPC error envelope.
  try {
    const parsed = JSON.parse(res.body ?? "{}") as {
      error?: { data?: { message?: string }; message?: string };
      result?: { uid?: number | false };
    };
    if (parsed.error) {
      return { ok: false, detail: "", error: parsed.error.data?.message || parsed.error.message || "Odoo rejected the credentials" };
    }
    if (parsed.result && !parsed.result.uid) {
      return { ok: false, detail: "", error: "Odoo rejected the credentials (no session)" };
    }
    return { ok: true, detail: `Odoo session established (uid ${parsed.result?.uid})`, error: "" };
  } catch {
    return res;
  }
}

/**
 * Verifies the mobile push credential against the real provider. Without a
 * push credential there is nothing to connect to, so the slot reports
 * "not configured" rather than a fabricated success.
 */
async function probeMobilePlatform(
  cfg: Record<string, unknown>,
  sec: Record<string, string>,
): Promise<ProbeResult> {
  const missing = requireFields(
    {
      ios_bundle_id: cfg.ios_bundle_id,
      android_package: cfg.android_package,
      min_supported_version: cfg.min_supported_version,
      push_provider: cfg.push_provider,
      push_server_key: sec.push_server_key,
    },
    ["ios_bundle_id", "android_package", "min_supported_version", "push_provider", "push_server_key"],
  );
  if (missing) return notConfigured(missing);

  const provider = String(cfg.push_provider).trim().toLowerCase();
  if (provider !== "fcm") {
    return {
      ok: false,
      detail: "",
      error: `No connection test available for push provider "${cfg.push_provider}" (only FCM is supported).`,
    };
  }

  // FCM legacy endpoint: 401 = rejected key, 400 = key accepted, payload rejected.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${sec.push_server_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ registration_ids: [] }),
      signal: controller.signal,
    });
    const body = (await res.text()).slice(0, 300);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, detail: "", error: `FCM rejected the push server key (HTTP ${res.status})` };
    }
    return {
      ok: true,
      detail: `FCM accepted the push server key · min supported ${String(cfg.min_supported_version)}`,
      error: "",
      body,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      detail: "",
      error: message === "The operation was aborted." ? "Connection timed out" : message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probeDatabase(): Promise<ProbeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error, count } = await supabaseAdmin
    .from("deliveries")
    .select("id", { count: "exact", head: true });
  if (error) return { ok: false, detail: "", error: error.message };
  return { ok: true, detail: `PostgreSQL round-trip OK · ${count ?? 0} delivery rows`, error: "" };
}

export async function probeIntegration(
  key: IntegrationKey | string,
  provider: string,
  cfg: Record<string, unknown>,
  sec: Record<string, string>,
  testInput?: string,
): Promise<ProbeResult> {
  switch (key) {
    case "google_maps":
      return probeGoogleMaps(cfg, sec);
    case "sms_gateway":
      return probeSms(cfg, sec, provider, testInput);
    case "whatsapp":
      return probeWhatsApp(cfg, sec);
    case "email":
      return probeEmail(cfg, sec);
    case "odoo":
      return probeOdoo(cfg, sec);
    case "mobile_platform":
      return probeMobilePlatform(cfg);
    case "cloud_database":
      return probeDatabase();
    default:
      return { ok: false, detail: "", error: `Unknown integration "${key}"` };
  }
}

/** Internal API surfaces are probed against the tables/functions they own. */
export async function probeInternalApi(apiKey: string): Promise<ProbeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const table: Record<string, string> = {
    workflow: "workflow_events",
    notification: "notification_events",
    passenger: "passenger_view",
    driver: "agent_routes",
    quality: "quality_incidents",
    reporting: "timeline_events",
    database: "deliveries",
  };
  const target = table[apiKey];
  if (!target) return { ok: false, detail: "", error: `No probe defined for ${apiKey}` };
  const { error, count } = await supabaseAdmin
    .from(target as never)
    .select("*", { count: "exact", head: true });
  if (error) return { ok: false, detail: "", error: error.message };
  return { ok: true, detail: `${target}: ${count ?? 0} rows`, error: "" };
}
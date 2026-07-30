// Transport built from the Integration Center configuration. Entering
// production credentials in the UI switches the live transport — no code
// change and no redeploy. Falls back to the environment-based Twilio adapter,
// then to the simulated adapter, exactly as before.
import type { NotificationChannelAdapter, OutboundEvent, SendResult } from "../channels";
import type { NotificationChannel } from "../templates";

const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/;

interface LiveConfig {
  provider: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
}

async function loadLive(key: string): Promise<LiveConfig | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptSecrets } = await import("@/lib/system/crypto.server");
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("provider, enabled, status, config_public, secrets_ciphertext")
    .eq("key", key)
    .maybeSingle();
  if (!data || !data.enabled || !data.secrets_ciphertext) return null;
  return {
    provider: data.provider ?? "",
    config: (data.config_public ?? {}) as Record<string, unknown>,
    secrets: decryptSecrets(data.secrets_ciphertext),
  };
}

function retryable(status: number) {
  return status === 429 || status >= 500;
}

async function sendSms(live: LiveConfig, event: OutboundEvent): Promise<SendResult> {
  const apiUrl = String(live.config.api_url ?? "").replace(/\/$/, "");
  const sender = String(live.config.sender_id ?? "");

  if (live.provider === "twilio") {
    const auth = Buffer.from(`${live.secrets.api_key}:${live.secrets.api_secret ?? ""}`).toString(
      "base64",
    );
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(live.secrets.api_key)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: event.to, From: sender, Body: event.message.body }),
      },
    );
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}`, retryable: retryable(res.status) };
    let providerId: string | undefined;
    try {
      providerId = (JSON.parse(body) as { sid?: string }).sid;
    } catch {
      /* ignore */
    }
    return { ok: true, providerId };
  }

  if (live.provider === "infobip") {
    const res = await fetch(`${apiUrl}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        Authorization: `App ${live.secrets.api_key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [{ from: sender, destinations: [{ to: event.to }], text: event.message.body }],
      }),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}`, retryable: retryable(res.status) };
    return { ok: true };
  }

  // Vodafone / Orange / Etisalat / Custom REST: bearer-authenticated JSON POST.
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${live.secrets.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: event.to, from: sender, message: event.message.body }),
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}`, retryable: retryable(res.status) };
  return { ok: true };
}

async function sendWhatsApp(live: LiveConfig, event: OutboundEvent): Promise<SendResult> {
  const phoneId = String(live.config.phone_number_id ?? "");
  const res = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${live.secrets.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: event.to.replace(/[^0-9+]/g, ""),
      type: "text",
      text: { body: event.message.body },
    }),
  });
  const body = await res.text();
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}`, retryable: retryable(res.status) };
  let providerId: string | undefined;
  try {
    providerId = (JSON.parse(body) as { messages?: { id?: string }[] }).messages?.[0]?.id;
  } catch {
    /* ignore */
  }
  return { ok: true, providerId };
}

/** Returns a live adapter when the channel is configured in the Integration Center. */
export async function configuredAdapter(
  channel: NotificationChannel,
): Promise<NotificationChannelAdapter | null> {
  const key = channel === "sms" ? "sms_gateway" : channel === "whatsapp" ? "whatsapp" : null;
  if (!key) return null;
  const live = await loadLive(key);
  if (!live) return null;

  return {
    channel,
    name: live.provider || key,
    simulated: false,
    validateRecipient(to: string) {
      return PHONE_RE.test((to ?? "").trim())
        ? { ok: true }
        : { ok: false, error: "Invalid mobile number" };
    },
    async send(event: OutboundEvent): Promise<SendResult> {
      if (!PHONE_RE.test((event.to ?? "").trim())) {
        return { ok: false, error: "Invalid mobile number", retryable: false };
      }
      try {
        return channel === "sms" ? await sendSms(live, event) : await sendWhatsApp(live, event);
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          retryable: true,
        };
      }
    },
  };
}
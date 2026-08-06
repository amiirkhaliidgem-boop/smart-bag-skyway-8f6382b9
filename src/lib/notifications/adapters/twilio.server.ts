// Real SMS / WhatsApp transport (Twilio). Server-only: it reads provider
// credentials from the environment and is never imported by the browser.
//
// Selection is environment-driven — no engine change is required. When the
// credentials are absent the registry keeps the simulated adapters, so
// nothing breaks in preview or before a provider is procured.

import type { NotificationChannelAdapter, OutboundEvent, SendResult } from "../channels";
import type { NotificationChannel } from "../templates";
import { toE164Eg } from "@/lib/phone/egypt";

function credentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, token };
}

export function twilioConfigured(): boolean {
  return credentials() !== null;
}

function fromNumber(channel: NotificationChannel): string | undefined {
  return channel === "whatsapp" ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM;
}

function address(channel: NotificationChannel, value: string): string {
  // Numbers are stored in the local Egyptian format; the provider requires
  // E.164, so normalisation happens here and nowhere else.
  const e164 = toE164Eg(value) ?? value.trim();
  return channel === "whatsapp" && !e164.startsWith("whatsapp:") ? `whatsapp:${e164}` : e164;
}

/** Twilio 4xx are permanent (bad number, template rejected); 429/5xx retry. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function makeTwilioAdapter(channel: NotificationChannel): NotificationChannelAdapter {
  return {
    channel,
    name: "twilio",
    simulated: false,
    validateRecipient(to: string) {
      return toE164Eg(to) !== null
        ? { ok: true }
        : {
            ok: false,
            error: "Invalid Egyptian mobile number (expected 11 digits starting 010/011/012/015)",
          };
    },
    async send(event: OutboundEvent): Promise<SendResult> {
      const creds = credentials();
      const from = fromNumber(channel);
      if (!creds || !from) {
        return { ok: false, error: "Twilio is not configured", retryable: false };
      }
      if (toE164Eg(event.to) === null) {
        return {
          ok: false,
          error: "Invalid Egyptian mobile number (expected 11 digits starting 010/011/012/015)",
          retryable: false,
        };
      }

      const body = new URLSearchParams({
        To: address(channel, event.to),
        From: address(channel, from),
        Body: event.message.body,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${creds.sid}:${creds.token}`)}`,
            // Twilio de-duplicates on this header, so a retried attempt of the
            // same notification event cannot double-send.
            "I-Twilio-Idempotency-Token": `${event.id}:${event.attempt}`,
          },
          body,
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        sid?: string;
        message?: string;
      };

      if (!response.ok) {
        return {
          ok: false,
          error: payload.message ?? `Twilio responded ${response.status}`,
          retryable: isRetryable(response.status),
        };
      }
      return { ok: true, providerId: payload.sid };
    },
  };
}

export const twilioAdapters: Record<"sms" | "whatsapp", NotificationChannelAdapter> = {
  sms: makeTwilioAdapter("sms"),
  whatsapp: makeTwilioAdapter("whatsapp"),
};

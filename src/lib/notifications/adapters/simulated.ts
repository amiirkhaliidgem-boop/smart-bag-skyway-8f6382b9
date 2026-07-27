// Simulated transports. These behave like real providers — network latency,
// provider message ids, occasional retryable failures — so the engine's
// dispatch, retry and monitoring paths are exercised exactly as they will be
// in production. Swapping in a real provider means writing a sibling adapter
// and registering it; nothing here is referenced by business logic.

import type { NotificationChannelAdapter, OutboundEvent, SendResult } from "../channels";
import type { NotificationChannel } from "../templates";

/**
 * Fraction of simulated sends that fail with a retryable transport error.
 * 0 = never fail (default, for demos). Raise it to exercise the retry path.
 */
export const SIMULATED_FAILURE_RATE = 0;

const MIN_LATENCY_MS = 300;
const MAX_LATENCY_MS = 1200;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function randomLatency() {
  return MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
    : Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
}

const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeSimulatedAdapter(
  channel: NotificationChannel,
  validate: (to: string) => { ok: boolean; error?: string },
): NotificationChannelAdapter {
  return {
    channel,
    name: `simulated-${channel}`,
    simulated: true,
    validateRecipient: validate,
    async send(event: OutboundEvent): Promise<SendResult> {
      const check = validate(event.to);
      if (!check.ok) {
        return { ok: false, error: check.error, retryable: false };
      }
      await delay(randomLatency());
      if (Math.random() < SIMULATED_FAILURE_RATE) {
        return {
          ok: false,
          error: "Simulated transport error (provider unavailable)",
          retryable: true,
        };
      }
      return { ok: true, providerId: `sim_${channel}_${uid()}` };
    },
  };
}

const phone = (to: string) =>
  PHONE_RE.test((to ?? "").trim())
    ? { ok: true }
    : { ok: false, error: "Invalid mobile number" };

const email = (to: string) =>
  EMAIL_RE.test((to ?? "").trim())
    ? { ok: true }
    : { ok: false, error: "Invalid email address" };

const token = (to: string) =>
  (to ?? "").trim().length >= 8
    ? { ok: true }
    : { ok: false, error: "Missing push device token" };

export const simulatedAdapters: Record<NotificationChannel, NotificationChannelAdapter> = {
  sms: makeSimulatedAdapter("sms", phone),
  whatsapp: makeSimulatedAdapter("whatsapp", phone),
  email: makeSimulatedAdapter("email", email),
  push: makeSimulatedAdapter("push", token),
};
// Dispatch pipeline. Reads the provider registry (never an adapter directly),
// records every attempt, and retries retryable transport failures with
// exponential backoff — the same behaviour a real provider worker gives.
//
// The store owns the notification state; this module only reports transitions
// back through `onUpdate`, so it stays free of any business logic.

import type { NotificationChannel } from "./templates";
import type { RenderedMessage } from "./templates";
import { getProvider } from "./registry";

export const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1500;

export interface DispatchableEvent {
  id: string;
  channel: NotificationChannel;
  to: string;
  locale: "en" | "ar";
  message: RenderedMessage;
  attempts?: number;
}

export interface DispatchPatch {
  status_?: "queued" | "sending" | "sent" | "failed";
  attempts?: number;
  lastAttemptAt?: string;
  provider?: string;
  providerId?: string;
  failureReason?: string;
}

export type DispatchUpdate = (id: string, patch: DispatchPatch) => void;

// Guards against a second dispatcher picking up an event already in flight
// (e.g. the boot drain racing a fresh enqueue in the same tab).
const inFlight = new Set<string>();

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function dispatchOne(event: DispatchableEvent, onUpdate: DispatchUpdate) {
  if (inFlight.has(event.id)) return;
  inFlight.add(event.id);
  const provider = getProvider(event.channel);
  try {
    let attempt = event.attempts ?? 0;
    while (attempt < MAX_ATTEMPTS) {
      attempt += 1;
      onUpdate(event.id, {
        status_: "sending",
        attempts: attempt,
        lastAttemptAt: new Date().toISOString(),
        provider: provider.adapter.name,
      });
      let result;
      try {
        result = await provider.adapter.send({
          id: event.id,
          channel: event.channel,
          to: event.to,
          message: event.message,
          locale: event.locale,
          attempt,
        });
      } catch (err) {
        result = {
          ok: false,
          retryable: true,
          error: err instanceof Error ? err.message : "Unexpected adapter error",
        };
      }

      if (result.ok) {
        onUpdate(event.id, {
          status_: "sent",
          providerId: result.providerId,
          provider: provider.adapter.name,
          failureReason: undefined,
        });
        return;
      }

      const canRetry = result.retryable === true && attempt < MAX_ATTEMPTS;
      onUpdate(event.id, {
        status_: canRetry ? "queued" : "failed",
        failureReason: result.error ?? "Delivery failed",
        provider: provider.adapter.name,
      });
      if (!canRetry) return;
      await wait(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }
  } finally {
    inFlight.delete(event.id);
  }
}

/** Send a batch, lightly staggered so a burst doesn't hit the provider at once. */
export function dispatchEvents(events: DispatchableEvent[], onUpdate: DispatchUpdate) {
  events.forEach((event, i) => {
    setTimeout(() => void dispatchOne(event, onUpdate), i * 150);
  });
}
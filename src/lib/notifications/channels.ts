// Channel adapter contract — the ONLY seam between the Notification Engine
// and a message transport. Real providers (Twilio SMS, Meta WhatsApp, SES
// email, FCM push) implement `NotificationChannelAdapter` and are registered
// in `./registry`. Nothing else in the system changes when they arrive.

import type { NotificationChannel, RenderedMessage } from "./templates";

export interface OutboundEvent {
  /** Notification event id — pass through to the provider as an idempotency key. */
  id: string;
  channel: NotificationChannel;
  to: string;
  message: RenderedMessage;
  locale: "en" | "ar";
  /** 1-based attempt number for this event. */
  attempt: number;
}

export interface SendResult {
  ok: boolean;
  /** Provider-side message id (Twilio SID, Meta wamid, SES MessageId, ...). */
  providerId?: string;
  /** Human-readable failure reason, surfaced read-only in the Notification Center. */
  error?: string;
  /**
   * Whether the engine should retry. Transport/rate-limit errors are
   * retryable; invalid recipients or rejected templates are not.
   */
  retryable?: boolean;
}

export interface NotificationChannelAdapter {
  channel: NotificationChannel;
  /** Provider identity shown in the monitor + audit, e.g. "simulated-sms", "twilio". */
  name: string;
  /** True while the transport is emulated. Real adapters must set false. */
  simulated: boolean;
  /** Optional fast-fail on a malformed address, before any network call. */
  validateRecipient?(to: string): { ok: boolean; error?: string };
  send(event: OutboundEvent): Promise<SendResult>;
}
// Channel adapter contracts. Real providers (Twilio SMS, Meta WhatsApp,
// SES email, FCM push) will implement `NotificationChannelAdapter` and
// be registered in the notification engine. For now every adapter is a
// no-op logger — the message is enqueued as a NotificationEvent in the
// central store so the Contact Center Outbox can display it.

import type { NotificationChannel, RenderedMessage } from "./templates";

export interface OutboundEvent {
  channel: NotificationChannel;
  to: string;
  message: RenderedMessage;
  locale: "en" | "ar";
}

export interface NotificationChannelAdapter {
  channel: NotificationChannel;
  send(event: OutboundEvent): Promise<{ ok: boolean; providerId?: string }>;
}

// Default no-op adapters until a provider is wired.
export const defaultAdapters: Record<NotificationChannel, NotificationChannelAdapter> = {
  sms: {
    channel: "sms",
    async send() {
      return { ok: true };
    },
  },
  whatsapp: {
    channel: "whatsapp",
    async send() {
      return { ok: true };
    },
  },
  email: {
    channel: "email",
    async send() {
      return { ok: true };
    },
  },
  push: {
    channel: "push",
    async send() {
      return { ok: true };
    },
  },
};
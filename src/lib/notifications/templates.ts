// Centralized Notification Templates
// Every workflow status has a bilingual (EN/AR) template for SMS,
// WhatsApp, Email, and Push channels. Real providers are wired later
// via `src/lib/integrations/*` — this file defines contract + copy.

import type { WorkflowStatus } from "../workflow/statuses";

export type NotificationChannel = "sms" | "whatsapp" | "email" | "push";

export interface TemplateContext {
  passengerName: string;
  pirNumber: string;
  driverName?: string;
  otp?: string;
  trackingUrl?: string;
}

export interface RenderedMessage {
  subject?: string;
  body: string;
}

type Renderer = (ctx: TemplateContext) => RenderedMessage;
type Bundle = Partial<Record<NotificationChannel, { en: Renderer; ar: Renderer }>>;

const brand = "IAB Smart Baggage";

export const TEMPLATES: Partial<Record<WorkflowStatus, Bundle>> = {
  DELIVERY_APPROVED: {
    sms: {
      en: (c) => ({
        body: `${brand}: Home delivery approved for PIR ${c.pirNumber}. Track: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `${brand}: تم اعتماد توصيل حقيبتك (${c.pirNumber}). تابع: ${c.trackingUrl ?? ""}`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Hello ${c.passengerName}, your home delivery request (PIR ${c.pirNumber}) has been approved. We will contact you with the driver details shortly.`,
      }),
      ar: (c) => ({
        body: `مرحباً ${c.passengerName}، تم اعتماد طلب توصيل حقيبتك (${c.pirNumber}). سنوافيك ببيانات مندوب التسليم قريباً.`,
      }),
    },
  },
  DRIVER_ASSIGNED: {
    sms: {
      en: (c) => ({
        body: `${brand}: A driver has been assigned to your delivery (PIR ${c.pirNumber}). Track & view your OTP: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `${brand}: تم تعيين سائق لتوصيل حقيبتك (${c.pirNumber}). تابع واستعرض رمز التحقق: ${c.trackingUrl ?? ""}`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Hello ${c.passengerName}, a driver has been assigned to your baggage delivery. Open your secure Passenger Portal to view your OTP and track the delivery: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `مرحباً ${c.passengerName}، تم تعيين سائق لتوصيل حقيبتك. افتح بوابة الراكب الآمنة لعرض رمز التحقق ومتابعة التوصيل: ${c.trackingUrl ?? ""}`,
      }),
    },
  },
  OUT_FOR_DELIVERY: {
    sms: {
      en: (c) => ({
        body: `${brand}: Your baggage is out for delivery. Track: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `${brand}: حقيبتك فى الطريق إليك. تابع: ${c.trackingUrl ?? ""}`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Your baggage is on the way. Track live: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `حقيبتك فى الطريق. تتبع مباشر: ${c.trackingUrl ?? ""}`,
      }),
    },
  },
  DRIVER_ARRIVED: {
    sms: {
      en: (c) => ({
        body: `${brand}: Delivery agent has arrived. Your delivery OTP is ${c.otp}. Share it only after receiving your baggage.`,
      }),
      ar: (c) => ({
        body: `${brand}: وصل مندوب التسليم. رمز التحقق ${c.otp}. لا تشاركه إلا بعد استلام حقيبتك.`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Delivery agent ${c.driverName} has arrived. OTP: ${c.otp}. Share only after receiving your baggage in good condition.`,
      }),
      ar: (c) => ({
        body: `وصل مندوب التسليم ${c.driverName}. رمز التحقق: ${c.otp}. شاركه فقط بعد استلام حقيبتك بحالة سليمة.`,
      }),
    },
  },
  DELIVERED: {
    sms: {
      en: (c) => ({
        body: `${brand}: Baggage delivered. Please share your feedback: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `${brand}: تم توصيل الحقيبة. شاركنا تقييمك: ${c.trackingUrl ?? ""}`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Thank you ${c.passengerName}, your baggage has been delivered. We would love your feedback: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `شكراً ${c.passengerName}، تم توصيل حقيبتك. نسعد بمشاركتك تقييمك: ${c.trackingUrl ?? ""}`,
      }),
    },
  },
};

export function renderTemplate(
  status: WorkflowStatus,
  channel: NotificationChannel,
  locale: "en" | "ar",
  ctx: TemplateContext,
): RenderedMessage | null {
  const bundle = TEMPLATES[status];
  if (!bundle) return null;
  const chan = bundle[channel];
  if (!chan) return null;
  return chan[locale](ctx);
}
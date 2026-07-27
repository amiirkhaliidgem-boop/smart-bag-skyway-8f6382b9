// Centralized Notification Templates
// Every workflow status has a bilingual (EN/AR) template for SMS,
// WhatsApp, Email, and Push channels. Real providers are wired later
// via `src/lib/integrations/*` — this file defines contract + copy.

import { WORKFLOW_LABELS, type WorkflowStatus } from "../workflow/statuses";

export type NotificationChannel = "sms" | "whatsapp" | "email" | "push";

// Some passenger-facing operational events do not have a distinct canonical
// WorkflowStatus (the Workflow Engine intentionally keeps its status list
// small). Those are expressed as extra notification triggers here, and each
// one maps back to the WorkflowStatus it belongs to for Timeline / Reports.
export const EXTRA_TRIGGERS = [
  "STAGE_SCHEDULED",
  "STAGE_COLLECTED",
  "STAGE_DELIVERY_FAILED",
  "STAGE_RETURNED_TO_AIRPORT",
] as const;

export type ExtraTrigger = (typeof EXTRA_TRIGGERS)[number];
export type NotificationTrigger = WorkflowStatus | ExtraTrigger;

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

export const TEMPLATES: Partial<Record<NotificationTrigger, Bundle>> = {
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
        body: `Hello ${c.passengerName}, your home delivery request (PIR ${c.pirNumber}) has been approved. We will contact you with the delivery agent details shortly.`,
      }),
      ar: (c) => ({
        body: `مرحباً ${c.passengerName}، تم اعتماد طلب توصيل حقيبتك (${c.pirNumber}). سنوافيك ببيانات مندوب التسليم قريباً.`,
      }),
    },
  },
  DRIVER_ASSIGNED: {
    sms: {
      en: (c) => ({
        body: `${brand}: A delivery agent has been assigned to your delivery (PIR ${c.pirNumber}). Track & view your OTP: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `${brand}: تم تعيين سائق لتوصيل حقيبتك (${c.pirNumber}). تابع واستعرض رمز التحقق: ${c.trackingUrl ?? ""}`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Hello ${c.passengerName}, a delivery agent has been assigned to your baggage delivery. Open your secure Passenger Portal to view your OTP and track the delivery: ${c.trackingUrl ?? ""}`,
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
  STAGE_SCHEDULED: {
    sms: {
      en: (c) => ({
        body: `${brand}: Your baggage delivery (PIR ${c.pirNumber}) has been scheduled. Track: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `${brand}: تمت جدولة توصيل حقيبتك (${c.pirNumber}). تابع: ${c.trackingUrl ?? ""}`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Hello ${c.passengerName}, your baggage delivery (PIR ${c.pirNumber}) has been scheduled. You will be notified once a delivery agent is assigned: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `مرحباً ${c.passengerName}، تمت جدولة توصيل حقيبتك (${c.pirNumber}). سنخطرك فور تعيين مندوب التسليم: ${c.trackingUrl ?? ""}`,
      }),
    },
  },
  STAGE_COLLECTED: {
    sms: {
      en: (c) => ({
        body: `${brand}: Your baggage has been collected from the airport and is being prepared for delivery. Track: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `${brand}: تم استلام حقيبتك من المطار وجارٍ تجهيزها للتوصيل. تابع: ${c.trackingUrl ?? ""}`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Hello ${c.passengerName}, your baggage has been collected from the airport by the delivery agent and is being prepared for delivery: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `مرحباً ${c.passengerName}، تم استلام حقيبتك من المطار بواسطة مندوب التسليم وجارٍ تجهيزها للتوصيل: ${c.trackingUrl ?? ""}`,
      }),
    },
  },
  STAGE_DELIVERY_FAILED: {
    sms: {
      en: (c) => ({
        body: `${brand}: We could not complete the delivery of your baggage (PIR ${c.pirNumber}). Our contact centre will reach out to you shortly.`,
      }),
      ar: (c) => ({
        body: `${brand}: تعذر إتمام توصيل حقيبتك (${c.pirNumber}). سيتواصل معك مركز خدمة العملاء قريباً.`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Hello ${c.passengerName}, we were unable to complete the delivery of your baggage (PIR ${c.pirNumber}). Our contact centre will call you shortly to arrange a new attempt: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `مرحباً ${c.passengerName}، تعذر إتمام توصيل حقيبتك (${c.pirNumber}). سيتصل بك مركز خدمة العملاء قريباً لترتيب محاولة جديدة: ${c.trackingUrl ?? ""}`,
      }),
    },
  },
  STAGE_RETURNED_TO_AIRPORT: {
    sms: {
      en: (c) => ({
        body: `${brand}: Your baggage (PIR ${c.pirNumber}) has been returned to the airport and is safely stored. Track: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `${brand}: تمت إعادة حقيبتك (${c.pirNumber}) إلى المطار وحفظها بأمان. تابع: ${c.trackingUrl ?? ""}`,
      }),
    },
    whatsapp: {
      en: (c) => ({
        body: `Hello ${c.passengerName}, your baggage (PIR ${c.pirNumber}) has been returned to the airport and is safely stored while we arrange the next delivery attempt: ${c.trackingUrl ?? ""}`,
      }),
      ar: (c) => ({
        body: `مرحباً ${c.passengerName}، تمت إعادة حقيبتك (${c.pirNumber}) إلى المطار وحفظها بأمان لحين ترتيب محاولة التوصيل التالية: ${c.trackingUrl ?? ""}`,
      }),
    },
  },
};

// Human labels for every trigger, including the non-canonical extras.
export const EXTRA_TRIGGER_LABELS: Record<ExtraTrigger, { en: string; ar: string }> = {
  STAGE_SCHEDULED: { en: "Delivery Scheduled", ar: "تمت جدولة التوصيل" },
  STAGE_COLLECTED: { en: "Collected Bag", ar: "تم استلام الحقيبة" },
  STAGE_DELIVERY_FAILED: { en: "Delivery Failed", ar: "فشل التوصيل" },
  STAGE_RETURNED_TO_AIRPORT: { en: "Returned to Airport", ar: "أُعيدت إلى المطار" },
};

export function isExtraTrigger(t: NotificationTrigger): t is ExtraTrigger {
  return (EXTRA_TRIGGERS as readonly string[]).includes(t);
}

// Map any trigger back to the canonical WorkflowStatus it belongs to, so
// Timeline / Reports keep a single status vocabulary.
export function triggerWorkflowStatus(t: NotificationTrigger): WorkflowStatus {
  switch (t) {
    case "STAGE_SCHEDULED":
      return "DELIVERY_APPROVED";
    case "STAGE_COLLECTED":
      return "CLAIMED_ON_HAND";
    case "STAGE_DELIVERY_FAILED":
      return "OUT_FOR_DELIVERY";
    case "STAGE_RETURNED_TO_AIRPORT":
      return "DELIVERY_APPROVED";
    default:
      return t;
  }
}

export function renderTemplate(
  status: NotificationTrigger,
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
// Client-safe shapes for the System Settings control panel.

import { WORKFLOW_LABELS, WORKFLOW_STATUSES } from "@/lib/workflow/statuses";

export interface GeneralSettings {
  system_name: string;
  company_name: string;
  logo_url: string;
  time_zone: string;
  date_format: string;
  default_language: "en" | "ar";
  distance_unit: "km" | "mi";
  /** Absolute public origin used to build passenger tracking links. */
  portal_base_url: string;
}

export interface ContactSettings {
  call_number: string;
  whatsapp_number: string;
  email: string;
}

export interface SlaSettings {
  lf_sla_hours: number;
}

export interface SlaRegion {
  id: string;
  name: string;
  name_ar: string;
  sla_hours: number;
  is_default: boolean;
  active: boolean;
  sort_order: number;
}

export type TemplateChannel = "sms" | "whatsapp" | "email";

export interface NotificationTemplateRow {
  id: string;
  trigger_key: string;
  channel: TemplateChannel;
  subject_en: string;
  subject_ar: string;
  body_en: string;
  body_ar: string;
  active: boolean;
}

export interface SystemSettingsBundle {
  general: GeneralSettings;
  contacts: ContactSettings;
  sla: SlaSettings;
  regions: SlaRegion[];
  templates: NotificationTemplateRow[];
  canManage: boolean;
}

export const DEFAULT_GENERAL: GeneralSettings = {
  system_name: "Smart Baggage Ecosystem",
  company_name: "International Aviation Business (IAB)",
  logo_url: "",
  time_zone: "Africa/Cairo",
  date_format: "dd/MM/yyyy",
  default_language: "en",
  distance_unit: "km",
  portal_base_url: "",
};

export const DEFAULT_CONTACTS: ContactSettings = {
  call_number: "",
  whatsapp_number: "",
  email: "",
};

export const TIME_ZONES = [
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Riyadh",
  "UTC",
] as const;

export const DATE_FORMATS = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd MMM yyyy"] as const;

/**
 * Passenger-facing lifecycle events an administrator can word.
 *
 * The catalog is never hardcoded: it is discovered at runtime from the
 * Workflow Engine status registry plus whatever trigger keys already exist in
 * `notification_templates`. A new workflow event therefore shows up in the
 * Notification Templates screen with no code change.
 */
export interface TemplateTrigger {
  key: string;
  label: string;
  labelAr: string;
  description: string;
}

/** Statuses the engine never sends a passenger message for. */
const NON_NOTIFYING_STATUSES = new Set<string>([
  "PIR_CREATED",
  "HOME_DELIVERY_REQUESTED",
  "READY_FOR_COLLECTION",
  "CLAIMED_ON_HAND",
  "OTP_VERIFIED",
  "FEEDBACK_SUBMITTED",
  "CLOSED",
]);

/** Labels for operational trigger keys that are not workflow statuses. */
const EXTRA_TRIGGER_LABELS: Record<string, { en: string; ar: string; description: string }> = {
  DELIVERY_FAILED: {
    en: "Delivery Unsuccessful",
    ar: "تعذر التوصيل",
    description: "Attempt could not be completed",
  },
  RETURNED_TO_AIRPORT: {
    en: "Returned to Airport",
    ar: "أُعيدت إلى المطار",
    description: "Baggage brought back for re-dispatch",
  },
};

function humanize(key: string): string {
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Merge the workflow registry with the trigger keys already stored in the
 * database, de-duplicated and ordered by the canonical lifecycle.
 */
export function buildTemplateTriggers(
  templates: Pick<NotificationTemplateRow, "trigger_key">[] = [],
): TemplateTrigger[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const push = (k: string) => {
    if (!k || seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  };

  for (const s of WORKFLOW_STATUSES) {
    if (!NON_NOTIFYING_STATUSES.has(s)) push(s);
  }
  for (const t of templates) push(t.trigger_key);

  return keys.map((key) => {
    const wf = (WORKFLOW_LABELS as Record<string, { en: string; ar: string } | undefined>)[key];
    const extra = EXTRA_TRIGGER_LABELS[key];
    return {
      key,
      label: wf?.en ?? extra?.en ?? humanize(key),
      labelAr: wf?.ar ?? extra?.ar ?? humanize(key),
      description: extra?.description ?? `Workflow event ${key}`,
    };
  });
}

export const TEMPLATE_VARIABLES = [
  "{{PassengerName}}",
  "{{PIR}}",
  "{{DeliveryID}}",
  "{{TrackingLink}}",
  "{{AgentName}}",
  "{{BagTag}}",
];

const SAMPLE: Record<string, string> = {
  "{{PassengerName}}": "Ahmed Hassan",
  "{{PIR}}": "CAI-BA-24019",
  "{{DeliveryID}}": "DEL-000019",
  "{{TrackingLink}}": "/passenger/9f3c2a7e51d4",
  "{{AgentName}}": "Mostafa Adel",
  "{{BagTag}}": "BA0084213",
};

/** Renders a template body with representative sample data for the preview pane. */
export function previewTemplate(body: string): string {
  return TEMPLATE_VARIABLES.reduce((acc, v) => acc.split(v).join(SAMPLE[v] ?? ""), body ?? "");
}
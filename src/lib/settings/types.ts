// Client-safe shapes for the System Settings control panel.

export interface GeneralSettings {
  system_name: string;
  company_name: string;
  logo_url: string;
  time_zone: string;
  date_format: string;
  default_language: "en" | "ar";
  distance_unit: "km" | "mi";
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

/** Passenger-facing lifecycle events an administrator can word. */
export const TEMPLATE_TRIGGERS: { key: string; label: string; description: string }[] = [
  { key: "DELIVERY_APPROVED", label: "Delivery Approved", description: "Home delivery request accepted" },
  { key: "DRIVER_ASSIGNED", label: "Delivery Agent Assigned", description: "Agent assigned and tracking link issued" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", description: "Agent has started the trip" },
  { key: "DELIVERED", label: "Delivered", description: "Baggage handed over to the passenger" },
  { key: "DELIVERY_FAILED", label: "Delivery Unsuccessful", description: "Attempt could not be completed" },
  { key: "RETURNED_TO_AIRPORT", label: "Returned to Airport", description: "Baggage brought back for re-dispatch" },
];

export const TEMPLATE_VARIABLES = [
  "{{PassengerName}}",
  "{{PIR}}",
  "{{TrackingLink}}",
  "{{AgentName}}",
  "{{BagTag}}",
];

const SAMPLE: Record<string, string> = {
  "{{PassengerName}}": "Ahmed Hassan",
  "{{PIR}}": "CAI-BA-24019",
  "{{TrackingLink}}": "/passenger/9f3c2a7e51d4",
  "{{AgentName}}": "Mostafa Adel",
  "{{BagTag}}": "BA0084213",
};

/** Renders a template body with representative sample data for the preview pane. */
export function previewTemplate(body: string): string {
  return TEMPLATE_VARIABLES.reduce((acc, v) => acc.split(v).join(SAMPLE[v] ?? ""), body ?? "");
}
// Client-safe description of every integration slot and monitored API.
// No credentials, no provider calls — this only drives the UI forms.

export type IntegrationKey =
  | "google_maps"
  | "sms_gateway"
  | "whatsapp"
  | "email"
  | "odoo"
  | "mobile_platform"
  | "cloud_database";

export type IntegrationStatus = "not_configured" | "connected" | "error" | "disabled";

export type FieldKind = "text" | "password" | "number" | "boolean" | "select" | "readonly";

export interface IntegrationField {
  /** Key inside `config` (public) or `secrets` (encrypted) */
  name: string;
  label: string;
  kind: FieldKind;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
}

export interface IntegrationDefinition {
  key: IntegrationKey;
  name: string;
  description: string;
  /** Read-only slots cannot be configured or disconnected (managed platform). */
  managed?: boolean;
  providers?: { value: string; label: string }[];
  fields: IntegrationField[];
  /** Optional free-text value collected only for the test call (e.g. test number). */
  testInputLabel?: string;
  testInputPlaceholder?: string;
}

export const ENVIRONMENTS = [
  { value: "development", label: "Development" },
  { value: "testing", label: "Testing" },
  { value: "production", label: "Production" },
];

export const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    key: "google_maps",
    name: "Google Maps Platform",
    description: "Directions, distance matrix, geocoding and places for route optimisation.",
    fields: [
      { name: "api_key", label: "API Key", kind: "password", secret: true, required: true, placeholder: "AIza..." },
      { name: "directions", label: "Directions API", kind: "boolean" },
      { name: "distance_matrix", label: "Distance Matrix API", kind: "boolean" },
      { name: "geocoding", label: "Geocoding API", kind: "boolean" },
      { name: "places", label: "Places API", kind: "boolean" },
    ],
  },
  {
    key: "sms_gateway",
    name: "SMS Gateway",
    description: "Transactional SMS for passenger notifications and tracking links.",
    providers: [
      { value: "twilio", label: "Twilio" },
      { value: "infobip", label: "Infobip" },
      { value: "vodafone", label: "Vodafone Business" },
      { value: "orange", label: "Orange Business" },
      { value: "etisalat", label: "Etisalat Business" },
      { value: "custom", label: "Custom REST API" },
    ],
    fields: [
      { name: "api_url", label: "API URL", kind: "text", required: true, placeholder: "https://api.provider.com" },
      { name: "api_key", label: "API Key / Account SID", kind: "password", secret: true, required: true },
      { name: "api_secret", label: "API Secret / Auth Token", kind: "password", secret: true },
      { name: "sender_id", label: "Sender ID", kind: "text", placeholder: "IAB" },
    ],
    testInputLabel: "Send test SMS to (optional)",
    testInputPlaceholder: "+201234567890",
  },
  {
    key: "whatsapp",
    name: "WhatsApp Business",
    description: "Meta Cloud API messaging for passenger updates.",
    fields: [
      { name: "phone_number_id", label: "Phone Number ID", kind: "text", required: true },
      { name: "business_account_id", label: "Business Account ID", kind: "text" },
      { name: "access_token", label: "Access Token", kind: "password", secret: true, required: true },
      { name: "verify_token", label: "Webhook Verify Token", kind: "password", secret: true },
      { name: "webhook_url", label: "Webhook URL", kind: "text", help: "Configure this URL in the Meta app dashboard." },
    ],
  },
  {
    key: "email",
    name: "Email Provider",
    description: "SMTP transport for tracking links, receipts and reports.",
    fields: [
      { name: "host", label: "SMTP Host", kind: "text", required: true, placeholder: "smtp.provider.com" },
      { name: "port", label: "SMTP Port", kind: "number", required: true, placeholder: "587" },
      { name: "secure", label: "Use TLS", kind: "boolean" },
      { name: "username", label: "Username", kind: "text" },
      { name: "password", label: "Password", kind: "password", secret: true },
      { name: "from_address", label: "From Address", kind: "text", placeholder: "baggage@iab.com" },
      { name: "from_name", label: "From Name", kind: "text" },
    ],
  },
  {
    key: "odoo",
    name: "Odoo ERP",
    description: "Financial, CRM and operations synchronisation for baggage cases.",
    fields: [
      { name: "base_url", label: "Base URL", kind: "text", required: true, placeholder: "https://erp.company.com" },
      { name: "database", label: "Database", kind: "text", required: true },
      { name: "username", label: "Username", kind: "text", required: true },
      { name: "api_key", label: "API Key / Password", kind: "password", secret: true, required: true },
    ],
  },
  {
    key: "mobile_platform",
    name: "Mobile Platform",
    description: "Delivery Agent and passenger mobile ecosystem: builds, versions and push.",
    fields: [
      { name: "ios_bundle_id", label: "iOS Bundle ID", kind: "text", placeholder: "com.iab.baggage" },
      { name: "android_package", label: "Android Package", kind: "text", placeholder: "com.iab.baggage" },
      { name: "min_supported_version", label: "Minimum Supported Version", kind: "text", placeholder: "1.0.0" },
      { name: "force_update", label: "Force Update", kind: "boolean" },
      { name: "push_provider", label: "Push Provider", kind: "text", placeholder: "FCM" },
      { name: "push_server_key", label: "Push Server Key", kind: "password", secret: true },
    ],
  },
  {
    key: "cloud_database",
    name: "Cloud Database",
    description: "Managed PostgreSQL powering the entire ecosystem.",
    managed: true,
    fields: [],
  },
];

export function definitionFor(key: string): IntegrationDefinition | undefined {
  return INTEGRATION_DEFINITIONS.find((d) => d.key === key);
}

export const MONITORED_APIS: { key: string; name: string; kind: "internal" | "external" }[] = [
  { key: "workflow", name: "Workflow API", kind: "internal" },
  { key: "notification", name: "Notification API", kind: "internal" },
  { key: "passenger", name: "Passenger API", kind: "internal" },
  { key: "driver", name: "Delivery Agent API", kind: "internal" },
  { key: "quality", name: "Quality Management API", kind: "internal" },
  { key: "reporting", name: "Reporting API", kind: "internal" },
  { key: "database", name: "Database API", kind: "internal" },
  { key: "google_maps", name: "Google Maps API", kind: "external" },
  { key: "sms_gateway", name: "SMS Gateway API", kind: "external" },
  { key: "whatsapp", name: "WhatsApp API", kind: "external" },
  { key: "email", name: "Email API", kind: "external" },
  { key: "odoo", name: "Odoo API", kind: "external" },
  { key: "mobile_platform", name: "Mobile Platform API", kind: "external" },
];

export interface IntegrationView {
  key: string;
  name: string;
  category: string;
  provider: string;
  environment: string;
  version: string;
  enabled: boolean;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  secretsSet: string[];
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string;
  lastSyncAt: string | null;
  lastLatencyMs: number | null;
  updatedAt: string;
}

export interface IntegrationEventView {
  id: number;
  integration_key: string;
  action: string;
  outcome: string;
  actor_name: string;
  latency_ms: number | null;
  detail: string;
  error: string;
  occurred_at: string;
}

export interface ApiHealthView {
  key: string;
  name: string;
  kind: "internal" | "external";
  status: "operational" | "degraded" | "down" | "not_configured";
  version: string;
  latencyMs: number | null;
  lastHeartbeat: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  uptimePct: number | null;
  errorCount: number;
  successRate: number | null;
  samples: number;
  lastError: string;
}

export interface SystemCenterData {
  integrations: IntegrationView[];
  events: IntegrationEventView[];
  apis: ApiHealthView[];
  database: {
    provider: string;
    environment: string;
    database: string;
    realtime: boolean;
    storage: boolean;
    backup: string;
    latencyMs: number | null;
    健?: never;
  } | null;
}
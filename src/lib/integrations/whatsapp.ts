export interface WhatsAppProvider {
  send(to: string, body: string, opts?: { template?: string; locale?: "en" | "ar" }): Promise<{ ok: boolean; providerId?: string }>;
}
export const noopWhatsApp: WhatsAppProvider = { async send() { return { ok: true } } };

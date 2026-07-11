export interface SmsProvider {
  send(to: string, body: string): Promise<{ ok: boolean; providerId?: string }>;
}
export const noopSms: SmsProvider = { async send() { return { ok: true } } };

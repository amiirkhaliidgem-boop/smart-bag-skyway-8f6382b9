// Odoo ERP integration seam. Real client goes here later.
export interface OdooClientConfig { baseUrl: string; db: string; apiKey: string }
export interface OdooClient {
  syncDelivery(deliveryId: string): Promise<{ ok: boolean }>;
  syncIncident(incidentId: string): Promise<{ ok: boolean }>;
}
export function createOdooClient(_cfg: OdooClientConfig): OdooClient {
  return {
    async syncDelivery() { return { ok: true } },
    async syncIncident() { return { ok: true } },
  }
}

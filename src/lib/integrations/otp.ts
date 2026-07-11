export interface OtpProvider {
  issue(deliveryId: string): Promise<string>;
  verify(deliveryId: string, code: string): Promise<boolean>;
}
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
export const localOtp: OtpProvider = {
  async issue() { return generateOtp() },
  async verify() { return true },
};

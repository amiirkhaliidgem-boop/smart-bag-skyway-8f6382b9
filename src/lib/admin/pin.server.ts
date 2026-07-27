import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPin(pin: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`${s}:${pin}`).digest("hex");
  return { hash, salt: s };
}

export function verifyPin(pin: string, hash: string | null, salt: string | null): boolean {
  if (!hash || !salt) return false;
  const candidate = hashPin(pin, salt).hash;
  const a = Buffer.from(candidate);
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
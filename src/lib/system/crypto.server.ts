// AES-256-GCM envelope for integration credentials. Server-only.
// The key is the INTEGRATION_CONFIG_SECRET project secret; plaintext never
// leaves this module and is never returned to the browser.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.INTEGRATION_CONFIG_SECRET;
  if (!raw) {
    throw new Error(
      "INTEGRATION_CONFIG_SECRET is not configured. Credentials cannot be stored securely.",
    );
  }
  // Derive a fixed 32-byte key from the configured secret of any length.
  return createHash("sha256").update(raw).digest();
}

export function encryptSecrets(values: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([
    cipher.update(JSON.stringify(values), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecrets(stored: string | null | undefined): Record<string, string> {
  if (!stored) return {};
  try {
    const buf = Buffer.from(stored, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString(
      "utf8",
    );
    return JSON.parse(plain) as Record<string, string>;
  } catch {
    return {};
  }
}
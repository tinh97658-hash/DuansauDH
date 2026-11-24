import crypto from "node:crypto";

const CIPHER_ALGORITHM = "aes-256-gcm";
const CIPHER_PREFIX_V1 = "enc:v1:";
const CIPHER_PREFIX_V2 = "enc:v2:";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;
const HKDF_SALT = Buffer.from("pgsms-pii-v1", "utf8");
const ENC_INFO = Buffer.from("aes-256-gcm", "utf8");
const HMAC_INFO = Buffer.from("blind-index", "utf8");

interface DerivedKeys {
  rawKey: string;
  encKey: Buffer;
  hmacKey: Buffer;
}

let cachedKeys: DerivedKeys | null = null;

export function parseEncryptionKey(raw: string | undefined | null): Buffer | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  // Strict base64 check for 32-byte key (44 chars with '=' padding or 43 without)
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === KEY_LENGTH_BYTES) return decoded;
  }

  return null;
}

export function isValidEncryptionKey(raw: string | undefined | null): boolean {
  return parseEncryptionKey(raw) !== null;
}

function getDerivedKeys(): DerivedKeys | null {
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim() || "";
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATA_ENCRYPTION_KEY is required in production.");
    }
    return null;
  }

  if (cachedKeys && cachedKeys.rawKey === raw) {
    return cachedKeys;
  }

  const masterKey = parseEncryptionKey(raw);
  if (!masterKey) {
    throw new Error(
      "DATA_ENCRYPTION_KEY must be a 64-character hex string or a 32-byte base64 string.",
    );
  }

  const encKey = Buffer.from(
    crypto.hkdfSync("sha256", masterKey, HKDF_SALT, ENC_INFO, KEY_LENGTH_BYTES),
  );
  const hmacKey = Buffer.from(
    crypto.hkdfSync("sha256", masterKey, HKDF_SALT, HMAC_INFO, KEY_LENGTH_BYTES),
  );

  cachedKeys = { rawKey: raw, encKey, hmacKey };
  return cachedKeys;
}

export function isPiiEncryptionEnabled(): boolean {
  return getDerivedKeys() !== null;
}

export function isEncryptedPii(value: string | null | undefined): boolean {
  return typeof value === "string" && (value.startsWith(CIPHER_PREFIX_V1) || value.startsWith(CIPHER_PREFIX_V2));
}

export function encryptPii(value: string | null | undefined, aad?: string): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (text === "") return text;

  const keys = getDerivedKeys();
  if (!keys) return text;

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, keys.encKey, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  const prefix = aad ? CIPHER_PREFIX_V2 : CIPHER_PREFIX_V1;
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${prefix}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Migration/backfill-only helper: skips values already stored as ciphertext.
 * Never call on untrusted user input (use `encryptPii` instead).
 */
export function encryptPiiIfPlaintext(value: string | null | undefined, aad?: string): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (text === "" || isEncryptedPii(text)) return text;
  return encryptPii(text, aad);
}

export function decryptPii(value: string | null | undefined, aad?: string): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  const isV2 = text.startsWith(CIPHER_PREFIX_V2);
  const isV1 = !isV2 && text.startsWith(CIPHER_PREFIX_V1);
  if (!isV1 && !isV2) return text;

  const keys = getDerivedKeys();
  if (!keys) {
    throw new Error("Cannot decrypt PII value because DATA_ENCRYPTION_KEY is not configured.");
  }

  const payload = text.slice(isV2 ? CIPHER_PREFIX_V2.length : CIPHER_PREFIX_V1.length);
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted PII payload.");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Invalid encrypted PII metadata length.");
  }

  const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, keys.encKey, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  if (isV2) {
    if (!aad) throw new Error("Missing AAD context for enc:v2 PII payload.");
    decipher.setAAD(Buffer.from(aad, "utf8"));
  }
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function computeBlindIndex(context: "id_card" | "phone", normalized: string): string | null {
  if (!normalized) return null;
  const keys = getDerivedKeys();
  if (!keys) return null;
  return crypto
    .createHmac("sha256", keys.hmacKey)
    .update(`${context}:${normalized}`)
    .digest("hex");
}

export function normalizeIdCard(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).trim().replace(/[\s.\-()]/g, "");
}

export function hashIdCard(
  value: string | null | undefined,
  options?: { allowEncrypted?: boolean; aad?: string },
): string | null {
  if (!value) return null;
  const plain = options?.allowEncrypted && isEncryptedPii(value) ? decryptPii(value, options.aad) : value;
  return computeBlindIndex("id_card", normalizeIdCard(plain));
}

export function hashPhone(
  value: string | null | undefined,
  options?: { allowEncrypted?: boolean; aad?: string },
): string | null {
  if (!value) return null;
  const plain = options?.allowEncrypted && isEncryptedPii(value) ? decryptPii(value, options.aad) : value;
  return computeBlindIndex("phone", normalizePhone(plain));
}

/** Test-only helper to clear derived key cache when rotating process.env in unit tests. */
export function resetPiiKeyCache(): void {
  cachedKeys = null;
}

import crypto from "node:crypto";
import {
  decryptPii,
  encryptPii,
  encryptPiiIfPlaintext,
  hashIdCard,
  hashPhone,
  isEncryptedPii,
  isPiiEncryptionEnabled,
  isValidEncryptionKey,
  resetPiiKeyCache,
} from "../../src/common/pii-encryption.js";
import { redactCredentials } from "../../src/audit/credential-redaction.js";

describe("pii-encryption", () => {
  const originalKey = process.env.DATA_ENCRYPTION_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
  const validHexKey = crypto.randomBytes(32).toString("hex");
  const validBase64Key = crypto.randomBytes(32).toString("base64");

  afterEach(() => {
    if (originalKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = originalKey;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    resetPiiKeyCache();
  });

  it("validates 32-byte hex and base64 encryption keys", () => {
    expect(isValidEncryptionKey(validHexKey)).toBe(true);
    expect(isValidEncryptionKey(validBase64Key)).toBe(true);
    expect(isValidEncryptionKey("too-short")).toBe(false);
    expect(isValidEncryptionKey("")).toBe(false);
    expect(isValidEncryptionKey(undefined)).toBe(false);
  });

  it("encrypts and decrypts PII with randomized IV, AAD context binding, and rejects decryption oracle", () => {
    process.env.DATA_ENCRYPTION_KEY = validHexKey;
    resetPiiKeyCache();

    expect(isPiiEncryptionEnabled()).toBe(true);
    const plain = "031099001234";
    const aad = "admission_records:id_card";
    const c1 = encryptPii(plain, aad);
    const c2 = encryptPii(plain, aad);

    expect(c1).not.toBe(plain);
    expect(c2).not.toBe(plain);
    expect(c1).not.toBe(c2); // randomized IV
    expect(c1?.startsWith("enc:v2:")).toBe(true);
    expect(isEncryptedPii(c1)).toBe(true);
    expect(decryptPii(c1, aad)).toBe(plain);
    expect(decryptPii(c2, aad)).toBe(plain);

    // Wrong or missing AAD must fail authentication
    expect(() => decryptPii(c1, "admission_records:phone")).toThrow();
    expect(() => decryptPii(c1)).toThrow();

    // encryptPii must NOT skip values with enc:v1:/enc:v2: prefix (prevents decryption oracle & DoS)
    const reEncrypted = encryptPii(c1, "admission_records:ward")!;
    expect(reEncrypted).not.toBe(c1);
    expect(decryptPii(reEncrypted, "admission_records:ward")).toBe(c1);

    const malformedInput = "enc:v1:malformed";
    const encryptedMalformed = encryptPii(malformedInput, "admission_records:ward")!;
    expect(decryptPii(encryptedMalformed, "admission_records:ward")).toBe(malformedInput);

    // Backfill-only helper remains idempotent
    expect(encryptPiiIfPlaintext(c1, aad)).toBe(c1);
  });

  it("handles null, empty, and legacy plaintext values safely", () => {
    process.env.DATA_ENCRYPTION_KEY = validHexKey;
    resetPiiKeyCache();

    expect(encryptPii(null)).toBeNull();
    expect(encryptPii(undefined)).toBeNull();
    expect(encryptPii("")).toBe("");
    expect(decryptPii(null)).toBeNull();
    expect(decryptPii("legacy-plaintext")).toBe("legacy-plaintext");
  });

  it("rejects tampered ciphertext", () => {
    process.env.DATA_ENCRYPTION_KEY = validHexKey;
    resetPiiKeyCache();

    const encrypted = encryptPii("0912345678")!;
    const tampered = `${encrypted.slice(0, -4)}AAAA`;
    expect(() => decryptPii(tampered)).toThrow();
  });

  it("computes deterministic, normalized, domain-separated blind indexes", () => {
    process.env.DATA_ENCRYPTION_KEY = validBase64Key;
    resetPiiKeyCache();

    const h1 = hashIdCard(" 031 099 001234 ");
    const h2 = hashIdCard("031099001234");
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);

    const p1 = hashPhone("0912.345-678");
    const p2 = hashPhone("0912345678");
    expect(p1).toHaveLength(64);
    expect(p1).toBe(p2);

    // Same digits in different domains produce different hashes
    expect(hashIdCard("0912345678")).not.toBe(hashPhone("0912345678"));

    // Hashing an already encrypted value only decrypts when explicitly opted in for backfill
    const encryptedId = encryptPii("031099001234", "admission_records:id_card");
    expect(hashIdCard(encryptedId, { allowEncrypted: true, aad: "admission_records:id_card" })).toBe(h2);
    expect(hashIdCard(encryptedId)).not.toBe(h2);
  });

  it("fails closed in production when DATA_ENCRYPTION_KEY is missing", () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    process.env.NODE_ENV = "production";
    resetPiiKeyCache();

    expect(() => encryptPii("031099001234")).toThrow(/DATA_ENCRYPTION_KEY/);
  });

  it("redacts credentials, sessionVersion, blind indexes, and encrypted PII in audit payloads", () => {
    const redacted = redactCredentials({
      dataEncryptionKey: validHexKey,
      data_encryption_key: validHexKey,
      sessionVersion: 3,
      session_version: 3,
      idCardHash: "abc",
      phone_hash: "def",
      tel_no_hash: "ghi",
      phone: "enc:v2:abc:def:ghi",
      safeField: "ok",
    });
    expect(redacted.dataEncryptionKey).toBe("[REDACTED]");
    expect(redacted.data_encryption_key).toBe("[REDACTED]");
    expect(redacted.sessionVersion).toBe("[REDACTED]");
    expect(redacted.session_version).toBe("[REDACTED]");
    expect(redacted.idCardHash).toBe("[REDACTED]");
    expect(redacted.phone_hash).toBe("[REDACTED]");
    expect(redacted.tel_no_hash).toBe("[REDACTED]");
    expect(redacted.phone).toBe("[ENCRYPTED]");
    expect(redacted.safeField).toBe("ok");
  });
});

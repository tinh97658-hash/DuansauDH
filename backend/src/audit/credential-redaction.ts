/** Credential values only: keep must_change_password, password_changed_at,
 * password_reset_expires and other business metadata visible. Normalize both
 * database snake_case and serialized camelCase names. Keep migration 065's
 * frozen SQL policy in sync when extending this policy in a new migration. */
export const CREDENTIAL_KEYS = [
  "password", "passwordhash", "passwordresettoken", "resettoken",
  "refreshtoken", "accesstoken", "apikey", "secret", "clientsecret",
  "sessionsecret", "privatekey", "totpsecret", "mfasecret",
  "recoverycodes", "backupcodes",
] as const;

const sensitive = new Set<string>(CREDENTIAL_KEYS);
export function redactCredentials(value: unknown): any {
  if (Array.isArray(value)) return value.map(redactCredentials);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    sensitive.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""))
      ? "[REDACTED]" : redactCredentials(entry),
  ]));
}

import type { ConfigService } from "@nestjs/config";

export function isSessionCookieSecure(config: ConfigService): boolean {
  const configured = config.get<boolean>("SESSION_COOKIE_SECURE");
  if (typeof configured === "boolean") return configured;
  return config.get<string>("NODE_ENV") === "production";
}

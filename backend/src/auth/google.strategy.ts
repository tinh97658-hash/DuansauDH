import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-google-oauth2";
import { AuthService } from "./auth.service.js";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService, private readonly auth: AuthService) {
    super({
      clientID: config.get<string>("GOOGLE_CLIENT_ID") || "disabled",
      clientSecret: config.get<string>("GOOGLE_CLIENT_SECRET") || "disabled",
      callbackURL: `${String(config.get("API_PUBLIC_URL")).replace(/\/$/, "")}/auth/google/callback`,
      scope: ["email", "profile"],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: any) {
    const email = profile.email || profile.emails?.[0]?.value;
    return this.auth.validateGoogle(email);
  }
}

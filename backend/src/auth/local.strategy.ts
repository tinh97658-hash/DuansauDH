import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "./auth.service.js";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: "email", passwordField: "password" });
  }

  validate(email: unknown, password: unknown) {
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password || password.length > 72) {
      throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
    }
    return this.auth.validateLocal(email, password);
  }
}

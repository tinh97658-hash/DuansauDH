import { Controller, Get, HttpCode, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { CurrentUser } from "../common/auth-user.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { Staff } from "../database/models/staff.model.js";
import { GoogleAuthGuard } from "./auth.guards.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly config: ConfigService) {}

  @Get("capabilities")
  capabilities() {
    return { googleAuthEnabled: Boolean(this.config.get("GOOGLE_CLIENT_ID") && this.config.get("GOOGLE_CLIENT_SECRET")) };
  }

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  google() {}

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Res() response: Response) {
    return response.redirect(`${String(this.config.get("FRONTEND_URL")).replace(/\/$/, "")}/procedure`);
  }

  @Get("google/failure")
  googleFailure(@Res() response: Response) {
    return response.redirect(`${String(this.config.get("FRONTEND_URL")).replace(/\/$/, "")}/login`);
  }

  @Get("session")
  session(@Req() request: any) {
    const authenticated = Boolean(request.isAuthenticated?.() && request.user);
    return { authenticated, user: authenticated ? request.user : null };
  }

  @Get("login/success")
  loginSuccess(@Req() request: any) { return this.session(request); }

  @Get("loginSuccess")
  loginSuccessLegacy(@Req() request: any) {
    const result = this.session(request);
    return { success: result.authenticated, message: result.authenticated ? "Đăng nhập thành công" : "Chưa đăng nhập", user: result.user };
  }

  @Get("isStaff")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(200)
  isStaff(@CurrentUser() user: any) { return { message: user instanceof Staff ? user.role : "student" }; }
}

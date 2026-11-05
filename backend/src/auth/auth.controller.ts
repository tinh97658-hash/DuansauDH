import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { CurrentUser } from "../common/auth-user.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { Staff } from "../database/models/staff.model.js";
import { GoogleAuthGuard } from "./auth.guards.js";
import { RbacService } from './rbac.service.js';
import { AuditService } from '../audit/audit.service.js';
import { IsUUID } from 'class-validator';
import { LogoutOriginGuard } from './logout-origin.guard.js';
class SelectWorkingProfileDto {@IsUUID() profileId!:string;}

@Controller("auth")
export class AuthController {
  constructor(private readonly config: ConfigService,private readonly rbac:RbacService,private readonly audit:AuditService) {}

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
    return { authenticated, user: authenticated ? request.user : null,
      profiles:authenticated?request.workingProfiles||[]:[],activeProfile:authenticated?request.activeProfile||null:null,
      profileSelectionRequired:authenticated&&request.user instanceof Staff?request.profileSelectionRequired===true:false };
  }

  @Get('profiles') @UseGuards(AuthenticatedGuard)
  profiles(@Req() request:any){return {profiles:request.workingProfiles||[],activeProfile:request.activeProfile||null};}

  @Post('profiles/select') @UseGuards(AuthenticatedGuard,LogoutOriginGuard) @HttpCode(200)
  async selectProfile(@Req() request:any,@Body() dto:SelectWorkingProfileDto){
    if(!(request.user instanceof Staff)||!request.session)throw new ForbiddenException('Không thể chọn hồ sơ làm việc.');
    const profile=(await this.rbac.profiles(request.user)).find(value=>value.id===dto.profileId);
    if(!profile)throw new ForbiddenException('Hồ sơ không được gán cho tài khoản hoặc đã bị vô hiệu hóa.');
    const before=request.session.activeProfileId||null;
    request.session.activeProfileId=profile.id;
    await new Promise<void>((resolve,reject)=>request.session.save((error:any)=>error?reject(error):resolve()));
    this.rbac.invalidate(request.user.id);
    await this.audit.record({actorStaffId:request.user.id,action:'auth.profile.switch',metadata:{beforeProfileId:before,afterProfileId:profile.id},ip:request.ip,userAgent:request.get?.('user-agent')});
    return {activeProfile:profile};
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
  isStaff(@CurrentUser() user: any,@Req() request:any) { return { message: user instanceof Staff ? request.activeProfile?.code||user.role : "student" }; }
}

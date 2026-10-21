import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../common/auth-user.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { AllowPasswordChangeRequired } from "../common/allow-password-change-required.decorator.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { AccountsService, RequestContext } from "./accounts.service.js";
import {
  AccountListQueryDto,
  AuditLogQueryDto,
  ChangeLogQueryDto,
  ChangeOwnPasswordDto,
  CreateAccountDto,
  ResetAccountPasswordDto,
  UpdateAccountDto,
  UpdateAccountStatusDto,
} from "./dto/account.dto.js";

const contextFrom = (request: Request): RequestContext => ({
  ip: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
});

@Controller("accounts")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get("me/permissions")
  @AllowPasswordChangeRequired()
  mePermissions(@CurrentUser() user: any) {
    return this.accounts.mePermissions(user);
  }

  @Patch("me/password")
  @AllowPasswordChangeRequired()
  changeOwnPassword(@CurrentUser() user: any, @Body() dto: ChangeOwnPasswordDto, @Req() request: Request) {
    return this.accounts.changeOwnPassword(user, dto, contextFrom(request));
  }

  @Get("audit-logs")
  @RequirePermissions("audit.view")
  auditLogs(@Query() query: AuditLogQueryDto) {
    return this.accounts.auditLogs(query);
  }

  @Get("change-logs")
  @RequirePermissions("audit.view")
  changeLogs(@Query() query: ChangeLogQueryDto) {
    return this.accounts.changeLogs(query);
  }

  @Get("change-logs/tables")
  @RequirePermissions("audit.view")
  changeLogTables() {
    return this.accounts.changeLogTables();
  }

  @Get()
  @RequirePermissions("account.view")
  list(@Query() query: AccountListQueryDto) {
    return this.accounts.list(query);
  }

  @Post()
  @RequirePermissions("account.manage")
  create(@CurrentUser() user: any, @Body() dto: CreateAccountDto, @Req() request: Request) {
    return this.accounts.create(user.id, dto, contextFrom(request));
  }

  @Get(":id")
  @RequirePermissions("account.view")
  detail(@Param("id") id: string) {
    return this.accounts.detail(id);
  }

  @Put(":id")
  @RequirePermissions("account.manage")
  update(@CurrentUser() user: any, @Param("id") id: string, @Body() dto: UpdateAccountDto, @Req() request: Request) {
    return this.accounts.update(user.id, id, dto, contextFrom(request));
  }

  @Patch(":id/status")
  @RequirePermissions("account.manage")
  updateStatus(@CurrentUser() user: any, @Param("id") id: string, @Body() dto: UpdateAccountStatusDto, @Req() request: Request) {
    return this.accounts.updateStatus(user.id, id, dto, contextFrom(request));
  }

  @Post(":id/reset-password")
  @RequirePermissions("account.password.reset")
  resetPassword(@CurrentUser() user: any, @Param("id") id: string, @Body() dto: ResetAccountPasswordDto, @Req() request: Request) {
    return this.accounts.resetPassword(user.id, id, dto, contextFrom(request));
  }

  @Post(":id/revoke-sessions")
  @RequirePermissions("account.manage")
  revokeSessions(@CurrentUser() user: any, @Param("id") id: string, @Req() request: Request) {
    return this.accounts.revokeSessions(user.id, id, contextFrom(request));
  }
}

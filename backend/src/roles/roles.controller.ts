import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../common/auth-user.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from "./dto/role.dto.js";
import { RequestContext, RolesService } from "./roles.service.js";

const contextFrom = (request: Request): RequestContext => ({
  ip: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
});

@Controller("roles")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get("permissions")
  @RequirePermissions("role.view")
  permissionsCatalog() {
    return this.roles.permissionsCatalog();
  }

  @Get()
  @RequirePermissions("role.view")
  list() {
    return this.roles.list();
  }

  @Post()
  @RequirePermissions("role.manage")
  create(@CurrentUser() user: any, @Body() dto: CreateRoleDto, @Req() request: Request) {
    return this.roles.create(user.id, dto, contextFrom(request));
  }

  @Get(":id")
  @RequirePermissions("role.view")
  detail(@Param("id") id: string) {
    return this.roles.detail(id);
  }

  @Put(":id")
  @RequirePermissions("role.manage")
  update(@CurrentUser() user: any, @Param("id") id: string, @Body() dto: UpdateRoleDto, @Req() request: Request) {
    return this.roles.update(user.id, id, dto, contextFrom(request));
  }

  @Put(":id/permissions")
  @RequirePermissions("role.manage")
  setPermissions(@CurrentUser() user: any, @Param("id") id: string, @Body() dto: SetRolePermissionsDto, @Req() request: Request) {
    return this.roles.setPermissions(user.id, id, dto, contextFrom(request));
  }

  @Delete(":id")
  @RequirePermissions("role.manage")
  remove(@CurrentUser() user: any, @Param("id") id: string, @Req() request: Request) {
    return this.roles.remove(user.id, id, contextFrom(request));
  }
}

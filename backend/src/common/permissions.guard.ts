import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RbacService } from "../auth/rbac.service.js";
import { Staff } from "../database/models/staff.model.js";
import { PERMISSIONS_KEY } from "./permissions.decorator.js";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!request.isAuthenticated?.()) throw new UnauthorizedException("Vui lòng đăng nhập để tiếp tục");

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) || [];
    if (!required.length) return true;

    const user = request.user;
    if (!(user instanceof Staff)) throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");

    const access = await this.rbac.effectiveAccess(user);
    if (!required.every((permission) => access.permissions.has(permission))) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }
    return true;
  }
}

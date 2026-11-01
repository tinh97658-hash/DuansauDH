import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RbacService } from "../auth/rbac.service.js";
import { Staff } from "../database/models/staff.model.js";
import { PERMISSIONS_KEY, ANY_PERMISSIONS_KEY, ACTION_PERMISSIONS_KEY } from "./permissions.decorator.js";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!request.isAuthenticated?.()) throw new UnauthorizedException("Vui lòng đăng nhập để tiếp tục");

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) || [];
    const any = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) || [];
    const actions = this.reflector.getAllAndOverride<Record<string, string>>(ACTION_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    const actionPermission = actions && Object.hasOwn(actions, request.body?.action) ? actions[request.body.action] : undefined;
    if (actions && !actionPermission) throw new ForbiddenException("Thao tác không được phép.");
    if (!required.length && !any.length && !actions) return true;

    const user = request.user;
    if (!(user instanceof Staff)) throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");

    const access = await this.rbac.effectiveAccess(user, !['GET', 'HEAD', 'OPTIONS'].includes(request.method));
    if (!required.every((permission) => access.permissions.has(permission)) || (actionPermission && !access.permissions.has(actionPermission)) || (any.length > 0 && !any.some(permission => access.permissions.has(permission)))) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }
    return true;
  }
}

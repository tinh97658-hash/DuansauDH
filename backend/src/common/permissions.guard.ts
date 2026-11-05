import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RbacService } from "../auth/rbac.service.js";
import { Staff } from "../database/models/staff.model.js";
import { PERMISSIONS_KEY, ANY_PERMISSIONS_KEY, ACTION_PERMISSIONS_KEY } from "./permissions.decorator.js";
import { workingProfileStorage } from '../auth/profile-context.js';
import { routePermissionAllowed,permissionRoutesForRequest } from '../auth/route-authorization.js';

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
    const profile=workingProfileStorage.getStore();
    if (!required.length && !any.length && !actions && (!profile||!permissionRoutesForRequest(request.originalUrl||request.url||'',request.method).length)) return true;

    const user = request.user;
    if (!(user instanceof Staff)) throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");

    const access = await this.rbac.effectiveAccess(user, !['GET', 'HEAD', 'OPTIONS'].includes(request.method));
    if(!['GET','HEAD','OPTIONS'].includes(request.method)&&access.groupScope?.readOnly)throw new ForbiddenException('Hồ sơ đang ở chế độ Chỉ xem, không được thay đổi dữ liệu.');
    if(profile&&!routePermissionAllowed(access.permissions,request.originalUrl||request.url||'',request.method,
      [...required,...(actionPermission?[actionPermission]:[])]))throw new ForbiddenException('Hồ sơ không có quyền mở trang hoặc thực hiện hành động của trang này.');
    if (!required.every((permission) => access.permissions.has(permission)) || (actionPermission && !access.permissions.has(actionPermission)) || (any.length > 0 && !any.some(permission => access.permissions.has(permission)))) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }
    return true;
  }
}

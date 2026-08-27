import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Staff } from "../database/models/staff.model.js";
import { Student } from "../database/models/student.model.js";
import { ROLES_KEY } from "./auth-user.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!request.isAuthenticated?.()) throw new UnauthorizedException("Vui lòng đăng nhập để tiếp tục");
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) || [];
    const role = request.user instanceof Student
      ? "student"
      : request.user instanceof Staff
        ? request.user.role
        : undefined;
    if (roles.length && (!role || !roles.includes(role))) throw new UnauthorizedException("Bạn không có quyền thực hiện thao tác này");
    return true;
  }
}

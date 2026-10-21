import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Staff } from "../database/models/staff.model.js";
import { ALLOW_PASSWORD_CHANGE_REQUIRED } from "./allow-password-change-required.decorator.js";

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!request.isAuthenticated?.()) throw new UnauthorizedException("Vui lòng đăng nhập để tiếp tục");
    if (request.user instanceof Staff && request.user.mustChangePassword === true &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_REQUIRED, [context.getHandler(), context.getClass()])) {
      throw new ForbiddenException("Bạn phải đổi mật khẩu trước khi sử dụng chức năng này.");
    }
    return true;
  }
}

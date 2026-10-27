import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { RbacService } from "../auth/rbac.service.js";
import { Staff } from "../database/models/staff.model.js";

export const canWriteScheduling = (user: unknown, permissions: ReadonlySet<string>): boolean =>
  user instanceof Staff && permissions.has("scheduling.write");

@Injectable()
export class SchedulingWriteGuard implements CanActivate {
  constructor(private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!(request.user instanceof Staff)) throw new ForbiddenException("Bạn không có quyền chỉnh sửa lịch đào tạo.");
    const access = await this.rbac.effectiveAccess(request.user);
    if (!canWriteScheduling(request.user, access.permissions) || access.groupScope?.readOnly) {
      throw new ForbiddenException("Bạn chưa có quyền xếp, sửa và xác nhận lịch hoặc vai trò đang bị khóa chỉ xem.");
    }
    return true;
  }
}

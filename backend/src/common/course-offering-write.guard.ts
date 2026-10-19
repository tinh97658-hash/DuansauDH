import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { RbacService } from "../auth/rbac.service.js";
import { Staff } from "../database/models/staff.model.js";

/**
 * Tổ chức lớp học phần: cho phép cán bộ có quyền `scheduling.organize` hoặc cán bộ
 * được phân công quản lý lịch đào tạo (`canManageScheduling`).
 */
@Injectable()
export class CourseOfferingWriteGuard implements CanActivate {
  constructor(private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (!(user instanceof Staff)) throw new ForbiddenException("Bạn không có quyền tổ chức lớp học phần.");
    if (user.canManageScheduling === true) return true;
    const access = await this.rbac.effectiveAccess(user);
    if (!access.permissions.has("scheduling.organize")) throw new ForbiddenException("Bạn không có quyền tổ chức lớp học phần.");
    return true;
  }
}

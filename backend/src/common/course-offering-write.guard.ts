import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { RbacService } from "../auth/rbac.service.js";
import { Staff } from "../database/models/staff.model.js";

/**
 * Tổ chức lớp học phần theo quyền vai trò; phân công phụ trách không thay thế quyền nghiệp vụ.
 */
@Injectable()
export class CourseOfferingWriteGuard implements CanActivate {
  constructor(private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (!(user instanceof Staff)) throw new ForbiddenException("Bạn không có quyền tổ chức lớp học phần.");
    const access = await this.rbac.effectiveAccess(user);
    if (!access.permissions.has("scheduling.organize") || access.groupScope?.readOnly) throw new ForbiddenException("Bạn không có quyền tổ chức lớp học phần.");
    return true;
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Staff } from "../database/models/staff.model.js";

@Injectable()
export class CourseOfferingWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (!(user instanceof Staff) || (user.role !== "admin" && user.canManageScheduling !== true)) {
      throw new ForbiddenException("Bạn không có quyền tổ chức lớp học phần.");
    }
    return true;
  }
}

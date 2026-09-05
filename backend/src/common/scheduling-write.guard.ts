import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Staff } from "../database/models/staff.model.js";

@Injectable()
export class SchedulingWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!(request.user instanceof Staff) || request.user.canManageScheduling !== true) {
      throw new ForbiddenException("Bạn không được phân công chỉnh sửa lịch đào tạo.");
    }
    return true;
  }
}

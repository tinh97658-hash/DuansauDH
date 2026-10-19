import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Staff } from "../database/models/staff.model.js";

export const canWriteScheduling = (user: unknown): boolean =>
  user instanceof Staff && user.canManageScheduling === true;

@Injectable()
export class SchedulingWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!canWriteScheduling(request.user)) {
      throw new ForbiddenException("Bạn không được phân công chỉnh sửa lịch đào tạo.");
    }
    return true;
  }
}

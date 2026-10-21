import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Student } from "../database/models/student.model.js";

/**
 * Chỉ cho phép học viên (Student) truy cập. Dùng cho các API tự phục vụ của học viên
 * (đổi mật khẩu, nộp bài, cập nhật ảnh) — nhân sự không thuộc phạm vi RBAC.
 */
@Injectable()
export class StudentGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!request.isAuthenticated?.()) throw new UnauthorizedException("Vui lòng đăng nhập để tiếp tục");
    if (!(request.user instanceof Student)) throw new UnauthorizedException("Bạn không có quyền thực hiện thao tác này");
    return true;
  }
}

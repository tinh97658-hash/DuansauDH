import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "required_permissions";

/**
 * Yêu cầu người dùng có TẤT CẢ các quyền được liệt kê (RBAC).
 * Ví dụ: `@RequirePermissions("account.view")`.
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

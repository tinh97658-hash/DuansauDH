import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { PermissionsGuard } from "../../src/common/permissions.guard.js";
import { Staff } from "../../src/database/models/staff.model.js";

const contextFor = (request: Record<string, unknown>) => ({
  switchToHttp: () => ({ getRequest: () => request }),
  getHandler: () => undefined,
  getClass: () => undefined,
}) as unknown as ExecutionContext;

const staffUser = () => Object.assign(Object.create(Staff.prototype), { id: "s1", role: "supervisor" }) as Staff;

const build = (required: string[] | undefined, access: { superadmin: boolean; permissions: string[] }) => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as any;
  const rbac = { effectiveAccess: jest.fn().mockResolvedValue({ superadmin: access.superadmin, permissions: new Set(access.permissions), roleCodes: [] }) } as any;
  return { guard: new PermissionsGuard(reflector, rbac), rbac };
};

describe("PermissionsGuard", () => {
  it("yêu cầu đăng nhập", async () => {
    const { guard } = build(["account.view"], { superadmin: false, permissions: [] });
    await expect(guard.canActivate(contextFor({ isAuthenticated: () => false, user: staffUser() }))).rejects.toThrow(UnauthorizedException);
  });

  it("cho qua khi endpoint không yêu cầu quyền", async () => {
    const { guard, rbac } = build(undefined, { superadmin: false, permissions: [] });
    await expect(guard.canActivate(contextFor({ isAuthenticated: () => true, user: staffUser() }))).resolves.toBe(true);
    expect(rbac.effectiveAccess).not.toHaveBeenCalled();
  });

  it("không dùng cờ superadmin cũ để bỏ qua quyền", async () => {
    const { guard } = build(["role.manage"], { superadmin: true, permissions: [] });
    await expect(guard.canActivate(contextFor({ isAuthenticated: () => true, user: staffUser() }))).rejects.toThrow(ForbiddenException);
  });

  it("cho qua khi có đủ quyền", async () => {
    const { guard } = build(["account.view", "account.manage"], { superadmin: false, permissions: ["account.view", "account.manage"] });
    await expect(guard.canActivate(contextFor({ isAuthenticated: () => true, user: staffUser() }))).resolves.toBe(true);
  });

  it("từ chối khi thiếu quyền", async () => {
    const { guard } = build(["account.manage"], { superadmin: false, permissions: ["account.view"] });
    await expect(guard.canActivate(contextFor({ isAuthenticated: () => true, user: staffUser() }))).rejects.toThrow(ForbiddenException);
  });

  it("từ chối người dùng không phải cán bộ", async () => {
    const { guard } = build(["account.view"], { superadmin: false, permissions: ["account.view"] });
    await expect(guard.canActivate(contextFor({ isAuthenticated: () => true, user: { id: "student" } }))).rejects.toThrow(ForbiddenException);
  });
});

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { RbacService } from "../auth/rbac.service.js";
import { Staff } from "../database/models/staff.model.js";

const ACTION_PERMISSIONS = {
  submit: "gradebook.submit",
  approve: "gradebook.approve",
  reopen: "gradebook.approve",
} as const;

/** Shared by the HTTP guard and service so internal calls enforce the same rule. */
export async function assertGradebookWorkflowAccess(
  actor: unknown,
  action: unknown,
  rbac?: Pick<RbacService, "effectiveAccess">,
): Promise<void> {
  if (!(actor instanceof Staff) || !rbac) {
    throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
  }
  if (typeof action !== "string" || !Object.prototype.hasOwnProperty.call(ACTION_PERMISSIONS, action)) {
    throw new BadRequestException("Thao tác bảng điểm không hợp lệ.");
  }
  const permission = ACTION_PERMISSIONS[action as keyof typeof ACTION_PERMISSIONS];
  const access = await rbac.effectiveAccess(actor, true);
  if (!access.permissions.has(permission) || access.groupScope?.readOnly) {
    throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
  }
}

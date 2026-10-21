import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { RbacService } from "../auth/rbac.service.js";
import { assertGradebookWorkflowAccess } from "./gradebook-workflow-access.js";

@Injectable()
export class GradebookWorkflowGuard implements CanActivate {
  constructor(private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    await assertGradebookWorkflowAccess(request.user, request.body?.action, this.rbac);
    return true;
  }
}

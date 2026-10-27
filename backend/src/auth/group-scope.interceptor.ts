import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Staff } from '../database/models/staff.model.js';
import { RbacService } from './rbac.service.js';
import { GroupScopeService } from './group-scope.service.js';

@Injectable()
export class GroupScopeInterceptor implements NestInterceptor {
  constructor(private readonly rbac: RbacService, private readonly scope: GroupScopeService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    if (!(request.user instanceof Staff)) return next.handle();
    const access = await this.rbac.effectiveAccess(request.user);
    this.scope.configure(request.user.id, access);
    const path = request.originalUrl?.split('?')[0] || '';
    if (access.groupScope?.restrictView && /\/accounts\/(audit-logs|change-logs)(\/|$)/.test(path)) {
      throw new ForbiddenException('Nhật ký toàn hệ thống không khả dụng khi vai trò bị giới hạn xem theo nhóm.');
    }
    const dataRoute = /\/(groups|masters|doctoral|plan|scheduling|reports|data)(\/|$)/.test(path);
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (dataRoute && write && access.groupScope?.readOnly) {
      throw new ForbiddenException('Vai trò đang bật Chỉ xem: không được thay đổi dữ liệu nhóm và học viên.');
    }
    // Subscribe inside ALS: constructing an Observable alone does not propagate context.
    return new Observable(subscriber => {
      let subscription: { unsubscribe(): void } | undefined;
      this.scope.run(request.user.id, access, async () => {
        await this.scope.assertWriteReferences(request);
        if (!subscriber.closed) subscription = next.handle().subscribe(subscriber);
      }).catch(error => subscriber.error(error));
      return () => subscription?.unsubscribe();
    });
  }
}

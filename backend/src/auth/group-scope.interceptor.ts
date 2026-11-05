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
    const access = await this.rbac.effectiveAccess(request.user, !['GET', 'HEAD', 'OPTIONS'].includes(request.method));
    const path = request.originalUrl?.split('?')[0] || '';
    if (access.groupScope?.restrictView && /\/accounts\/(audit-logs|change-logs)(\/|$)/.test(path)) {
      throw new ForbiddenException('Nhật ký toàn hệ thống không khả dụng khi vai trò bị giới hạn xem theo nhóm.');
    }
    const dataRoute = /\/(groups|masters|doctoral|plan|scheduling|reports|data)(\/|$)/.test(path);
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    // Only admissions endpoints receive the pre-class scope. Nested learner
    // operations (marks, leaves, recognitions, transfers) retain their own scope.
    const admissionRoute = /\/plan\/admission-rounds(?:\/[^/]+(?:\/(?:ranking|scores|preview|confirm))?)?$/.test(path)
      || /\/plan\/admission-records(?:\/[^/]+(?:\/evaluation(?:\/decision)?)?)?$/.test(path);
    const admissionAction = admissionRoute && !['learners', 'study-management'].includes(request.query?.admissionStage)
      ? (write ? 'manage' as const : 'view' as const) : undefined;
    const schedulingView = !write && /\/scheduling\/(course-offerings|teaching-sessions|pending-teaching-sessions)(\/|$)/.test(path);
    const schedulingAction = /\/scheduling\//.test(path) && !/\/assignee$/.test(path)
      ? (!write ? 'view' : /\/(teaching-sessions)(\/|$)|\/completion$/.test(path) ? 'write' : 'organize') : undefined;
    this.scope.configure(request.user.id, access, schedulingView, schedulingAction);
    const academicDomain = /\/masters\/exam-lists(\/|$)/.test(path) ? 'gradebook'
      : /\/masters\/(exam-schedule|exam-arrangements|exam-sessions)(\/|$)/.test(path) ? 'exam'
      : /\/plan\/(study-leaves|admission-records\/[^/]+\/study-leaves)(\/|$)/.test(path) ? 'studyleave'
      : /\/masters\/(grading-policies|grading-rules)(\/|$)/.test(path) ? 'policy' : undefined;
    const academicPermission = academicDomain === 'gradebook'
      ? (!write ? 'gradebook.view' : /\/workflow$/.test(path) && ['approve', 'reopen', 'reject_reopen'].includes(request.body?.action) ? 'gradebook.approve' : 'gradebook.submit')
      : academicDomain === 'exam' ? (write ? 'exams.write' : 'exams.view')
      : academicDomain === 'studyleave' ? (/\/actions$/.test(path) && request.body?.action !== 'request_extension' ? 'studyleave.approve' : 'studyleave.request') : academicDomain === 'policy' ? 'gradebook.policy' : undefined;
    const academic = { academicDomain, academicPermission, admissionAction };
    if (this.scope.current()) Object.assign(this.scope.current()!, academic);
    if (dataRoute && write && access.groupScope?.readOnly) {
      throw new ForbiddenException('Vai trò đang bật Chỉ xem: không được thay đổi dữ liệu nhóm và học viên.');
    }
    // Subscribe inside ALS: constructing an Observable alone does not propagate context.
    return new Observable(subscriber => {
      let subscription: { unsubscribe(): void } | undefined;
      let cancelRead: (() => void) | undefined;
      this.scope.run(request.user.id, access, async () => {
        Object.assign(this.scope.current()!, academic);
        await this.scope.assertWriteReferences(request);
        if (subscriber.closed) return;
        if (!write && (schedulingAction || academicDomain === 'gradebook' || academicDomain === 'exam')) {
          await this.scope.withReadTransaction(() => new Promise<void>((resolve, reject) => {
            if (subscriber.closed) { resolve(); return; }
            cancelRead = () => reject(new Error('Read request cancelled'));
            subscription = next.handle().subscribe({
              next: value => subscriber.next(value), error: reject, complete: resolve,
            });
          }));
          subscriber.complete();
        } else subscription = next.handle().subscribe(subscriber);
      }, schedulingView, schedulingAction).catch(error => subscriber.error(error));
      return () => { subscription?.unsubscribe(); cancelRead?.(); };
    });
  }
}

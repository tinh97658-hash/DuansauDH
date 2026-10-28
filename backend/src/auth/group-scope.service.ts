import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { groupScopeStorage, type GroupScopeContext } from "./group-scope-context.js";
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import type { EffectiveAccess } from './rbac.service.js';

@Injectable()
export class GroupScopeService implements OnModuleInit {
  private readonly storage = groupScopeStorage;
  private readonly initialized = new WeakMap<object, Promise<unknown>>();

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  run<T>(staffId: string, access: EffectiveAccess, work: () => T, schedulingView = false, schedulingAction?: GroupScopeContext['schedulingAction']): T {
    const scope = access.groupScope;
    if (!scope && !schedulingAction) return work();
    return this.storage.run({ staffId, restrictView: false, restrictEdit: false, readOnly: false, ...scope, schedulingView, schedulingAction, schedulingGrants: access.schedulingGrants }, work);
  }

  current() { return this.storage.getStore(); }

  configure(staffId: string, access: EffectiveAccess, schedulingView = false, schedulingAction?: GroupScopeContext['schedulingAction']) {
    const current = this.current();
    if (current) Object.assign(current, { staffId, restrictView: false, restrictEdit: false, readOnly: false, schedulingView, schedulingAction, schedulingGrants: access.schedulingGrants }, access.groupScope);
  }

  async assertWriteReferences(request: any) {
    // Schedule writes are checked against their actual offering inside RLS and the service.
    if (this.current()?.schedulingAction === 'write' || this.current()?.academicDomain) return;
    const organizing = this.current()?.schedulingAction === 'organize';
    if ((!this.current()?.restrictEdit && !organizing) || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    const checks: Array<{ kind: string; id: string }> = [];
    const add = (kind: string, value: unknown) => {
      for (const id of Array.isArray(value) ? value : [value]) {
        if (typeof id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) checks.push({ kind, id });
      }
    };
    const body = request.body || {};
    add('group', body.classGroupId); add('group', body.classGroupIds);
    add('record', body.admissionRecordId); add('record', body.admissionRecordIds);
    add('offering', body.courseOfferingId);
    if (organizing) add('offering', body.sourceCourseOfferingId);
    const path: string = request.originalUrl?.split('?')[0] || '';
    const segments = path.split('/').filter(Boolean);
    const resourceKinds: Record<string, string> = {
      'class-groups': 'group', classes: 'group', groups: 'group',
      'admission-records': 'record', 'learner-scorecard': 'record',
      'course-offerings': 'offering', 'teaching-sessions': 'teaching_sessions',
      'exam-sessions': 'course_exam_sessions', 'exam-arrangements': 'arrangement',
      'study-leaves': 'study_leaves', 'learning-results': 'learner_subject_results',
      'subject-recognitions': 'subject_recognitions', 'major-transfers': 'major_transfers',
    };
    segments.forEach((segment, index) => { if (resourceKinds[segment]) add(resourceKinds[segment], segments[index + 1]); });
    for (const { kind, id } of checks) {
      const predicate = organizing && ['group', 'record', 'offering'].includes(kind)
        ? kind === 'group' ? 'app_schedule_group_allowed(:id,true)'
          : kind === 'record' ? 'app_schedule_record_allowed(:id,true)' : "app_schedule_allowed(:id,'scheduling.organize')"
        : kind === 'group' ? 'app_group_allowed(:id,true)'
        : kind === 'record' ? 'app_record_allowed(:id,true)'
        : kind === 'offering' ? 'app_offering_allowed(:id,true)'
        : kind === 'arrangement' ? `NOT EXISTS(SELECT 1 FROM app_arrangement_offerings(:id) o WHERE NOT app_offering_allowed(o.offering_id,true))`
        : `EXISTS(SELECT 1 FROM ${kind} WHERE id=:id AND ${['teaching_sessions', 'course_exam_sessions'].includes(kind)
          ? 'app_offering_allowed(course_offering_id,true)' : 'app_record_allowed(admission_record_id,true)'})`;
      const rows = await this.sequelize.query<{ allowed: boolean }>(`SELECT (${predicate}) AS allowed`, {
        replacements: { id }, type: QueryTypes.SELECT,
      });
      if (!rows[0]?.allowed) throw new ForbiddenException('Vai trò chỉ được sửa dữ liệu của nhóm được phân công phụ trách.');
    }
  }

  onModuleInit() {
    const query = this.sequelize.query.bind(this.sequelize) as (...args: any[]) => Promise<any>;
    const transaction = this.sequelize.transaction.bind(this.sequelize);
    (this.sequelize as any).query = async (sql: any, options: any = {}) => {
      const scope = this.storage.getStore();
      const statement = typeof sql === 'string' ? sql : sql?.query;
      if (!scope?.staffId || (!scope.restrictView && !scope.restrictEdit && !scope.readOnly && !scope.schedulingAction && !scope.academicDomain) || /^(?:START TRANSACTION|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE SAVEPOINT|SET TRANSACTION|SET CONSTRAINTS)\b/i.test(statement?.trim() || '')) {
        return query(sql, options);
      }
      const execute = async (tx: any) => {
        let initialized = this.initialized.get(tx);
        if (!initialized) {
          initialized = (async () => {
            if (scope.schedulingAction === 'write' || scope.schedulingAction === 'organize' || (scope.academicDomain && scope.academicPermission !== 'gradebook.view' && scope.academicPermission !== 'scheduling.view')) {
              // Administrative changes take the exclusive counterpart of this lock.
              await query('SELECT pg_advisory_xact_lock_shared(74621901)', { transaction: tx });
              // Member assignment/removal and offering creation use 21026. Take it
              // before the timetable lock (21025), keeping full-roster capacity and
              // learner conflicts stable even for groups hidden by profile RLS.
              await query('SELECT pg_advisory_xact_lock(21026)', { transaction: tx });
            }
            await query('SET LOCAL ROLE pgsms_group_scoped', { transaction: tx });
            await query(`SELECT set_config('app.group_staff_id', :staffId, true),
              set_config('app.group_view_restricted', :restrictView, true),
              set_config('app.group_edit_restricted', :restrictEdit, true),
              set_config('app.group_read_only', :readOnly, true),
              set_config('app.scheduling_shared_view', :schedulingView, true),
              set_config('app.scheduling_action', :schedulingAction, true),
              set_config('app.scheduling_grants', :schedulingGrants, true),
              set_config('app.academic_domain', :academicDomain, true),
              set_config('app.academic_permission', :academicPermission, true)`, {
              transaction: tx,
              replacements: { staffId: scope.staffId, restrictView: String(scope.restrictView),
                restrictEdit: String(scope.restrictEdit), readOnly: String(scope.readOnly), schedulingView: String(scope.schedulingView === true), schedulingAction: scope.schedulingAction ?? '', schedulingGrants: JSON.stringify(scope.schedulingGrants ?? []),
                academicDomain: scope.academicDomain ?? '', academicPermission: scope.academicPermission ?? '' },
            });
          })();
          this.initialized.set(tx, initialized);
        }
        await initialized;
        return query(sql, { ...options, transaction: tx });
      };
      try {
        return options.transaction ? await execute(options.transaction) : await transaction(execute);
      } catch (error: any) {
        if (error?.original?.code === '42501' || error?.parent?.code === '42501') {
          throw new ForbiddenException('Dữ liệu nằm ngoài phạm vi nhóm được phân công hoặc vai trò đang bị khóa sửa.');
        }
        throw error;
      }
    };
  }
}

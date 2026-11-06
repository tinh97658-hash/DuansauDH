import { Injectable } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { RbacService, type EffectiveAccess } from '../auth/rbac.service.js';
import { GroupScopeService } from '../auth/group-scope.service.js';
import { workingProfileStorage } from '../auth/profile-context.js';
import { routeViewCode, routeActionCode } from '../auth/route-permissions.js';
import type { InboxEvent } from './inbox-events.js';

export type InboxActor = { id: string; role?: string; status?: string };
export type Audience = 'approver' | 'sender';
@Injectable()
export class InboxAccessService {
  constructor(private readonly db: Sequelize, private readonly rbac: RbacService, private readonly scope: GroupScopeService) {}

  async target(actor: InboxActor, profileId: string, event: Pick<InboxEvent, 'kind' | 'entityId'>, audience: Audience) {
    if (actor.status !== 'active') return null;
    return workingProfileStorage.run({ staffId: actor.id, roleId: profileId, selectionRequired: false, requestMethod: 'GET' }, async () => {
      const access = await this.rbac.effectiveAccess(actor, true);
      const grade = event.kind.startsWith('grade.'), transfer = event.kind.startsWith('transfer.');
      const path = grade ? '/masters/exam-lists' : transfer ? '/plan/admission-records' : '/masters/study-leaves';
      const view = grade ? 'gradebook.view' : transfer ? 'admission.view' : 'plan.view';
      const action = grade ? 'gradebook.approve' : transfer ? 'majortransfer.approve' : 'studyleave.approve';
      if (![view, routeViewCode(path)].every(code => access.permissions.has(code))) return null;
      if (audience === 'approver' && (access.groupScope?.readOnly || ![action, routeActionCode(path, action)].every(code => access.permissions.has(code)))) return null;
      return this.scoped(actor, access, grade, transfer, async () => {
        if (grade) {
          const rows = await this.db.query<any>(`SELECT o.name, s.name AS subject,
              g.id AS "groupId", g.academic_year AS year, g.major_id AS "majorId"
            FROM course_offerings o JOIN subjects s ON s.id=o.subject_id
            JOIN course_offering_class_groups l ON l.course_offering_id=o.id
            JOIN class_groups g ON g.id=l.class_group_id
            WHERE o.id=:id AND s.program='masters' ORDER BY g.id LIMIT 1`, { type: QueryTypes.SELECT, replacements: { id: event.entityId } });
          if (!rows[0]) return null;
          const row = rows[0], params = new URLSearchParams({ offeringId: event.entityId, groupId: row.groupId });
          if (row.year) params.set('year', row.year);
          if (row.majorId) params.set('majorId', row.majorId);
          return { label: [row.subject, row.name].filter(Boolean).join(' — '), href: `${path}?${params}` };
        }
        const rows = await this.db.query<any>('SELECT full_name, code FROM admission_records WHERE id=:id', { type: QueryTypes.SELECT, replacements: { id: event.entityId } });
        if (!rows[0]) return null;
        return { label: [rows[0].full_name, rows[0].code].filter(Boolean).join(' — '),
          href: `${path}/${event.entityId}?tab=${transfer ? 'profile' : 'leave'}` };
      });
    });
  }

  private scoped<T>(actor: InboxActor, access: EffectiveAccess, grade: boolean, transfer: boolean, work: () => Promise<T>) {
    return this.scope.run(actor.id, access, () => {
      Object.assign(this.scope.current()!, { academicDomain: grade ? 'gradebook' : transfer ? undefined : 'studyleave',
        academicPermission: grade ? 'gradebook.view' : transfer ? undefined : 'studyleave.request', admissionAction: transfer ? 'view' : undefined });
      return this.scope.withReadTransaction(work);
    });
  }
}

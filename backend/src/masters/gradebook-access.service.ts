import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes, type Transaction } from 'sequelize';
import { Staff } from '../database/models/staff.model.js';
import { RbacService } from '../auth/rbac.service.js';

export interface GradebookAccess {
  groupIds: Set<string> | null;
  readOnly: boolean;
}

@Injectable()
export class GradebookAccessService {
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly rbac: RbacService) {}

  async forActor(actor: unknown, transaction?: Transaction): Promise<GradebookAccess> {
    if (!(actor instanceof Staff) || !actor.id) throw new ForbiddenException('Không có quyền truy cập bảng điểm.');
    const access = await this.rbac.effectiveAccess(actor, true);
    if (access.roleCodes.includes('admin')) return { groupIds: null, readOnly: access.groupScope?.readOnly === true };
    const groups = await this.db.query<{ id: string }>(`SELECT id FROM class_groups
      WHERE program='masters' AND responsible_staff_id=:staffId`,
      { type: QueryTypes.SELECT, transaction, replacements: { staffId: actor.id } });
    return { groupIds: new Set(groups.map(group => group.id)), readOnly: access.groupScope?.readOnly === true };
  }

  async assertOffering(actor: unknown, offeringId: string, transaction?: Transaction) {
    const access = await this.forActor(actor, transaction);
    if (access.groupIds === null) return access;
    const links = access.groupIds.size ? await this.db.query<{ classGroupId: string }>(`SELECT class_group_id AS "classGroupId"
      FROM course_offering_class_groups WHERE course_offering_id=:offeringId AND class_group_id IN (:ids)`,
      { type: QueryTypes.SELECT, transaction, replacements: { offeringId, ids: [...access.groupIds] } }) : [];
    if (!links.length) throw new ForbiddenException('Bạn chỉ được xem bảng điểm của lớp mình phụ trách và lớp ghép có lớp đó.');
    return access;
  }

  // Call only after assertOffering: responsibility for any member class grants
  // access to the complete offering, including all rows in a merged class.
  canEdit(access: GradebookAccess) {
    return !access.readOnly;
  }

  async offeringIds(access: GradebookAccess, transaction?: Transaction): Promise<Set<string> | null> {
    if (access.groupIds === null) return null;
    if (!access.groupIds.size) return new Set();
    const links = await this.db.query<{ id: string }>(`SELECT DISTINCT course_offering_id AS id
      FROM course_offering_class_groups WHERE class_group_id IN (:ids)`,
      { type: QueryTypes.SELECT, transaction, replacements: { ids: [...access.groupIds] } });
    return new Set(links.map(link => link.id));
  }

}

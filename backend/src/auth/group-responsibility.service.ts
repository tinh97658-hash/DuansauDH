import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { ClassGroup } from '../database/models/training/class-group.model.js';
import { Staff } from '../database/models/staff.model.js';
import { RbacService } from './rbac.service.js';

@Injectable()
export class GroupResponsibilityService {
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly rbac: RbacService) {}

  assignees() {
    return Staff.findAll({ where: { status: 'active' }, attributes: ['id', 'name', 'email'], order: [['name', 'ASC']] });
  }

  async forCreation(actor: Staff, requestedId?: string) {
    if (requestedId && requestedId !== actor.id) {
      const access = await this.rbac.effectiveAccess(actor);
      if (!access.permissions.has('groups.assign')) throw new ForbiddenException('Bạn không có quyền phân công chuyên viên.');
    }
    const staffId = requestedId || actor.id;
    const staff = await Staff.findByPk(staffId);
    if (!staff || staff.status !== 'active') throw new BadRequestException('Chuyên viên phải là tài khoản nhân sự đang hoạt động.');
    return staffId;
  }

  async forUpdate(actor: Staff, staffId: string) {
    const access = await this.rbac.effectiveAccess(actor);
    if (!access.permissions.has('groups.assign')) throw new ForbiddenException('Bạn không có quyền phân công chuyên viên.');
    return this.forCreation(actor, staffId);
  }

  assign(groupId: string, staffId: string) {
    return this.db.transaction(async transaction => {
      const group = await ClassGroup.findByPk(groupId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!group) throw new NotFoundException('Không tìm thấy nhóm trong phạm vi được phép.');
      const staff = await Staff.findByPk(staffId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!staff || staff.status !== 'active') throw new BadRequestException('Chuyên viên phải là tài khoản nhân sự đang hoạt động.');
      await group.update({ responsibleStaffId: staffId }, { transaction });
      return { message: 'Đã phân công chuyên viên phụ trách.', data: { id: group.id, responsibleStaffId: staffId,
        responsibleStaff: { id: staff.id, name: staff.name, email: staff.email } } };
    });
  }
}

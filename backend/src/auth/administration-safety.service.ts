import { ConflictException, Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/sequelize";
import { QueryTypes, Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { workingProfileStorage } from './profile-context.js';

export const ADMINISTRATION_PERMISSIONS = ["module.administration","account.view", "account.manage", "role.view", "role.manage",
  'route.system.accounts.view','route.system.accounts.account-manage','route.system.roles.view','route.system.roles.role-manage'];

/** Serialize changes that could remove the last effective account/role administrator. */
@Injectable()
export class AdministrationSafetyService {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async lock(transaction: Transaction) {
    await this.sequelize.query("SELECT pg_advisory_xact_lock(74621901)", { transaction });
  }

  async assertRetained(transaction: Transaction) {
    const rows = await this.sequelize.query<{ id: string }>(`
      SELECT s.id FROM staff s
      JOIN roles r ON r.active = true AND (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.staff_id = s.id AND sr.role_id = r.id)
        OR (r.code = s.role AND NOT EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.staff_id = s.id))
      )
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE s.status = 'active' AND NOT r.group_read_only AND p.code IN (:codes)
      GROUP BY s.id,r.id HAVING COUNT(DISTINCT p.code) = :required
      LIMIT 1
    `, { replacements: { codes: ADMINISTRATION_PERMISSIONS, required: ADMINISTRATION_PERMISSIONS.length }, type: QueryTypes.SELECT, transaction });
    if (!rows.length) throw new ConflictException("Phải giữ ít nhất một nhân sự đang hoạt động có đủ quyền xem/quản lý tài khoản và vai trò.");
  }

  async assertActorRetained(actorId:string,transaction:Transaction){
    const profile=workingProfileStorage.getStore();
    if(!profile||profile.staffId!==actorId)return;
    const rows=await this.sequelize.query(`SELECT r.id FROM roles r JOIN staff s ON s.id=:actorId AND s.status='active' AND (
      EXISTS(SELECT 1 FROM staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=r.id)
      OR (NOT EXISTS(SELECT 1 FROM staff_roles sr WHERE sr.staff_id=s.id) AND s.role=r.code))
      JOIN role_permissions rp ON rp.role_id=r.id
      JOIN permissions p ON p.id=rp.permission_id WHERE r.id=:roleId AND r.active AND NOT r.group_read_only
      AND p.code IN ('module.administration','role.view','role.manage','route.system.roles.view','route.system.roles.role-manage') GROUP BY r.id HAVING count(DISTINCT p.code)=5`,
      {type:QueryTypes.SELECT,transaction,replacements:{roleId:profile.roleId,actorId}});
    if(!rows.length)throw new ConflictException('Không thể tự khóa quyền quản lý phân quyền của hồ sơ đang làm việc. Hãy dùng hồ sơ quản trị khác.');
  }
}

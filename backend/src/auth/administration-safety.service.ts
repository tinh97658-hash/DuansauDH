import { ConflictException, Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/sequelize";
import { QueryTypes, Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";

export const ADMINISTRATION_PERMISSIONS = ["account.view", "account.manage", "role.view", "role.manage"];

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
      WHERE s.status = 'active' AND p.code IN (:codes)
      GROUP BY s.id HAVING COUNT(DISTINCT p.code) = :required
      LIMIT 1
    `, { replacements: { codes: ADMINISTRATION_PERMISSIONS, required: ADMINISTRATION_PERMISSIONS.length }, type: QueryTypes.SELECT, transaction });
    if (!rows.length) throw new ConflictException("Phải giữ ít nhất một nhân sự đang hoạt động có đủ quyền xem/quản lý tài khoản và vai trò.");
  }
}

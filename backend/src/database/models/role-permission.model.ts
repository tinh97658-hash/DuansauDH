import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Permission } from "./permission.model.js";
import { Role } from "./role.model.js";

@Table({ tableName: "role_permissions", underscored: true, timestamps: true })
export class RolePermission extends Model {
  @ForeignKey(() => Role)
  @Column({ type: DataType.UUID, primaryKey: true, field: "role_id" })
  declare roleId: string;

  @ForeignKey(() => Permission)
  @Column({ type: DataType.UUID, primaryKey: true, field: "permission_id" })
  declare permissionId: string;
}

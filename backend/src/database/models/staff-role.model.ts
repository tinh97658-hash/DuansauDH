import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Role } from "./role.model.js";
import { Staff } from "./staff.model.js";

@Table({ tableName: "staff_roles", underscored: true, timestamps: true })
export class StaffRole extends Model {
  @ForeignKey(() => Staff)
  @Column({ type: DataType.UUID, primaryKey: true, field: "staff_id" })
  declare staffId: string;

  @ForeignKey(() => Role)
  @Column({ type: DataType.UUID, primaryKey: true, field: "role_id" })
  declare roleId: string;

  @BelongsTo(() => Role, { foreignKey: "roleId", as: "role" })
  declare role: Role;

  @BelongsTo(() => Staff, { foreignKey: "staffId", as: "staff" })
  declare staff: Staff;
}

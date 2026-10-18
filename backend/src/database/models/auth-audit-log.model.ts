import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Staff } from "./staff.model.js";

@Table({ tableName: "auth_audit_logs", underscored: true, timestamps: true })
export class AuthAuditLog extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @ForeignKey(() => Staff)
  @Column({ type: DataType.UUID, allowNull: true, field: "actor_staff_id" })
  declare actorStaffId: string | null;

  @ForeignKey(() => Staff)
  @Column({ type: DataType.UUID, allowNull: true, field: "target_staff_id" })
  declare targetStaffId: string | null;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare action: string;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare metadata: Record<string, unknown> | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare ip: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare userAgent: string | null;

  @BelongsTo(() => Staff, { foreignKey: "actorStaffId", as: "actor" })
  declare actor: Staff;

  @BelongsTo(() => Staff, { foreignKey: "targetStaffId", as: "target" })
  declare target: Staff;
}

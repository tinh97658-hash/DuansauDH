import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from "sequelize-typescript";

/**
 * Nhật ký thay đổi dữ liệu — được ghi tự động bởi trigger PostgreSQL (`audit_capture`).
 * Chỉ đọc từ tầng ứng dụng; không tạo/sửa/xóa thủ công.
 */
@Table({ tableName: "db_change_logs", underscored: true, timestamps: false })
export class DbChangeLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT, field: "id" })
  declare id: number;

  @Column({ type: DataType.STRING(80), allowNull: false, field: "table_name" })
  declare tableName: string;

  @Column({ type: DataType.STRING(10), allowNull: false, field: "operation" })
  declare operation: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: "row_pk" })
  declare rowPk: string | null;

  @Column({ type: DataType.JSONB, allowNull: true, field: "old_data" })
  declare oldData: Record<string, unknown> | null;

  @Column({ type: DataType.JSONB, allowNull: true, field: "new_data" })
  declare newData: Record<string, unknown> | null;

  @Column({ type: DataType.ARRAY(DataType.STRING), allowNull: true, field: "changed_columns" })
  declare changedColumns: string[] | null;

  @Column({ type: DataType.UUID, allowNull: true, field: "actor_staff_id" })
  declare actorStaffId: string | null;

  @Column({ type: DataType.STRING(150), allowNull: true, field: "actor_email" })
  declare actorEmail: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true, field: "request_id" })
  declare requestId: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true, field: "ip" })
  declare ip: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: "user_agent" })
  declare userAgent: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: "changed_at" })
  declare changedAt: Date;
}

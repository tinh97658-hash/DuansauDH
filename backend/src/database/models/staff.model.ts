import { BelongsToMany, Column, DataType, Default, Model, Scopes, Table } from "sequelize-typescript";
import { Role } from "./role.model.js";
import { StaffRole } from "./staff-role.model.js";
import { StaffStudent } from "./staff-student.model.js";
import { Student } from "./student.model.js";

@Scopes(() => ({ withoutPassword: { attributes: { exclude: ["password"] } } }))
@Table({ tableName: "staff", underscored: true, timestamps: true })
export class Staff extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column(DataType.STRING) declare name: string;
  @Column({ type: DataType.STRING, allowNull: false }) declare email: string;
  @Column({ type: DataType.STRING(60), allowNull: true }) declare password: string | null;

  // Vai trò chính (mã vai trò). Giữ lại để tương thích `user.role` trong giai đoạn
  // chuyển đổi sang RBAC; nguồn quyền đầy đủ nằm ở bảng `staff_roles`.
  @Column({ type: DataType.STRING(50), allowNull: false }) declare role: string;

  @Default("active")
  @Column({ type: DataType.ENUM("active", "disabled"), allowNull: false })
  declare status: string;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare sessionVersion: number;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare mustChangePassword: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  declare lastLoginAt: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare passwordChangedAt: Date | null;

  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare canManageScheduling: boolean;

  @BelongsToMany(() => Role, { through: () => StaffRole, foreignKey: "staffId", otherKey: "roleId" })
  declare roles: Role[];

  @BelongsToMany(() => Student, () => StaffStudent)
  declare students: Student[];
}

import { BelongsToMany, Column, DataType, Default, Model, Scopes, Table } from "sequelize-typescript";
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
  @Column({ type: DataType.ENUM("admin", "supervisor", "examiner"), allowNull: false }) declare role: string;
  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare canManageScheduling: boolean;

  @BelongsToMany(() => Student, () => StaffStudent)
  declare students: Student[];
}

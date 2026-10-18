import { BelongsToMany, Column, DataType, Default, Model, Table } from "sequelize-typescript";
import { Role } from "./role.model.js";
import { RolePermission } from "./role-permission.model.js";

@Table({ tableName: "permissions", underscored: true, timestamps: true })
export class Permission extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(80), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare group: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Default(0)
  @Column(DataType.INTEGER)
  declare sortOrder: number;

  @BelongsToMany(() => Role, () => RolePermission)
  declare roles: Role[];
}

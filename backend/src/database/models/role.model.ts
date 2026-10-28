import { RolePermissionScope } from './role-permission-scope.model.js';
import { BelongsToMany, HasMany, Column, DataType, Default, Model, Table } from "sequelize-typescript";
import { Permission } from "./permission.model.js";
import { RolePermission } from "./role-permission.model.js";
import { Staff } from "./staff.model.js";
import { StaffRole } from "./staff-role.model.js";

@Table({ tableName: "roles", underscored: true, timestamps: true })
export class Role extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare name: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: string | null;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare isSystem: boolean;

  @Default(0)
  @Column(DataType.INTEGER)
  declare sortOrder: number;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare active: boolean;

  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare restrictGroupView: boolean;
  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare restrictGroupEdit: boolean;
  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare groupReadOnly: boolean;

  @Default(1) @Column({ type: DataType.INTEGER, allowNull: false }) declare schedulingScopeVersion: number;
  @HasMany(() => RolePermissionScope) declare permissionScopes: RolePermissionScope[];

  @BelongsToMany(() => Permission, () => RolePermission)
  declare permissions: Permission[];

  @BelongsToMany(() => Staff, () => StaffRole)
  declare staffMembers: Staff[];
}

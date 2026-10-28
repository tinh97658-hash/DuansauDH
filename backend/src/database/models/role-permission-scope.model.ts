import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Role } from './role.model.js';

@Table({ tableName: 'role_permission_scopes', underscored: true, timestamps: true })
export class RolePermissionScope extends Model {
  @ForeignKey(() => Role) @Column({ type: DataType.UUID, primaryKey: true }) declare roleId: string;
  @Column({ type: DataType.UUID, primaryKey: true }) declare permissionId: string;
  @Column({ type: DataType.STRING(24), allowNull: false }) declare scope: string;
}

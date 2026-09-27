import { Column, DataType, Default, Model, Table } from "sequelize-typescript";

@Table({ tableName: "rooms", underscored: true, timestamps: true })
export class Room extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Column({ type: DataType.INTEGER, allowNull: true }) declare capacity: number | null;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare isActive: boolean;
}

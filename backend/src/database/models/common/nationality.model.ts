import { Column, DataType, Default, Model, Table } from "sequelize-typescript";

@Table({ tableName: "nationalities", underscored: true, timestamps: true })
export class Nationality extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(10), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) declare name: string;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

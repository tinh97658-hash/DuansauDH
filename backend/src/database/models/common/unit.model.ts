import { Column, DataType, Default, Model, Table } from "sequelize-typescript";

@Table({ tableName: "units", underscored: true, timestamps: true })
export class Unit extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(30), allowNull: false, unique: true }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Column(DataType.STRING(200)) declare englishName: string | null;
  @Column(DataType.TEXT) declare description: string | null;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

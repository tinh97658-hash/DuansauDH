import { Column, DataType, Default, HasMany, Model, Table } from "sequelize-typescript";
import { District } from "./district.model.js";

@Table({ tableName: "cities", underscored: true, timestamps: true })
export class City extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) declare name: string;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
  @HasMany(() => District) declare districts: District[];
}

import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { District } from "./district.model.js";

@Table({ tableName: "wards", underscored: true, timestamps: true })
export class Ward extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) declare name: string;
  @ForeignKey(() => District) @Column({ type: DataType.UUID, allowNull: false }) declare districtId: string;
  @BelongsTo(() => District) declare district: any;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

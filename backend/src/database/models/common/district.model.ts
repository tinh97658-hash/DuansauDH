import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { City } from "./city.model.js";
import { Ward } from "./ward.model.js";

@Table({ tableName: "districts", underscored: true, timestamps: true })
export class District extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) declare name: string;
  @ForeignKey(() => City) @Column({ type: DataType.UUID, allowNull: false }) declare cityId: string;
  @BelongsTo(() => City) declare city: any;
  @HasMany(() => Ward) declare wards: Ward[];
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

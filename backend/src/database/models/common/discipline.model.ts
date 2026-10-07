import { Column, DataType, Default, HasMany, Model, Table } from "sequelize-typescript";
import { Major } from "./major.model.js";

/**
 * Ngành đào tạo (cấp 1) — mã ngành theo danh mục BGD&ĐT.
 * Một ngành có nhiều chuyên ngành; chuyên ngành nằm ở bảng `majors` (`majors.discipline_id`).
 */
@Table({ tableName: "disciplines", underscored: true, timestamps: true })
export class Discipline extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Column({ type: DataType.STRING(200), allowNull: true }) declare englishName: string | null;
  @Column(DataType.TEXT) declare description: string | null;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;

  @HasMany(() => Major) declare majors: Major[];
}

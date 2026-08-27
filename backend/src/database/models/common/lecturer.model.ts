import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Staff } from "../staff.model.js";

@Table({ tableName: "lecturers", underscored: true, timestamps: true })
export class Lecturer extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Staff) @Column({ type: DataType.UUID, allowNull: true }) declare staffId: string | null;
  @BelongsTo(() => Staff) declare staff: any;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(150), allowNull: false }) declare name: string;
  @Column({ type: DataType.STRING(150), allowNull: true }) declare email: string | null;
  @Column({ type: DataType.STRING(30), allowNull: true }) declare phone: string | null;
  @Column({ type: DataType.STRING(50), allowNull: true }) declare academicRank: string | null;
  @Column({ type: DataType.STRING(50), allowNull: true }) declare academicDegree: string | null;
  @Column({ type: DataType.STRING(50), allowNull: true }) declare teachingType: string | null;
  @Column(DataType.STRING(50)) declare title: string | null;
  @Column(DataType.STRING(150)) declare department: string | null;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

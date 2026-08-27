import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { TrainingLevel } from "./training-level.model.js";

@Table({ tableName: "majors", underscored: true, timestamps: true })
export class Major extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @ForeignKey(() => TrainingLevel) @Column({ type: DataType.UUID, allowNull: true }) declare trainingLevelId: string | null;
  @BelongsTo(() => TrainingLevel) declare trainingLevel: any;
  @Default("masters") @Column({ type: DataType.ENUM("masters", "doctoral"), allowNull: false }) declare program: string;
  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare isAdmissionScreening: boolean;
  @Default(2) @Column({ type: DataType.DECIMAL(4, 1), allowNull: false }) declare durationYears: number;
  @Default(2) @Column({ type: DataType.DECIMAL(4, 1), allowNull: false }) declare maxOvertimeYears: number;
  @Column(DataType.TEXT) declare description: string | null;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

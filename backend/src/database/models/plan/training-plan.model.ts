import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { TrainingProgram } from "../common/training-program.model.js";
import { AdmissionTarget } from "./admission-target.model.js";
import { AnnualFee } from "./annual-fee.model.js";
import { AdmissionRecord } from "./admission-record.model.js";

@Table({ tableName: "training_plans", underscored: true, timestamps: true })
export class TrainingPlan extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @ForeignKey(() => TrainingProgram) @Column({ type: DataType.UUID, allowNull: false }) declare programId: string;
  @BelongsTo(() => TrainingProgram) declare program: any;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare academicYear: string;
  @Column(DataType.STRING(20)) declare semester: string | null;
  @Column(DataType.DATEONLY) declare startDate: string | null;
  @Column(DataType.DATEONLY) declare endDate: string | null;
  @Default(0) @Column(DataType.INTEGER) declare targetStudents: number;
  @Default("draft") @Column({ type: DataType.ENUM("draft", "active", "closed"), allowNull: false }) declare status: string;
  @Column(DataType.TEXT) declare note: string | null;
  @HasMany(() => AdmissionTarget) declare admissionTargets: AdmissionTarget[];
  @HasMany(() => AnnualFee) declare annualFees: AnnualFee[];
  @HasMany(() => AdmissionRecord) declare admissionRecords: AdmissionRecord[];
}

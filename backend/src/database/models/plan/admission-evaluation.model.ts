import { Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { AdmissionRecord } from "./admission-record.model.js";

@Table({ tableName: "admission_rounds", underscored: true, timestamps: true })
export class AdmissionRound extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Column({ type: DataType.STRING(10), allowNull: false }) declare academicYear: string;
  @Default([]) @Column({ type: DataType.JSONB, allowNull: false }) declare majorThresholds: { majorId: string; cutoff: number | null }[];
  @Column({ type: DataType.STRING(300), allowNull: false }) declare regulationNo: string;
  @Column(DataType.STRING(300)) declare decisionNo: string | null;
  @Column(DataType.DATEONLY) declare decisionDate: string | null;
  @Column({ type: DataType.JSONB, allowNull: false }) declare rules: any;
}
@Table({ tableName: "admission_evaluations", underscored: true, timestamps: true })
export class AdmissionEvaluation extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => AdmissionRecord) @Column({ type: DataType.UUID, allowNull: false, unique: true }) declare admissionRecordId: string;
  @ForeignKey(() => AdmissionRound) @Column({ type: DataType.UUID, allowNull: false }) declare roundId: string;
  @Column({ type: DataType.JSONB, allowNull: false }) declare inputs: any;
  @Column({ type: DataType.JSONB, allowNull: false }) declare recordSnapshot: any;
  @Default("pending") @Column({ type: DataType.STRING(20), allowNull: false }) declare decision: string;
  @Default(1) @Column({ type: DataType.INTEGER, allowNull: false }) declare version: number;
}
@Table({ tableName: "admission_evaluation_history", underscored: true, timestamps: true })
export class AdmissionEvaluationHistory extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => AdmissionRecord) @Column({ type: DataType.UUID, allowNull: false }) declare admissionRecordId: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare action: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare actor: string;
  @Column({ type: DataType.JSONB, allowNull: false }) declare snapshot: any;
}

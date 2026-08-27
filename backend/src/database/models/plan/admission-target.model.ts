import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { TrainingPlan } from "./training-plan.model.js";
import { Major } from "../common/major.model.js";
import { TrainingMode } from "../common/training-mode.model.js";

@Table({ tableName: "admission_targets", underscored: true, timestamps: true })
export class AdmissionTarget extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => TrainingPlan) @Column({ type: DataType.UUID, allowNull: false }) declare planId: string;
  @BelongsTo(() => TrainingPlan) declare plan: any;
  @ForeignKey(() => Major) @Column({ type: DataType.UUID, allowNull: false }) declare majorId: string;
  @BelongsTo(() => Major) declare major: any;
  @ForeignKey(() => TrainingMode) @Column({ type: DataType.UUID, allowNull: false }) declare trainingModeId: string;
  @BelongsTo(() => TrainingMode) declare trainingMode: any;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare quota: number;
  @Column(DataType.TEXT) declare note: string | null;
}

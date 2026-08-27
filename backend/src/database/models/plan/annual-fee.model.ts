import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { TrainingPlan } from "./training-plan.model.js";

@Table({ tableName: "annual_fees", underscored: true, timestamps: true })
export class AnnualFee extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => TrainingPlan) @Column({ type: DataType.UUID, allowNull: false }) declare planId: string;
  @BelongsTo(() => TrainingPlan) declare plan: any;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Default(0) @Column({ type: DataType.DECIMAL(15, 2), allowNull: false }) declare amount: number;
  @Column(DataType.DATEONLY) declare dueDate: string | null;
  @Column(DataType.TEXT) declare note: string | null;
}

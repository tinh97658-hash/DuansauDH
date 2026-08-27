import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Major } from "./major.model.js";
import { TrainingLevel } from "./training-level.model.js";
import { TrainingMode } from "./training-mode.model.js";

@Table({ tableName: "training_programs", underscored: true, timestamps: true })
export class TrainingProgram extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @ForeignKey(() => TrainingLevel) @Column({ type: DataType.UUID, allowNull: false }) declare trainingLevelId: string;
  @BelongsTo(() => TrainingLevel) declare trainingLevel: any;
  @ForeignKey(() => TrainingMode) @Column({ type: DataType.UUID, allowNull: false }) declare trainingModeId: string;
  @BelongsTo(() => TrainingMode) declare trainingMode: any;
  @ForeignKey(() => Major) @Column({ type: DataType.UUID, allowNull: true }) declare majorId: string | null;
  @BelongsTo(() => Major) declare major: any;
  @Default(2) @Column({ type: DataType.DECIMAL(4, 1), allowNull: false }) declare durationYears: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

import { Column, DataType, Default, HasMany, Model, Table } from "sequelize-typescript";
import { TrainingMode } from "./training-mode.model.js";

@Table({ tableName: "training_mode_groups", underscored: true, timestamps: true })
export class TrainingModeGroup extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) declare name: string;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
  @HasMany(() => TrainingMode) declare modes: TrainingMode[];
}

import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { TrainingModeGroup } from "./training-mode-group.model.js";

@Table({ tableName: "training_modes", underscored: true, timestamps: true })
export class TrainingMode extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) declare name: string;
  @ForeignKey(() => TrainingModeGroup) @Column({ type: DataType.UUID, allowNull: true }) declare groupId: string | null;
  @BelongsTo(() => TrainingModeGroup) declare group: any;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

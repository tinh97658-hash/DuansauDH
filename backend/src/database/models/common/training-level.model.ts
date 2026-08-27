import { Column, DataType, Default, HasMany, Model, Table } from "sequelize-typescript";
import { Major } from "./major.model.js";
import { TrainingProgram } from "./training-program.model.js";

@Table({ tableName: "training_levels", underscored: true, timestamps: true })
export class TrainingLevel extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(120), allowNull: false }) declare name: string;
  @Default(2) @Column({ type: DataType.DECIMAL(4, 1), allowNull: false }) declare durationYears: number;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
  @HasMany(() => Major) declare majors: Major[];
  @HasMany(() => TrainingProgram) declare programs: TrainingProgram[];
}

import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "./student.model.js";

@Table({
  tableName: "submissions",
  underscored: true,
  timestamps: true,
  indexes: [{ unique: true, fields: ["student_id", "submission_number"] }],
})
export class Submission extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @ForeignKey(() => Student)
  @Column({ type: DataType.UUID, allowNull: false, field: "student_id" })
  declare studentId: string;

  @Column({ type: DataType.SMALLINT, allowNull: false, field: "submission_number" })
  declare submissionNumber: number;

  @Column({ type: DataType.STRING, allowNull: false, field: "file_name" })
  declare fileName: string;

  @BelongsTo(() => Student)
  declare student: any;
}

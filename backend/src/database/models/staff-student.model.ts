import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import { Staff } from "./staff.model.js";
import { Student } from "./student.model.js";

@Table({ tableName: "staff_students", underscored: true, timestamps: true })
export class StaffStudent extends Model {
  @ForeignKey(() => Staff)
  @Column({ type: DataType.UUID, primaryKey: true, field: "staff_id" })
  declare staffId: string;

  @ForeignKey(() => Student)
  @Column({ type: DataType.UUID, primaryKey: true, field: "student_id" })
  declare studentId: string;
}

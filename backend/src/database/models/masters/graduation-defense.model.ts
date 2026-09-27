import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";
import { GraduationRecord } from "./graduation-record.model.js";

@Table({ tableName: "graduation_defenses", underscored: true, timestamps: true })
export class GraduationDefense extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @Column({ type: DataType.TEXT, allowNull: false }) declare thesisTitle: string;
  @Column(DataType.DATEONLY) declare defenseDate: string | null;
  @Default("failed") @Column({ type: DataType.ENUM("passed", "failed"), allowNull: false }) declare result: string;
  @Column(DataType.TEXT) declare note: string | null;
  @HasMany(() => GraduationRecord) declare records: GraduationRecord[];
}

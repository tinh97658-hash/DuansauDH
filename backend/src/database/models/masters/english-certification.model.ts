import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";

@Table({ tableName: "english_certifications", underscored: true, timestamps: true })
export class EnglishCertification extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @Default("ielts") @Column({ type: DataType.STRING(50), allowNull: false }) declare certificateType: string;
  @Column(DataType.STRING(80)) declare certificateNumber: string | null;
  @Column(DataType.DATEONLY) declare certDate: string | null;
  @Default("registered") @Column({ type: DataType.ENUM("registered", "approved", "rejected"), allowNull: false }) declare status: string;
  @Column(DataType.DATE) declare approvedAt: Date | null;
  @Column(DataType.TEXT) declare note: string | null;
}

import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";
import { Staff } from "../staff.model.js";

@Table({ tableName: "doctoral_reviews", underscored: true, timestamps: true })
export class DoctoralReview extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @ForeignKey(() => Staff) @Column({ type: DataType.UUID, allowNull: false }) declare reviewerId: string;
  @BelongsTo(() => Staff) declare reviewer: any;
  @Default("closed") @Column({ type: DataType.ENUM("closed", "two_reviewers"), allowNull: false }) declare reviewType: string;
  @Column(DataType.DATEONLY) declare reviewDate: string | null;
  @Default("approved") @Column({ type: DataType.ENUM("approved", "rejected"), allowNull: false }) declare result: string;
  @Column(DataType.TEXT) declare comment: string | null;
}

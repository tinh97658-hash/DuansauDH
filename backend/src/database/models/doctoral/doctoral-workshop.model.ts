import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";

@Table({ tableName: "doctoral_workshops", underscored: true, timestamps: true })
export class DoctoralWorkshop extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @Column({ type: DataType.TEXT, allowNull: false }) declare title: string;
  @Column(DataType.DATEONLY) declare workshopDate: string | null;
  @Column(DataType.STRING(150)) declare venue: string | null;
  @Default("failed") @Column({ type: DataType.ENUM("passed", "failed"), allowNull: false }) declare result: string;
  @Column(DataType.TEXT) declare note: string | null;
}

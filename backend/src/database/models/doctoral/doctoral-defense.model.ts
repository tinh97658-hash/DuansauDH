import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";

@Table({ tableName: "doctoral_defenses", underscored: true, timestamps: true })
export class DoctoralDefense extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @Default("co_so") @Column({ type: DataType.ENUM("co_so", "truong"), allowNull: false }) declare defenseLevel: string;
  @Column({ type: DataType.TEXT, allowNull: false }) declare thesisTitle: string;
  @Column(DataType.DATEONLY) declare defenseDate: string | null;
  @Default("failed") @Column({ type: DataType.ENUM("passed", "failed"), allowNull: false }) declare result: string;
  @Column(DataType.TEXT) declare note: string | null;
}

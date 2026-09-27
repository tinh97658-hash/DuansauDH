import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";
import { Staff } from "../staff.model.js";

@Table({ tableName: "doctoral_thesis_topics", underscored: true, timestamps: true })
export class DoctoralThesisTopic extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @Default("overview") @Column({ type: DataType.ENUM("overview", "chuyen_de"), allowNull: false }) declare topicType: string;
  @Column({ type: DataType.TEXT, allowNull: false }) declare title: string;
  @ForeignKey(() => Staff) @Column({ type: DataType.UUID, allowNull: true }) declare supervisorId: string | null;
  @BelongsTo(() => Staff) declare supervisor: any;
  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare approved: boolean;
  @Column(DataType.DATE) declare approvedAt: Date | null;
  @Column(DataType.TEXT) declare note: string | null;
}

import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Subject } from "../plan/subject.model.js";

@Table({ tableName: "bridge_knowledge_subjects", underscored: true, timestamps: true })
export class BridgeKnowledgeSubject extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare credits: number;
  /**
   * Học phần CTĐT mà học phần bổ sung kiến thức này được khai báo tương đương.
   * Chỉ khi có khai báo này thì kết quả học bổ sung kiến thức mới được công nhận.
   */
  @ForeignKey(() => Subject) @Column({ type: DataType.UUID, allowNull: true }) declare equivalentSubjectId: string | null;
  @BelongsTo(() => Subject, { foreignKey: "equivalentSubjectId", as: "equivalentSubject" }) declare equivalentSubject: Subject | null;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

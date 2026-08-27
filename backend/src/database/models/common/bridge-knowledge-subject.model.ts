import { Column, DataType, Default, Model, Table } from "sequelize-typescript";

@Table({ tableName: "bridge_knowledge_subjects", underscored: true, timestamps: true })
export class BridgeKnowledgeSubject extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare credits: number;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

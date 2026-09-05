import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Major } from "../common/major.model.js";

@Table({ tableName: "subjects", underscored: true, timestamps: true })
export class Subject extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare code: string;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare codeNumber: number;
  @Default("") @Column({ type: DataType.STRING(20), allowNull: false }) declare codeText: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @ForeignKey(() => Major) @Column({ type: DataType.UUID, allowNull: false }) declare majorId: string;
  @BelongsTo(() => Major) declare major: any;
  @Default("masters") @Column({ type: DataType.ENUM("masters", "doctoral"), allowNull: false }) declare program: string;
  @ForeignKey(() => Subject) @Column({ type: DataType.UUID, allowNull: true }) declare canonicalSubjectId: string | null;
  @BelongsTo(() => Subject, { foreignKey: "canonicalSubjectId", as: "canonicalSubject" }) declare canonicalSubject: any;
  @HasMany(() => Subject, { foreignKey: "canonicalSubjectId", as: "aliases" }) declare aliases: Subject[];
  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare allowCrossMajor: boolean;
  @Default(3) @Column({ type: DataType.INTEGER, allowNull: false }) declare credits: number;
  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare majorAssignment: boolean;
  @Default("CN") @Column({ type: DataType.STRING(10), allowNull: false }) declare subjectType: string;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare isRequired: boolean;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

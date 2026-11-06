import { Column, DataType, Default, Model, Table } from "sequelize-typescript";

@Table({ tableName: "training_years", underscored: true, timestamps: true })
export class TrainingYear extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(4), allowNull: false, unique: true }) declare name: string;
  @Column({ type: DataType.DATEONLY, allowNull: false }) declare startDate: string;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
}

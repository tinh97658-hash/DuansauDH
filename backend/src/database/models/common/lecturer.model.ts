import { BelongsTo, Column, DataType, Default, DefaultScope, ForeignKey, Model, Table } from "sequelize-typescript";
import { decryptPii, encryptPii, hashPhone } from "../../../common/pii-encryption.js";
import { Staff } from "../staff.model.js";
import { Discipline } from "./discipline.model.js";
import { Major } from "./major.model.js";
import { Unit } from "./unit.model.js";

@DefaultScope(() => ({ attributes: { exclude: ["phoneHash"] } }))
@Table({ tableName: "lecturers", underscored: true, timestamps: true })
export class Lecturer extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Staff) @Column({ type: DataType.UUID, allowNull: true }) declare staffId: string | null;
  @BelongsTo(() => Staff) declare staff: any;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(150), allowNull: false }) declare name: string;
  @Column({ type: DataType.STRING(150), allowNull: true }) declare email: string | null;
  @Column({
    type: DataType.TEXT,
    allowNull: true,
    get(this: Lecturer) {
      return decryptPii(this.getDataValue("phone"), "lecturers:phone");
    },
    set(this: Lecturer, value: string | null) {
      this.setDataValue("phone", encryptPii(value, "lecturers:phone"));
      this.setDataValue("phoneHash", hashPhone(value));
    },
  }) declare phone: string | null;
  @Column({ type: DataType.STRING(64), allowNull: true, field: "phone_hash" }) declare phoneHash: string | null;
  @Column({ type: DataType.STRING(50), allowNull: true }) declare academicRank: string | null;
  @Column({ type: DataType.STRING(50), allowNull: true }) declare academicDegree: string | null;
  @Column({ type: DataType.STRING(50), allowNull: true }) declare teachingType: string | null;
  @Column(DataType.STRING(50)) declare title: string | null;
  @Column(DataType.STRING(150)) declare faculty: string | null;
  @Column(DataType.STRING(150)) declare department: string | null;
  @ForeignKey(() => Unit) @Column({ type: DataType.UUID, allowNull: true }) declare unitId: string | null;
  @BelongsTo(() => Unit) declare unit: Unit | null;
  @ForeignKey(() => Discipline) @Column({ type: DataType.UUID, allowNull: true }) declare disciplineId: string | null;
  @BelongsTo(() => Discipline) declare discipline: Discipline | null;
  @ForeignKey(() => Major) @Column({ type: DataType.UUID, allowNull: true }) declare majorId: string | null;
  @BelongsTo(() => Major) declare major: Major | null;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;

  override toJSON() {
    const values: any = { ...this.get() };
    delete values.phoneHash;
    return values;
  }
}

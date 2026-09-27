import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Lecturer } from "../common/lecturer.model.js";
import { Room } from "../common/room.model.js";
import { CourseOffering } from "./course-offering.model.js";
import { Staff } from "../staff.model.js";

@Table({ tableName: "teaching_sessions", underscored: true, timestamps: true })
export class TeachingSession extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;

  @ForeignKey(() => CourseOffering) @Column({ type: DataType.UUID, allowNull: false }) declare courseOfferingId: string;
  @BelongsTo(() => CourseOffering, { foreignKey: "courseOfferingId", as: "courseOffering" })
  declare courseOffering: CourseOffering;

  @Column({ type: DataType.DATEONLY, allowNull: false }) declare sessionDate: string;
  @Column({ type: DataType.TIME, allowNull: false }) declare startTime: string;
  @Column({ type: DataType.TIME, allowNull: false }) declare endTime: string;
  @Column({ type: DataType.ENUM("MORNING", "AFTERNOON"), allowNull: false }) declare period: "MORNING" | "AFTERNOON";

  @ForeignKey(() => Lecturer) @Column({ type: DataType.UUID, allowNull: false }) declare lecturerId: string;
  @BelongsTo(() => Lecturer, { foreignKey: "lecturerId", as: "lecturer" }) declare lecturer: Lecturer;

  @ForeignKey(() => Room) @Column({ type: DataType.UUID, allowNull: false }) declare roomId: string;
  @BelongsTo(() => Room, { foreignKey: "roomId", as: "room" }) declare room: Room;

  @Column({ type: DataType.TEXT, allowNull: true }) declare note: string | null;

  @Default("planned")
  @Column({ type: DataType.ENUM("planned", "held", "not_held"), allowNull: false })
  declare status: "planned" | "held" | "not_held";

  @Column({ type: DataType.DATE, allowNull: true }) declare confirmedAt: Date | null;
  @ForeignKey(() => Staff) @Column({ type: DataType.UUID, allowNull: true }) declare confirmedByStaffId: string | null;
  @BelongsTo(() => Staff, { foreignKey: "confirmedByStaffId", as: "confirmedBy" }) declare confirmedBy: Staff | null;
}

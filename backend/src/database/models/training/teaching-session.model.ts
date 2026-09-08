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

  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare isScheduled: boolean;
  @Column({ type: DataType.INTEGER, allowNull: true }) declare sequenceNumber: number | null;
  @Column({ type: DataType.INTEGER, allowNull: true }) declare plannedUnits: number | null;

  @Column({ type: DataType.DATEONLY, allowNull: true }) declare sessionDate: string | null;
  @Column({ type: DataType.TIME, allowNull: true }) declare startTime: string | null;
  @Column({ type: DataType.TIME, allowNull: true }) declare endTime: string | null;
  @Column({ type: DataType.ENUM("MORNING", "AFTERNOON"), allowNull: true }) declare period: "MORNING" | "AFTERNOON" | null;

  @ForeignKey(() => Lecturer) @Column({ type: DataType.UUID, allowNull: true }) declare lecturerId: string | null;
  @BelongsTo(() => Lecturer, { foreignKey: "lecturerId", as: "lecturer" }) declare lecturer: Lecturer;

  @ForeignKey(() => Room) @Column({ type: DataType.UUID, allowNull: true }) declare roomId: string | null;
  @BelongsTo(() => Room, { foreignKey: "roomId", as: "room" }) declare room: Room;

  @Column({ type: DataType.TEXT, allowNull: true }) declare note: string | null;

  @Default("planned")
  @Column({ type: DataType.ENUM("planned", "held", "not_held"), allowNull: false })
  declare status: "planned" | "held" | "not_held";

  @Column({ type: DataType.DATE, allowNull: true }) declare confirmedAt: Date | null;
  @ForeignKey(() => Staff) @Column({ type: DataType.UUID, allowNull: true }) declare confirmedByStaffId: string | null;
  @BelongsTo(() => Staff, { foreignKey: "confirmedByStaffId", as: "confirmedBy" }) declare confirmedBy: Staff | null;
}

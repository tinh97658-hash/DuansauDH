import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { ClassGroup } from "./class-group.model.js";
import { CourseOffering } from "./course-offering.model.js";
import type { GradingPolicy } from "../../../masters/grading-policy.js";

export interface CourseExamGrade {
  participantId: string;
  eligible: boolean | null;
  examExempt: boolean;
  /** Derived from the admission profile; never accepted as an editable mark. */
  profileForeignLanguageExempt?: boolean;
  /** Server-derived result of an interrupted attempt; never accepted as an editable mark. */
  studyLeaveFailure?: boolean;
  testScore: number | null;
  assignmentScore: number | null;
  examScore: number | null;
  courseScore: number | null;
  grade4: number | null;
  letterGrade: string;
  notes?: string;
  gradingPolicy?: GradingPolicy;
  attemptScores: number[];
  result: "pending" | "passed" | "failed" | "exempt";
}

@Table({ tableName: "course_exam_gradebooks", underscored: true, timestamps: true })
export class CourseExamGradebook extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => ClassGroup) @Column({ type: DataType.UUID, allowNull: false }) declare classGroupId: string;
  @BelongsTo(() => ClassGroup) declare classGroup: ClassGroup;
  @ForeignKey(() => CourseOffering) @Column({ type: DataType.UUID, allowNull: false }) declare courseOfferingId: string;
  @BelongsTo(() => CourseOffering) declare courseOffering: CourseOffering;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare revision: number;
  @Default([]) @Column({ type: DataType.JSONB, allowNull: false }) declare grades: CourseExamGrade[];
}

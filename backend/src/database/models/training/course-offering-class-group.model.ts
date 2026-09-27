import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { ClassGroup } from "./class-group.model.js";
import { CourseOffering } from "./course-offering.model.js";

@Table({ tableName: "course_offering_class_groups", underscored: true, timestamps: true })
export class CourseOfferingClassGroup extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;

  @ForeignKey(() => CourseOffering) @Column({ type: DataType.UUID, allowNull: false }) declare courseOfferingId: string;
  @BelongsTo(() => CourseOffering, { foreignKey: "courseOfferingId", as: "courseOffering" })
  declare courseOffering: any;

  @ForeignKey(() => ClassGroup) @Column({ type: DataType.UUID, allowNull: false }) declare classGroupId: string;
  @BelongsTo(() => ClassGroup, { foreignKey: "classGroupId", as: "classGroup" }) declare classGroup: ClassGroup;
}

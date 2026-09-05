import { DataTypes } from "sequelize";

const timestamps = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});

const uuid = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };

export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.addColumn("staff", "can_manage_scheduling", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }, { transaction });

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX staff_one_scheduling_manager
      ON staff (can_manage_scheduling)
      WHERE can_manage_scheduling = TRUE
    `, { transaction });

    await queryInterface.createTable("course_offerings", {
      id: uuid,
      subject_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "subjects", key: "id" },
        onDelete: "RESTRICT",
      },
      status: {
        type: DataTypes.ENUM("active", "completed"),
        allowNull: false,
        defaultValue: "active",
      },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      completed_by_staff_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "staff", key: "id" },
        onDelete: "RESTRICT",
      },
      note: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps(),
    }, { transaction });

    await queryInterface.addConstraint("course_offerings", {
      fields: ["status", "completed_at", "completed_by_staff_id"],
      type: "check",
      where: queryInterface.sequelize.literal(`
        (status = 'active' AND completed_at IS NULL AND completed_by_staff_id IS NULL)
        OR
        (status = 'completed' AND completed_at IS NOT NULL AND completed_by_staff_id IS NOT NULL)
      `),
      name: "course_offerings_completion_state_check",
      transaction,
    });
    await queryInterface.addIndex("course_offerings", ["subject_id", "status"], {
      name: "course_offerings_subject_status_idx",
      transaction,
    });

    await queryInterface.createTable("course_offering_class_groups", {
      id: uuid,
      course_offering_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "course_offerings", key: "id" },
        onDelete: "CASCADE",
      },
      class_group_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "class_groups", key: "id" },
        onDelete: "RESTRICT",
      },
      ...timestamps(),
    }, { transaction });

    await queryInterface.addConstraint("course_offering_class_groups", {
      fields: ["course_offering_id", "class_group_id"],
      type: "unique",
      name: "course_offering_class_groups_offering_group_unique",
      transaction,
    });
    await queryInterface.addIndex("course_offering_class_groups", ["class_group_id"], {
      name: "course_offering_class_groups_group_idx",
      transaction,
    });
  });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.dropTable("course_offering_class_groups", { transaction });
    await queryInterface.dropTable("course_offerings", { transaction });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_course_offerings_status"', { transaction });
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "staff_one_scheduling_manager"', { transaction });
    await queryInterface.removeColumn("staff", "can_manage_scheduling", { transaction });
  });
}

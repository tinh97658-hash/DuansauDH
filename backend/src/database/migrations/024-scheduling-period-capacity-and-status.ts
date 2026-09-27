import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.addColumn("rooms", "capacity", {
      type: DataTypes.INTEGER,
      allowNull: true,
    }, { transaction });
    await queryInterface.addConstraint("rooms", {
      fields: ["capacity"],
      type: "check",
      where: queryInterface.sequelize.literal("capacity IS NULL OR capacity > 0"),
      name: "rooms_capacity_positive_check",
      transaction,
    });

    await queryInterface.addColumn("teaching_sessions", "period", {
      type: DataTypes.ENUM("MORNING", "AFTERNOON"),
      allowNull: true,
    }, { transaction });
    await queryInterface.sequelize.query(`
      UPDATE teaching_sessions
      SET period = CASE
        WHEN start_time < TIME '12:00:00' THEN 'MORNING'::enum_teaching_sessions_period
        ELSE 'AFTERNOON'::enum_teaching_sessions_period
      END
      WHERE period IS NULL
    `, { transaction });
    await queryInterface.changeColumn("teaching_sessions", "period", {
      type: DataTypes.ENUM("MORNING", "AFTERNOON"),
      allowNull: false,
    }, { transaction });

    await queryInterface.addColumn("teaching_sessions", "status", {
      type: DataTypes.ENUM("planned", "held", "not_held"),
      allowNull: false,
      defaultValue: "planned",
    }, { transaction });
    await queryInterface.addColumn("teaching_sessions", "confirmed_at", {
      type: DataTypes.DATE,
      allowNull: true,
    }, { transaction });
    await queryInterface.addColumn("teaching_sessions", "confirmed_by_staff_id", {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "staff", key: "id" },
      onDelete: "RESTRICT",
    }, { transaction });
    await queryInterface.addConstraint("teaching_sessions", {
      fields: ["status", "confirmed_at", "confirmed_by_staff_id"],
      type: "check",
      where: queryInterface.sequelize.literal(`
        (status = 'planned' AND confirmed_at IS NULL AND confirmed_by_staff_id IS NULL)
        OR
        (status IN ('held', 'not_held') AND confirmed_at IS NOT NULL AND confirmed_by_staff_id IS NOT NULL)
      `),
      name: "teaching_sessions_confirmation_state_check",
      transaction,
    });
    await queryInterface.addIndex("teaching_sessions", ["status", "session_date"], {
      name: "teaching_sessions_status_date_idx",
      transaction,
    });
  });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.removeIndex("teaching_sessions", "teaching_sessions_status_date_idx", { transaction });
    await queryInterface.removeConstraint("teaching_sessions", "teaching_sessions_confirmation_state_check", { transaction });
    await queryInterface.removeColumn("teaching_sessions", "confirmed_by_staff_id", { transaction });
    await queryInterface.removeColumn("teaching_sessions", "confirmed_at", { transaction });
    await queryInterface.removeColumn("teaching_sessions", "status", { transaction });
    await queryInterface.removeColumn("teaching_sessions", "period", { transaction });
    await queryInterface.removeConstraint("rooms", "rooms_capacity_positive_check", { transaction });
    await queryInterface.removeColumn("rooms", "capacity", { transaction });
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS enum_teaching_sessions_status", { transaction });
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS enum_teaching_sessions_period", { transaction });
  });
}

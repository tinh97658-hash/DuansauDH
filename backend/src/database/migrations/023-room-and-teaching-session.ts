import { DataTypes } from "sequelize";

const timestamps = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});

const uuid = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };

export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.createTable("rooms", {
      id: uuid,
      code: { type: DataTypes.STRING(30), allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(),
    }, { transaction });
    await queryInterface.addIndex("rooms", ["code"], {
      name: "rooms_code_unique",
      unique: true,
      transaction,
    });
    await queryInterface.addIndex("rooms", ["is_active", "name"], {
      name: "rooms_active_name_idx",
      transaction,
    });

    await queryInterface.createTable("teaching_sessions", {
      id: uuid,
      course_offering_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "course_offerings", key: "id" },
        onDelete: "RESTRICT",
      },
      session_date: { type: DataTypes.DATEONLY, allowNull: false },
      start_time: { type: DataTypes.TIME, allowNull: false },
      end_time: { type: DataTypes.TIME, allowNull: false },
      lecturer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "lecturers", key: "id" },
        onDelete: "RESTRICT",
      },
      room_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "rooms", key: "id" },
        onDelete: "RESTRICT",
      },
      note: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps(),
    }, { transaction });
    await queryInterface.addConstraint("teaching_sessions", {
      fields: ["start_time", "end_time"],
      type: "check",
      where: queryInterface.sequelize.literal("start_time < end_time"),
      name: "teaching_sessions_time_range_check",
      transaction,
    });
    await queryInterface.addIndex("teaching_sessions", ["session_date", "start_time", "end_time"], {
      name: "teaching_sessions_date_time_idx",
      transaction,
    });
    await queryInterface.addIndex("teaching_sessions", ["course_offering_id", "session_date"], {
      name: "teaching_sessions_offering_date_idx",
      transaction,
    });
    await queryInterface.addIndex("teaching_sessions", ["room_id", "session_date", "start_time", "end_time"], {
      name: "teaching_sessions_room_overlap_idx",
      transaction,
    });
    await queryInterface.addIndex("teaching_sessions", ["lecturer_id", "session_date", "start_time", "end_time"], {
      name: "teaching_sessions_lecturer_overlap_idx",
      transaction,
    });
  });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.dropTable("teaching_sessions", { transaction });
    await queryInterface.dropTable("rooms", { transaction });
  });
}

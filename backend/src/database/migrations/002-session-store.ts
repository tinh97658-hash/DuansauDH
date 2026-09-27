import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.createTable("sessions", {
    sid: { type: DataTypes.STRING(36), primaryKey: true },
    expires: { type: DataTypes.DATE },
    data: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex("sessions", ["expires"], { name: "sessions_expires_idx" });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.dropTable("sessions");
}

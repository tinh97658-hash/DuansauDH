import { DataTypes } from "sequelize";

/** Cho phép quản trị viên khóa tài khoản mà không xóa dữ liệu liên quan. */
export async function up({ context: queryInterface }: any) {
  await queryInterface.addColumn("staff", "active", {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  });
  await queryInterface.addIndex("staff", ["active"], { name: "staff_active_idx" });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.removeIndex("staff", "staff_active_idx");
  await queryInterface.removeColumn("staff", "active");
}

import React from "react";
import CatalogManager from "../../components/CatalogManager";
import { getRoomFloor } from "../../utils/schedulingCalendar";

const Rooms = () => (
  <CatalogManager
    title="Phòng học"
    group="Danh mục đào tạo"
    desc="Quản lý danh mục phòng dùng chung cho xếp lịch."
    endpoint="/system/rooms?includeInactive=true"
    baseEndpoint="/system/rooms"
    itemName="phòng"
    codeLabel="Mã phòng"
    nameLabel="Tên phòng"
    addButtonLabel="Thêm phòng"
    activeField="isActive"
    activeStatusLabel={(active) => active ? "Đang sử dụng" : "Ngừng sử dụng"}
    showStatusBadge={false}
    activeSwitchAriaLabel={(active, row) => `${active ? "Vô hiệu hóa" : "Kích hoạt"} phòng ${row.code}`}
    sortable={false}
    showDeleteAction={false}
    validate={(form) => {
      if (!form.code?.trim() || !form.name?.trim() || !/^\d/.test(form.code.trim())) {
        return "Vui lòng nhập đủ tên phòng; mã phòng phải bắt đầu bằng số tầng.";
      }
      if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) <= 0) {
        return "Sức chứa phải là số nguyên lớn hơn 0.";
      }
      return null;
    }}
    fields={[
      {
        key: "floor",
        label: "Tầng",
        type: "custom",
        showInForm: false,
        align: "center",
        render: (row) => getRoomFloor(row.code) ?? "—",
      },
      {
        key: "capacity",
        label: "Sức chứa",
        type: "number",
        required: true,
        min: 1,
        align: "center",
        display: (row) => row.capacity ?? "Chưa khai báo",
      },
    ]}
  />
);

export default Rooms;

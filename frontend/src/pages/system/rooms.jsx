import React from "react";
import CatalogManager from "../../components/CatalogManager";
import { usePermissions } from "../../features/accounts/usePermissions";

const Rooms = () => {
  const { can } = usePermissions();
  return (
  <CatalogManager
    title="Phòng học"
    group="Danh mục đào tạo"
    desc="Quản lý danh mục phòng dùng chung cho xếp lịch."
    endpoint={can("catalog.manage") ? "/system/rooms?includeInactive=true" : "/system/rooms"}
    baseEndpoint="/system/rooms"
    itemName="phòng"
    codeLabel="Mã phòng"
    nameLabel="Tên phòng"
    addButtonLabel="Thêm phòng"
    activeField="isActive"
    showStatus
    editOnDoubleClick
    sortable={false}
    showDeleteAction={false}
    validate={(form) => {
      if (!form.code?.trim() || !form.name?.trim()) {
        return "Vui lòng nhập đủ mã phòng và tên phòng.";
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
        type: "text",
        showInForm: true,
        required: false,
        helper: "Có thể để trống.",
        align: "center",
        display: (row) => row.floor ?? "—",
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
};

export default Rooms;

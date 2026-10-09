import React from "react";
import CatalogManager from "../../components/CatalogManager";

const Lecturers = () => (
  <CatalogManager
    title="Giảng viên"
    group="Danh mục đào tạo"
    desc="Quản lý thông tin giảng viên, đơn vị công tác và loại giảng dạy."
    endpoint="/system/lecturers"
    itemName="giảng viên"
    codeLabel="Mã giảng viên"
    nameLabel="Họ và tên"
    splitPersonName
    sortable={false}
    editOnDoubleClick
    showEditAction={false}
    showDeleteAction={false}
    fields={[
      {
        key: "unitId", label: "Đơn vị", type: "select",
        optionsEndpoint: "/system/units", requiredOnCreate: true, alphabeticalGroups: true,
        filterOption: (unit, form) => unit.active !== false || unit.id === form.unitId,
        display: (row, options) => options?.find((unit) => unit.value === row.unitId)?.label || (row.unitId ? "—" : "Chưa chọn đơn vị"),
        searchValue: (row, options) => options?.find((unit) => unit.value === row.unitId)?.label || "",
        helper: "Tên đơn vị được lấy từ danh mục Đơn vị.",
      },
      { key: "phone", label: "Số điện thoại", type: "tel" },
      {
        key: "academicRank",
        label: "Học hàm",
        type: "select",
        options: ["Giáo sư", "Phó Giáo sư"],
      },
      {
        key: "academicDegree",
        label: "Học vị",
        type: "select",
        options: ["Tiến sĩ", "Tiến sĩ Khoa học", "Thạc sĩ", "Cử nhân", "Kỹ sư", "Bác sĩ", "Bác sĩ CKII", "Bác sĩ CKI"],
      },
      {
        key: "teachingType",
        label: "Loại giảng dạy",
        type: "select",
        options: ["Cơ hữu", "Thỉnh giảng", "Kiêm nhiệm"],
      },
    ]}
  />
);
export default Lecturers;

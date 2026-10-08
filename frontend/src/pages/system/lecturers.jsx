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
        key: "disciplineId", label: "Đơn vị", type: "select",
        optionsEndpoint: "/system/disciplines", requiredOnCreate: true, alphabeticalGroups: true,
        filterOption: (unit, form) => unit.active !== false || unit.id === form.disciplineId,
        display: (row) => row.discipline?.name || (row.faculty ? `${row.faculty} (chưa liên kết)` : "Chưa có đơn vị"),
        searchValue: (row) => row.discipline?.name || row.faculty,
        helper: (form, row) => !form.disciplineId && row?.faculty
          ? `Đơn vị cũ: ${row.faculty}. Chọn từ danh mục để liên kết; để trống giữ dữ liệu cũ.` : "",
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

import React from "react";
import CatalogManager from "../../components/CatalogManager";

const Lecturers = () => (
  <CatalogManager
    title="Giảng viên"
    group="Danh mục đào tạo"
    desc="Quản lý giảng viên theo ngành và chuyên ngành để gợi ý đúng người khi xếp lịch học phần."
    endpoint="/system/lecturers"
    itemName="giảng viên"
    codeLabel="Mã giảng viên"
    nameLabel="Họ và tên"
    splitPersonName
    sortable={false}
    editOnDoubleClick
    showEditAction={false}
    showDeleteAction={false}
    parent={{
      field: "disciplineId",
      label: "Ngành",
      columnLabel: "Ngành",
      endpoint: "/system/disciplines",
      optionLabel: (item) => `${item.code} · ${item.name}`,
      resetFields: ["majorId"],
      display: (row) => row.discipline ? `${row.discipline.code} · ${row.discipline.name}` : "Chưa phân ngành",
    }}
    fields={[
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
      {
        key: "majorId",
        showInTable: false,
        label: "Chuyên ngành",
        type: "select",
        optionsEndpoint: "/system/majors",
        optionLabel: (item) => item.name,
        filterOption: (item, form) => Boolean(form.disciplineId) && item.disciplineId === form.disciplineId,
        required: true,
        allowEmpty: false,
        display: (row) => row.major ? row.major.name : "Chưa phân chuyên ngành",
        searchValue: (row) => row.major?.name || "",
      },
    ]}
  />
);
export default Lecturers;

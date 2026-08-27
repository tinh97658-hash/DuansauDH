import React from "react";
import CatalogManager from "../../components/CatalogManager";

const Lecturers = () => (
  <CatalogManager
    title="Giảng viên"
    group="Danh mục đào tạo"
    desc="Quản lý danh mục giảng viên, người hướng dẫn."
    endpoint="/system/lecturers"
    itemName="giảng viên"
    codeLabel="Mã giảng viên"
    nameLabel="Họ và tên"
    sortable={false}
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
      { key: "department", label: "Đơn vị", type: "text" },
    ]}
  />
);
export default Lecturers;

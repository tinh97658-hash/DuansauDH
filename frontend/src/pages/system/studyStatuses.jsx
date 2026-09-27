import React from "react";
import CatalogManager from "../../components/CatalogManager";

const StudyStatuses = () => (
  <CatalogManager
    title="Trạng thái học"
    group="Danh mục đào tạo"
    desc="Danh mục trạng thái học tập của học viên."
    endpoint="/system/study-statuses"
    itemName="trạng thái học"
    codeLabel="Mã trạng thái"
    nameLabel="Tên trạng thái"
  />
);
export default StudyStatuses;

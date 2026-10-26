import React from "react";
import CatalogManager from "../../components/CatalogManager";

const TrainingModeGroups = () => (
  <CatalogManager
    sortable={false}
    title="Nhóm hình thức đào tạo"
    group="Danh mục đào tạo"
    desc="Danh mục nhóm hình thức đào tạo."
    endpoint="/system/training-mode-groups"
    itemName="nhóm hình thức đào tạo"
    codeLabel="Mã nhóm"
    nameLabel="Tên nhóm"
    editOnDoubleClick
  />
);
export default TrainingModeGroups;

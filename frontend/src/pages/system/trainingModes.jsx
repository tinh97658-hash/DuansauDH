import React from "react";
import CatalogManager from "../../components/CatalogManager";

const TrainingModes = () => (
  <CatalogManager
    title="Hình thức đào tạo"
    group="Danh mục đào tạo"
    desc="Danh mục hình thức đào tạo (chính quy, tại chức...)."
    endpoint="/system/training-modes"
    itemName="hình thức đào tạo"
    codeLabel="Mã hình thức"
    nameLabel="Tên hình thức"
    parent={{ field: "groupId", label: "Nhóm hình thức", columnLabel: "Nhóm hình thức", endpoint: "/system/training-mode-groups", optional: true, display: (row) => row.group?.name }}
  />
);
export default TrainingModes;

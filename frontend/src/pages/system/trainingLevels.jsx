import React from "react";
import CatalogManager from "../../components/CatalogManager";

const TrainingLevels = () => (
  <CatalogManager
    title="Trình độ đào tạo"
    group="Danh mục đào tạo"
    desc="Danh mục trình độ đào tạo (thạc sĩ, tiến sĩ...)."
    endpoint="/system/training-levels"
    itemName="trình độ đào tạo"
    codeLabel="Mã trình độ"
    nameLabel="Tên trình độ"
    fields={[{ key: "durationYears", label: "Số năm đào tạo", type: "number", min: 1, step: 0.5, defaultValue: 2 }]}
  />
);
export default TrainingLevels;

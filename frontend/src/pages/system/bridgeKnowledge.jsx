import React from "react";
import CatalogManager from "../../components/CatalogManager";

const BridgeKnowledge = () => (
  <CatalogManager
    title="Bổ sung kiến thức"
    group="Danh mục đào tạo"
    desc="Danh mục các học phần bổ sung kiến thức."
    endpoint="/system/bridge-knowledge"
    itemName="học phần bổ sung kiến thức"
    codeLabel="Mã học phần"
    nameLabel="Tên học phần"
    fields={[{ key: "credits", label: "Số tín chỉ", type: "number", min: 0, defaultValue: 0 }]}
  />
);
export default BridgeKnowledge;

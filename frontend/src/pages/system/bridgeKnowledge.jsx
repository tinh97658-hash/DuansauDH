import React from "react";
import CatalogManager from "../../components/CatalogManager";

// Khai báo ở phạm vi module để không đổi tham chiếu mỗi lần render (tránh vòng lặp tải danh mục).
const FIELDS = [
  { key: "credits", label: "Số tín chỉ", type: "number", min: 0, defaultValue: 0 },
  {
    key: "equivalentSubjectId",
    label: "Tương đương học phần CTĐT (Thạc sĩ)",
    type: "select",
    optionsEndpoint: "/plan/subjects?program=masters",
    optionLabel: (item) => `${item.codeText || item.codeNumber || item.code || ""} — ${item.name}`,
    showInTable: false,
  },
];

const BridgeKnowledge = () => (
  <CatalogManager
    title="Bổ sung kiến thức"
    group="Danh mục đào tạo"
    desc="Danh mục các học phần bổ sung kiến thức. Chỉ công nhận khi khai báo tương đương với một học phần của CTĐT."
    endpoint="/system/bridge-knowledge"
    itemName="học phần bổ sung kiến thức"
    codeLabel="Mã học phần"
    nameLabel="Tên học phần"
    fields={FIELDS}
  />
);
export default BridgeKnowledge;

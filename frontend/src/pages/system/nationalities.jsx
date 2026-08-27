import React from "react";
import CatalogManager from "../../components/CatalogManager";

const Nationalities = () => (
  <CatalogManager
    title="Quốc tịch"
    group="Danh mục chung"
    desc="Danh mục quốc tịch dùng chung cho toàn hệ thống."
    endpoint="/system/nationalities"
    itemName="quốc tịch"
    codeLabel="Mã quốc tịch"
    nameLabel="Tên quốc tịch"
  />
);
export default Nationalities;

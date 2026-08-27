import React from "react";
import CatalogManager from "../../components/CatalogManager";

const Ethnicities = () => (
  <CatalogManager
    title="Dân tộc"
    group="Danh mục chung"
    desc="Danh mục dân tộc dùng chung cho toàn hệ thống."
    endpoint="/system/ethnicities"
    itemName="dân tộc"
    codeLabel="Mã dân tộc"
    nameLabel="Tên dân tộc"
  />
);
export default Ethnicities;

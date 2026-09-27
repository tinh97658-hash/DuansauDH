import React from "react";
import CatalogManager from "../../components/CatalogManager";

const Cities = () => (
  <CatalogManager
    title="Thành phố"
    group="Danh mục chung"
    desc="Danh mục tỉnh, thành phố theo đơn vị hành chính."
    endpoint="/system/cities"
    itemName="thành phố"
    codeLabel="Mã thành phố"
    nameLabel="Tên thành phố"
  />
);
export default Cities;

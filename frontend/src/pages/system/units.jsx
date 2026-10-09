import React from "react";
import CatalogManager from "../../components/CatalogManager";

const Units = () => (
  <CatalogManager
    title="Đơn vị"
    group="Danh mục đào tạo"
    desc="Quản lý các khoa, viện và đơn vị công tác của giảng viên."
    endpoint="/system/units"
    itemName="đơn vị"
    codeLabel="Mã đơn vị"
    nameLabel="Tên đơn vị"
    sortable={false}
    inlineEdit
  />
);

export default Units;

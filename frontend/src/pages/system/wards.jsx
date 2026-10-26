import React from "react";
import CatalogManager from "../../components/CatalogManager";

const Wards = () => (
  <CatalogManager
    editOnDoubleClick
    title="Phường xã"
    group="Danh mục chung"
    desc="Danh mục phường, xã theo đơn vị hành chính."
    endpoint="/system/wards"
    itemName="phường xã"
    codeLabel="Mã phường xã"
    nameLabel="Tên phường xã"
    sortable={false}
    parent={{
      field: "districtId",
      label: "Quận huyện",
      columnLabel: "Quận huyện",
      endpoint: "/system/districts",
      display: (row) => `${row.district?.name || ""}${row.district?.city ? `, ${row.district.city.name}` : ""}`,
    }}
  />
);
export default Wards;

import React from "react";
import CatalogManager from "../../components/CatalogManager";

/**
 * Danh mục NGÀNH (cấp 1). Một ngành có nhiều chuyên ngành — xem trang "Chuyên ngành".
 * Mã ngành theo danh mục BGD&ĐT (7 số).
 */
const Disciplines = () => (
  <CatalogManager
    title="Ngành đào tạo"
    group="Danh mục đào tạo"
    desc="Danh mục ngành đào tạo (mã ngành BGD&ĐT). Mỗi ngành gồm nhiều chuyên ngành — khai báo chuyên ngành tại mục “Chuyên ngành”."
    endpoint="/system/disciplines"
    itemName="ngành đào tạo"
    codeLabel="Mã ngành"
    nameLabel="Tên ngành"
    showIndex={false}
    showSortColumn={false}
    editOnDoubleClick
    fields={[
      { key: "englishName", label: "Tên tiếng Anh", type: "text" },
    ]}
  />
);
export default Disciplines;

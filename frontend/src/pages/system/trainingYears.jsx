import React from "react";
import CatalogManager from "../../components/CatalogManager";
import { formatDate } from "../../utils/dateFormat";

const fields = [{ key: "startDate", label: "Ngày bắt đầu", type: "date", required: true, render: row => formatDate(row.startDate) }];
export default function TrainingYears() {
  return <CatalogManager title="Năm đào tạo" group="Danh mục đào tạo"
    desc="Quản lý năm và ngày bắt đầu. Các năm đang hoạt động được hiển thị trong danh sách chọn năm."
    endpoint="/system/training-years" itemName="năm đào tạo" nameLabel="Năm"
    showCode={false} sortable={false} editOnDoubleClick fields={fields}
    validate={form => !/^[1-9][0-9]{3}$/.test(form.name?.trim()) ? "Vui lòng nhập năm gồm 4 chữ số." : null} />;
}

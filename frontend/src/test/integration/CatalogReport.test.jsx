import React from "react";
import { render, screen } from "@testing-library/react";
import axios from "axios";
import CatalogManager from "../../components/CatalogManager";
import { AuthSessionContext } from "../../context/AuthSession";
import { normalizeReport } from "../../utils/reportExport";

const captured = vi.hoisted(() => ({ config: null }));
vi.mock("axios");
vi.mock(import("../../components/FeatureLayout"), () => ({ default: ({ children, exportConfig }) => { captured.config = exportConfig; return <div>{children}</div>; } }));

it("exports the entire filtered catalog with complete text, booleans and zero values beyond the first page", async () => {
  const note = "Ghi chú đầy đủ có độ dài vượt quá phần rút gọn trên giao diện và phải xuất toàn bộ.";
  const rows = Array.from({ length: 37 }, (_, index) => ({ id: `record-${index}`, code: `DM${index + 1}`, name: `Danh mục ${index + 1}`, active: true, note, enabled: false, quantity: 0 }));
  axios.get.mockResolvedValue({ data: rows });
  render(<AuthSessionContext.Provider value={{ user: { role: "supervisor" }, access: { permissions: ["catalog.view"] } }}>
    <CatalogManager title="Danh mục" endpoint="/system/units" itemName="danh mục" sortable={false} fields={[
      { key: "note", label: "Ghi chú", type: "multiline" },
      { key: "enabled", label: "Cho phép", type: "boolean" },
      { key: "quantity", label: "Số lượng", type: "number" },
    ]} />
  </AuthSessionContext.Provider>);
  await screen.findByText("Danh mục 1");
  expect(screen.queryByText("Danh mục 37")).not.toBeInTheDocument();
  const report = normalizeReport(captured.config.getReport());
  const section = report.sections[0];
  expect(section.rows).toHaveLength(37);
  expect(section.rows[36]).toEqual([37, "DM37", "Danh mục 37", note, "Không", 0, "Đang sử dụng"]);
  expect(section.headers).toEqual(["STT", "Mã", "Tên", "Ghi chú", "Cho phép", "Số lượng", "Trạng thái"]);
  expect(report.metadata).toContainEqual(["Phạm vi", "37 bản ghi phù hợp bộ lọc"]);
});

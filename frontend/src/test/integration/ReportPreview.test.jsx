import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportPreview from "../../components/ReportPreview";
import { downloadReport } from "../../utils/reportExport";
import { readReportPreview } from "../../utils/reportPreview";

beforeEach(() => { sessionStorage.clear(); vi.spyOn(window, "print").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

it("opens a frozen PDF preview with the complete masthead and prints only after clicking", async () => {
  const tab = { sessionStorage, location: { replace: vi.fn() } };
  const report = { title: "Danh sách học viên", metadata: [["Lớp", "CNTT26"]], sections: [{ title: "Học viên", headers: ["Mã HV", "Họ tên"], rows: [["HV01", "Nguyễn An"]] }] };
  await downloadReport(report, "pdf", { reservedTab: tab });
  const url = tab.location.replace.mock.calls[0][0];
  const id = new URL(url, "http://localhost").searchParams.get("preview");
  expect(readReportPreview(id).sections[0].rows).toEqual([["HV01", "Nguyễn An"]]);
  report.sections[0].rows[0][1] = "Tên đã thay đổi";
  render(<MemoryRouter initialEntries={[url]}><ReportPreview /></MemoryRouter>);
  for (const label of ["BỘ XÂY DỰNG", "TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM", "VIỆN ĐÀO TẠO SAU ĐẠI HỌC", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc", "Nguyễn An"]) expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText(/Hải Phòng, ngày \d{2}\/\d{2}\/\d{2}/)).toBeInTheDocument();
  expect(window.print).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "In / Lưu PDF" }));
  expect(window.print).toHaveBeenCalledTimes(1);
});

it("fits compact matrix columns to their content and leaves room for subject and offering names", async () => {
  const tab = { sessionStorage, location: { replace: vi.fn() } };
  await downloadReport({ title: "Ma trận lớp học phần", sections: [{ title: "Danh sách lớp học phần",
    headers: ["STT", "Mã HP", "Học phần", "TC", "Lớp học phần", "Lớp/nhóm", "Khóa", "Số HV", "Tình trạng xếp lịch", "Số buổi đã học"],
    rows: [[1, "CNTT14", "Siêu dữ liệu nâng cao", 2, "Lớp Siêu dữ liệu nâng cao - CNTT 2026.1.1", "CNTT 2026.1.1", "2026", 18, "Đã xếp lịch", 1]] }] }, "pdf", { reservedTab: tab });
  render(<MemoryRouter initialEntries={[tab.location.replace.mock.calls[0][0]]}><ReportPreview /></MemoryRouter>);
  const table = screen.getByRole("table");
  expect(table).toHaveClass("report-matrix-table");
  for (const label of ["Mã HP", "TC", "Số HV"]) expect(screen.getByRole("columnheader", { name: label })).toHaveClass("report-matrix-compact");
  const columns = table.querySelectorAll("col");
  for (const index of [1, 3, 7]) expect(columns[index].style.width).toBe("1%");
  expect(columns[2].style.width).toBe("");
  expect(columns[4].style.width).toBe("");
  expect(table.style.tableLayout).toBe("");
});

it("rejects a corrupt snapshot without exposing print", () => {
  sessionStorage.setItem("report-preview:broken", JSON.stringify({ version: 1, title: "Report", generatedAt: "31/10/26", metadata: [], sections: [{ headers: ["Tên"], title: "Report", rows: [[{ secret: true }]] }] }));
  render(<MemoryRouter initialEntries={["/reports/export-preview?preview=broken"]}><ReportPreview /></MemoryRouter>);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(window.print).not.toHaveBeenCalled();
});

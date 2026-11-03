import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PageExportBoundary from "../../components/PageExportBoundary";
import DocumentExportMenu from "../../components/DocumentExportMenu";
import InlineReportExport from "../../components/InlineReportExport";
import { useReportExport } from "../../components/ReportExportContext";
import { downloadReport } from "../../utils/reportExport";
import AppToaster from "../../components/AppToaster";
import { toast } from "react-toastify";

vi.mock("../../utils/reportExport", async () => ({ ...await vi.importActual("../../utils/reportExport"), downloadReport: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); downloadReport.mockResolvedValue(); vi.spyOn(window, "open").mockReturnValue({ close: vi.fn() }); });
beforeEach(() => { render(<AppToaster />); });
afterEach(() => { toast.dismiss(); toast.clearWaitingQueue(); });
const table = <table><thead><tr><th>Mã HV</th><th>Họ tên</th></tr></thead><tbody><tr><td>HV001</td><td>Nguyễn An</td></tr></tbody></table>;

it("adds all three formats to a data page and exports its visible snapshot", async () => {
  render(<PageExportBoundary title="Học viên">{table}</PageExportBoundary>);
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất Word (.docx)" }));
  await waitFor(() => expect(downloadReport).toHaveBeenCalledWith(expect.objectContaining({ title: "Học viên",
    sections: [expect.objectContaining({ rows: [["HV001", "Nguyễn An"]] })] }), "word"));
});

it("places export beside the page's add action and removes the separate top toolbar", async () => {
  render(<PageExportBoundary title="Danh mục"><div data-testid="filter-bar"><button>Thêm mới</button><InlineReportExport /></div>{table}</PageExportBoundary>);
  const menu = screen.getByRole("button", { name: "Xuất báo cáo" });
  expect(screen.getByTestId("filter-bar")).toContainElement(menu);
  expect(screen.getAllByRole("button", { name: "Xuất báo cáo" })).toHaveLength(1);
  expect(document.querySelector(".page-export-toolbar")).toBeNull();
  fireEvent.click(menu);
  expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất Excel (.xlsx)" }));
  await waitFor(() => expect(downloadReport).toHaveBeenCalledWith(expect.objectContaining({ title: "Danh mục" }), "excel"));
});

it("keeps an existing specialized export and fills in its missing format without duplicate buttons", async () => {
  const pdf = vi.fn();
  render(<PageExportBoundary title="Lịch">{table}<DocumentExportMenu onPdf={pdf} /></PageExportBoundary>);
  expect(screen.getAllByRole("button", { name: "Xuất báo cáo" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất PDF (.pdf)" }));
  expect(pdf).toHaveBeenCalledOnce();
  expect(downloadReport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất Excel (.xlsx)" }));
  await waitFor(() => expect(downloadReport).toHaveBeenCalledWith(expect.any(Object), "excel"));
});

it.each([false, true])("limits record exports to Excel with inline placement %s", async inline => {
  render(<PageExportBoundary title="Hồ sơ tuyển sinh" config={{ formats: ["excel"] }}>
    {table}{inline && <InlineReportExport />}
  </PageExportBoundary>);
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  expect(screen.queryByRole("menuitem", { name: "Xuất Word (.docx)" })).not.toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Xuất PDF (.pdf)" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất Excel (.xlsx)" }));
  await waitFor(() => expect(downloadReport).toHaveBeenCalledWith(expect.objectContaining({ title: "Hồ sơ tuyển sinh" }), "excel"));
  expect(window.open).not.toHaveBeenCalled();
});

function Dataset() {
  const [filter, setFilter] = useState("Cũ");
  useReportExport(() => ({ title: "Toàn bộ kết quả", sections: [{ title: filter, headers: ["Tên"], rows: [[filter], ["Trang 2"]] }] }));
  return <button onClick={() => setFilter("Mới")}>Đổi bộ lọc</button>;
}
it("exports the full registered dataset using the latest filter even on pages without a table", async () => {
  render(<PageExportBoundary title="Danh sách"><Dataset /></PageExportBoundary>);
  fireEvent.click(screen.getByRole("button", { name: "Đổi bộ lọc" }));
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất Excel (.xlsx)" }));
  await waitFor(() => expect(downloadReport).toHaveBeenCalledWith(expect.objectContaining({ sections: [expect.objectContaining({ rows: [["Mới"], ["Trang 2"]] })] }), "excel"));
});

it("disables export until data is available and reports failures", async () => {
  const { rerender } = render(<PageExportBoundary title="Danh sách"><p>Đang tải</p></PageExportBoundary>);
  expect(screen.getByRole("button", { name: "Xuất báo cáo" })).toBeDisabled();
  rerender(<PageExportBoundary title="Danh sách" config={{ getReport: async () => { throw new Error("Không tải được trang 2"); } }}>{table}</PageExportBoundary>);
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất PDF (.pdf)" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được trang 2");
  expect(downloadReport).not.toHaveBeenCalled();
  expect(window.open.mock.results[0].value.close).toHaveBeenCalledOnce();
});

it("reserves the PDF tab before asynchronous data loading completes", async () => {
  let finish;
  const getReport = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  render(<PageExportBoundary title="Danh sách" config={{ getReport }}>{table}</PageExportBoundary>);
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất PDF (.pdf)" }));
  expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(getReport).toHaveBeenCalledOnce();
  expect(downloadReport).not.toHaveBeenCalled();
  const report = { title: "Danh sách", sections: [{ title: "Danh sách", headers: ["Tên"], rows: [["An"]] }] };
  finish(report);
  await waitFor(() => expect(downloadReport).toHaveBeenCalledWith(report, "pdf", { reservedTab: window.open.mock.results[0].value }));
});

it("reports a blocked preview tab before loading export data", async () => {
  window.open.mockReturnValueOnce(null);
  const getReport = vi.fn();
  render(<PageExportBoundary title="Danh sách" config={{ getReport }}>{table}</PageExportBoundary>);
  fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Xuất PDF (.pdf)" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("chặn tab xem trước");
  expect(getReport).not.toHaveBeenCalled();
  expect(downloadReport).not.toHaveBeenCalled();
});

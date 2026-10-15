import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GradebookPreview from "../../features/exams/GradebookPreview";
import { buildGradebookDocument, openGradebookPreview, readGradebookPreview } from "../../features/exams/gradebookExport";
import { draftOf } from "../../features/exams/gradebook";
import { buildExamListDocument } from "../../features/exams/examListExport";


beforeEach(() => sessionStorage.clear());
it("previews only qualified non-exempt students with exam-list columns", () => {
  const row = { code: "HV001", fullName: "Nguyễn Văn An", testScore: 4, assignmentScore: 4, examScore: null, result: "pending" };
  const document = buildExamListDocument({ name: "Lớp CNTT" }, { subject: { name: "Triết học" } }, [row, { ...row, code: "HV002", examExempt: true }, { ...row, code: "HV003", testScore: 3 }]);
  const replace = jest.fn();
  const open = jest.spyOn(window, "open").mockReturnValue({ sessionStorage, location: { replace }, close: jest.fn() });
  try {
    openGradebookPreview(document);
    const url = replace.mock.calls[0][0];
    render(<MemoryRouter initialEntries={[url]}><GradebookPreview /></MemoryRouter>);
    expect(screen.getByRole("table", { name: "Danh sách thi" })).toBeInTheDocument();
    expect(screen.getByText("HV001")).toBeInTheDocument();
    expect(screen.queryByText("HV002")).not.toBeInTheDocument();
    expect(screen.queryByText("HV003")).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(9);
    expect(screen.queryByRole("columnheader", { name: "Kết quả điểm" })).not.toBeInTheDocument();
  } finally { open.mockRestore(); }
});
it("previews every student with metadata, signing roles and an explicit print action", () => {
  const rows = Array.from({ length: 40 }, (_, i) => draftOf({ code: `HV${i + 1}`, fullName: "Nguyễn Văn An", attemptScores: [], result: "pending" }));
  const document = buildGradebookDocument({ name: "Lớp CNTT" }, { subject: { name: "An toàn thông tin" } }, rows);
  const replace = jest.fn();
  const open = jest.spyOn(window, "open").mockReturnValue({ sessionStorage, location: { replace }, close: jest.fn() });
  const print = jest.spyOn(window, "print").mockImplementation(() => {});
  try {
    openGradebookPreview(document);
    const url = replace.mock.calls[0][0];
    const id = new URL(url, "http://localhost").searchParams.get("preview");
    expect(readGradebookPreview(id).rows).toHaveLength(40);
    render(<MemoryRouter initialEntries={[url]}><GradebookPreview /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: document.title })).toBeInTheDocument();
    expect(screen.getByText("TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM")).toBeInTheDocument();
    expect(screen.getByText("VIỆN ĐÀO TẠO SAU ĐẠI HỌC")).toBeInTheDocument();
    expect(screen.getByText(/Lớp CNTT/)).toBeInTheDocument(); expect(screen.getByText(/An toàn thông tin/)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(41);
    expect(within(table).getAllByRole("columnheader")).toHaveLength(16);
    expect(screen.getByText("HV40")).toBeInTheDocument();
    expect(screen.getByText("VIỆN TRƯỞNG")).toBeInTheDocument(); expect(screen.getByText("PHỤ TRÁCH LỚP")).toBeInTheDocument();
    expect(screen.getByText(document.signingDate)).toBeInTheDocument();
    const footer = table.parentElement.querySelector("footer");
    expect(footer.textContent).toBe(`${document.signingDate}VIỆN TRƯỞNGPHỤ TRÁCH LỚP`);
    expect(table.parentElement.textContent).not.toMatch(/CỘNG HÒA|Độc lập/);
    expect(print).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "In / Lưu PDF" })); expect(print).toHaveBeenCalledTimes(1);
  } finally { open.mockRestore(); print.mockRestore(); }
});
it("reports invalid snapshots and blocked popups without navigating away from unsaved grades", () => {
  sessionStorage.setItem("gradebook-preview:bad", "{"); expect(readGradebookPreview("bad")).toBeNull();
  render(<MemoryRouter initialEntries={["/?preview=bad"]}><GradebookPreview /></MemoryRouter>);
  expect(screen.getByRole("alert")).toHaveTextContent("Không tìm thấy bản xem trước");
  const open = jest.spyOn(window, "open").mockReturnValue(null);
  try { expect(() => openGradebookPreview(buildGradebookDocument({}, {}, []))).toThrow("cho phép mở tab mới"); }
  finally { open.mockRestore(); }
});

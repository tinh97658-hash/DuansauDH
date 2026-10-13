import React from "react";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { normalizeLearnerTranscript, transcriptDocumentDetails, transcriptMetadataRows, transcriptSubjectValues, openLearnerTranscript, readLearnerTranscript } from "../../features/learners/learnerTranscript";
import LearnerTranscriptPreview from "../../features/learners/LearnerTranscriptPreview";
const report = { student: { fullName: "Nguyễn An", dob: "1990-01-02", pob: "Hải Phòng", major: { name: "CNTT" },
  academicYear: "2025", admissionDate: "2025-09-01", trainingLevel: "Thạc sĩ", trainingModeName: "Định hướng nghiên cứu",
  trainingModeGroup: "Chính quy", language: "Tiếng Việt", durationYears: null, masterDiplomaNumber: null, diplomaNumber: "UNDERGRAD" },
  group: { code: "CLASS1" }, curriculum: { name: "CTĐT" }, subjects: [
    { code: "HP01", name: "Zero", credits: 5, grade: { score: 0, result: "failed" } },
    { code: "HP02", name: "Ungraded", credits: 3, grade: null },
    { code: "HP03", name: "Exam exempt", credits: 2, grade: { score: null, result: "exempt", details: { source: "gradebook" } } },
    { code: "HP04", name: "Study exempt", credits: 4, grade: { score: null, result: "exempt", details: { source: "individual" } } },
  ] };

beforeEach(() => {
  sessionStorage.clear();
  jest.spyOn(window, "print").mockImplementation(() => {});
  jest.spyOn(window, "focus").mockImplementation(() => {});
  jest.spyOn(window, "close").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const mountPrint = () => {
  const tab = { sessionStorage, location: { replace: jest.fn() } };
  openLearnerTranscript(report, tab);
  const url = tab.location.replace.mock.calls[0][0];
  const id = new URL(url, "http://localhost").searchParams.get("preview");
  expect(readLearnerTranscript(id)).not.toBeNull();
  const view = render(<React.StrictMode><MemoryRouter initialEntries={[url]}><LearnerTranscriptPreview /></MemoryRouter></React.StrictMode>);
  return { ...view, id };
};
it("automatically dispatches native print once without viewer controls and closes after print or cancel", async () => {
  const { id } = mountPrint();
  await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(document.querySelector("nav")).toBeNull();
  const table = document.querySelector("table");
  expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(5);
  expect(within(table).getByText("0")).toBeInTheDocument();
  expect(screen.getByRole("heading", { hidden: true })).toHaveTextContent("KẾT QUẢ HỌC TẬP");
  expect(screen.getByText("NBH:10/04/23-REV:00")).toBeInTheDocument();
  expect(screen.getByText("BM.08-QT.SDH.05")).toBeInTheDocument();
  expect(screen.getByText("Điểm trung bình chung học phần:")).toHaveTextContent("—");
  expect(screen.getByLabelText("Ký xác nhận bảng điểm")).toHaveTextContent("CHUYÊN VIÊN");
  expect(Array.from(document.querySelectorAll("tbody tr")).map(row => row.cells[1].textContent)).toEqual(report.subjects.map(subject => subject.name));
  expect(document.querySelector("style").textContent).toContain("@media screen");
  act(() => window.dispatchEvent(new Event("afterprint")));
  expect(window.close).toHaveBeenCalledTimes(1);
  expect(readLearnerTranscript(id)).toBeNull();
  expect(window.print).toHaveBeenCalledTimes(1);
});
it("waits for document fonts before measuring and dispatching print", async () => {
  const original = Object.getOwnPropertyDescriptor(document, "fonts");
  let ready;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise(resolve => { ready = resolve; }) } });
  try {
    mountPrint();
    expect(window.print).not.toHaveBeenCalled();
    await act(async () => ready());
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  } finally { if (original) Object.defineProperty(document, "fonts", original); else delete document.fonts; }
});
it("cancels scheduled printing when the temporary document unmounts", async () => {
  const { unmount } = mountPrint();
  unmount();
  await act(async () => new Promise(resolve => setTimeout(resolve, 50)));
  expect(window.print).not.toHaveBeenCalled();
});
it("uses the business date and administrative placeholders without deriving GPA or signer names", () => {
  const document = normalizeLearnerTranscript({ ...report, gpa: 2.97,
    student: { ...report.student, gpa: "9.9" },
    subjects: [{ id: "one", credits: 3, grade: { score: 10, details: { grade4: 4 } } }],
    loggedInUser: { name: "Current user" },
  }, { now: new Date("2026-10-12T18:30:00Z") });
  const details = transcriptDocumentDetails(document);
  expect(document.summary).toEqual({ gpa: null, gradeScale: null });
  expect(details.gpa.value).toBe("—");
  expect(details.issueDate).toBe("Hải Phòng, ngày 13 tháng 10 năm 2026");
  expect(details.numberLine).toMatch(/^Số:\s+\/Khóa 2025\/SĐH$/);
  expect(document.issuance.number).toBeNull();
  expect(details.signatures.map(signature => signature.name)).toEqual([null, null]);
  expect(JSON.stringify(document)).not.toContain("Current user");
  const missing = transcriptDocumentDetails(normalizeLearnerTranscript({}));
  expect(missing.numberLine).toContain(`/Khóa ${".".repeat(19)}/SĐH`);
  expect(missing.gpa.value).toBe("—");
});

it("normalizes missing fields without inventing a cohort, duration or degree number", () => {
  const document = normalizeLearnerTranscript({ student: { diplomaNumber: "UNDERGRAD" }, subjects: [
    { id: "ungraded", name: "Chưa có điểm", grade: { score: null, details: { examScore: 9 } } },
  ] });
  expect(document.learner.fullName).toBeNull();
  expect(document.training).toMatchObject({ academicYear: null, durationYears: null, masterDiplomaNumber: null });
  expect(transcriptMetadataRows(document).flat().every(field => field.value === "—")).toBe(true);
  expect(document.subjects).toHaveLength(1);
  expect(document.subjects[0].score).toBeNull();
  expect(transcriptSubjectValues(document.subjects[0])[4]).toBe("");
  expect(transcriptSubjectValues({ ...document.subjects[0], note: "Chưa có điểm" })[5]).toBe("");
  expect(transcriptSubjectValues({ ...document.subjects[0], note: "Công nhận" })[5]).toBe("Công nhận");
});


it("handles missing or invalid print snapshots without dispatching print", () => {
  sessionStorage.setItem("learner-transcript-preview:bad", JSON.stringify({ version: 1, fields: [] }));
  expect(readLearnerTranscript("bad")).toBeNull();
  render(<MemoryRouter initialEntries={["/reports/learner-transcript/preview?preview=bad"]}><LearnerTranscriptPreview /></MemoryRouter>);
  expect(screen.getByRole("alert")).toHaveTextContent("Không tìm thấy dữ liệu in");
  expect(window.print).not.toHaveBeenCalled();
});

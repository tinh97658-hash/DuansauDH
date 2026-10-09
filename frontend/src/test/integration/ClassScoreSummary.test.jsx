import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import ClassScoreSummary from "../../pages/reports/classScoreSummary";
import { createClassScoreWorkbook } from "../../pages/reports/classScoreSummaryExcel";
import { downloadDocumentFile } from "../../utils/documentFiles";

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
jest.mock("../../utils/documentFiles", () => ({ downloadDocumentFile: jest.fn() }));
jest.mock("../../pages/reports/classScoreSummaryExcel", () => ({
  ...jest.requireActual("../../pages/reports/classScoreSummaryExcel"), createClassScoreWorkbook: jest.fn(),
}));
jest.mock("@mui/icons-material", () => ({ DownloadRounded: () => null, SearchRounded: () => null }));

const groups = [
  { id: "g1", code: "CNTT2026.1.1", academicYear: "2026", major: { id: "m1", name: "Công nghệ thông tin", disciplineId: "d1", discipline: { id: "d1", name: "Kỹ thuật" } } },
  { id: "g2", code: "QTKD2026.1.1", academicYear: "2026", major: { id: "m2", name: "Quản trị kinh doanh", disciplineId: "d2", discipline: { id: "d2", name: "Kinh tế" } } },
  { id: "g3", code: "CNTT2025.1.1", academicYear: "2025", major: { id: "m1", name: "Công nghệ thông tin", disciplineId: "d1", discipline: { id: "d1", name: "Kỹ thuật" } } },
];
const subjects = [
  { id: "hp1", code: "HP01", name: "Triết học", credits: 3, isRequired: true },
  { id: "hp2", code: "HP02", name: "Tiếng Anh", credits: 3, isRequired: true },
  { id: "hp3", code: "HP03", name: "Luận văn", credits: 10, isRequired: true },
];
const student = { participantId: "student:one", code: "HV001", fullName: "Nguyễn Văn An", dob: "1997-04-16", gender: "Nam", scores: { hp1: { score: 0, result: "failed" }, hp2: { score: null, result: "exempt" } } };
const reportFor = (id) => ({ group: groups.find(group => group.id === id), curriculum: { name: "CTĐT Thạc sĩ", totalCredits: 60 }, subjects, rows: [{ ...student, code: `HV00${id.slice(1)}` }], page: 1, pageSize: 50, total: 1 });
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups } : reportFor(config.params.classGroupId) }));
  createClassScoreWorkbook.mockResolvedValue(new Blob(["xlsx"]));
});
const mount = () => render(<MemoryRouter><ClassScoreSummary /></MemoryRouter>);
const chooseFilter = (label, text) => {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: new RegExp(`^${text}`) }));
};

it("shows the whole curriculum, preserving zero, exemption and blank ungraded cells", async () => {
  mount();
  const row = (await screen.findByText("HV001")).closest("tr");
  expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["STT", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", "Triết học", "Tiếng Anh", "Luận văn"]);
  expect(within(row).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["1", "HV001", "Nguyễn Văn", "An", "16/04/1997", "Nam", "0", "MT", ""]);
  expect(within(row).getByText("0")).toHaveClass("css-failed");
  expect(screen.queryByText("CTĐT Thạc sĩ")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Thoát" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Ngành")).toHaveTextContent("Kỹ thuật");
  expect(screen.getByLabelText("Chuyên ngành")).toHaveTextContent("Công nghệ thông tin");
  expect(screen.queryByText(/Ô trống: chưa có điểm/)).not.toBeInTheDocument();
  expect(screen.queryByText("Số dòng:")).not.toBeInTheDocument();
});

it("scopes majors and classes by discipline and resets unavailable choices when the year changes", async () => {
  mount();
  await screen.findByText("HV001");
  chooseFilter("Ngành", "Kỹ thuật");
  chooseFilter("Chuyên ngành", "Công nghệ thông tin");
  expect(screen.getByText("HV001")).toBeInTheDocument();
  chooseFilter("Ngành", "Kinh tế");
  await screen.findByText("HV002");
  expect(screen.getByLabelText("Chuyên ngành")).toHaveTextContent("Quản trị kinh doanh");
  fireEvent.mouseDown(screen.getByLabelText("Chuyên ngành"));
  expect(within(screen.getByRole("listbox")).queryByText("Công nghệ thông tin")).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("listbox")).getByText("Quản trị kinh doanh"));
  chooseFilter("Năm vào trường", "2025");
  await screen.findByText("HV003");
  expect(screen.getByLabelText("Ngành")).toHaveTextContent("Kỹ thuật");
  expect(screen.getByLabelText("Chuyên ngành")).toHaveTextContent("Công nghệ thông tin");
});

it("searches the full class and exports matching students", async () => {
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups } : {
    ...reportFor(config.params.classGroupId), total: config.params.search ? 1 : 60, page: config.params.page || 1,
    rows: [{ ...student, code: config.params.search ? "HV060" : "HV001" }],
  } }));
  mount();
  await screen.findByText("HV001");
  fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "HV060" } });
  const row = (await screen.findByText("HV060")).closest("tr");
  expect(within(row).getAllByRole("cell")[0]).toHaveTextContent("1");
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/class-score-summary\/export$/), { params: { classGroupId: "g1", search: "HV060" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xuất file Excel" })); });
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/export$/), { params: { classGroupId: "g1", search: "HV060" } }));
  await waitFor(() => expect(createClassScoreWorkbook).toHaveBeenCalledWith(expect.objectContaining({ rows: [expect.objectContaining({ code: "HV060" })] })));
  await waitFor(() => expect(screen.getByRole("button", { name: "Xuất file Excel" })).toBeEnabled());
});

it("filters classes by intake year and loads the selected class", async () => {
  mount();
  await screen.findByText("HV001");
  expect(screen.getByLabelText("Chọn lớp")).not.toHaveTextContent("CNTT2025");
  chooseFilter("Ngành", "Kinh tế");
  await screen.findByText("HV002");
  chooseFilter("Năm vào trường", "2025");
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/class-score-summary\/export$/), { params: { classGroupId: "g3" } }));
  await screen.findByText("HV003");
  expect(screen.getByLabelText("Chọn lớp")).toHaveTextContent("CNTT2025.1.1");
  expect(screen.getByLabelText("Chọn lớp")).not.toHaveTextContent("QTKD2026");
});

it("shows every student without pagination controls", async () => {
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups } : {
    ...reportFor(config.params.classGroupId), total: 60,
    rows: Array.from({ length: 60 }, (_, index) => ({ ...student, participantId: `student:${index}`, code: `HV${String(index + 1).padStart(3, "0")}` })),
  } }));
  mount();
  await screen.findByText("HV001");
  const row = screen.getByText("HV060").closest("tr");
  expect(within(row).getAllByRole("cell")[0]).toHaveTextContent("60");
  expect(screen.getAllByRole("row")).toHaveLength(61);
  expect(screen.queryByRole("button", { name: "Trang sau" })).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/class-score-summary\/export$/), { params: { classGroupId: "g1" } });
});

it("exports all students using a separate full-class request", async () => {
  const full = { ...reportFor("g1"), rows: [student, { ...student, participantId: "student:two", code: "HV002" }], total: 2 };
  axios.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/options") ? { groups } : url.endsWith("/export") ? full : reportFor(config.params.classGroupId) }));
  mount();
  await screen.findByText("HV001");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Xuất file Excel" })); });
  await waitFor(() => expect(createClassScoreWorkbook).toHaveBeenCalledWith(full));
  expect(downloadDocumentFile).toHaveBeenCalledWith(expect.any(Blob), "Tong-hop-diem-CNTT2026.1.1.xlsx");
});

it("discards a late response from the previously selected class", async () => {
  let resolveOld;
  axios.get.mockImplementation((url, config) => url.endsWith("/options") ? Promise.resolve({ data: { groups } }) : config.params.classGroupId === "g1" ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ data: reportFor("g2") }));
  mount();
  await waitFor(() => expect(resolveOld).toBeDefined());
  chooseFilter("Ngành", "Kinh tế");
  await screen.findByText("HV002");
  await act(async () => { resolveOld({ data: reportFor("g1") }); });
  await waitFor(() => expect(screen.queryByText("HV001")).not.toBeInTheDocument());
});

it("shows missing curriculum and empty class states with export disabled", async () => {
  axios.get.mockImplementation(async url => ({ data: url.endsWith("/options") ? { groups } : { ...reportFor("g1"), curriculum: null, subjects: [], rows: [], total: 0 } }));
  mount();
  expect(await screen.findByText(/Lớp chưa được gán chương trình đào tạo/)).toBeInTheDocument();
  expect(screen.getByText("Lớp chưa có học viên.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Xuất file Excel" })).toBeDisabled();
});

it("retries a failed report without changing the selected class", async () => {
  mount();
  await screen.findByText("HV001");
  axios.get.mockRejectedValueOnce(new Error("Không tải được bảng điểm"));
  chooseFilter("Ngành", "Kinh tế");
  fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
  await screen.findByText("HV002");
  expect(screen.getByLabelText("Chọn lớp")).toHaveTextContent("QTKD2026.1.1");
});

import { renderWithPermissions } from "../renderWithPermissions";
import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axios from "axios";
import AdmissionRecords from "../../pages/plan/admissionRecords";
import { CssBaseline, ThemeProvider } from "@mui/material";
import theme from "../../theme";

const render = (ui, options) => renderWithPermissions(ui, ["admission.manage"], options);

vi.mock("axios");
vi.mock("@mui/icons-material", () => ({
  AddPhotoAlternateRounded: () => null, AddRounded: () => null, CheckCircleRounded: () => null,
  CloseRounded: () => null, DeleteRounded: () => null, EditRounded: () => null,
  PersonRounded: () => null, VisibilityRounded: () => null, SearchRounded: () => null,
}));
vi.mock("../../components/FeatureLayout", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("react-toastify", () => ({ ToastContainer: () => null, toast: { success: vi.fn(), error: vi.fn() } }));

const record = {
  id: "record-1", code: "HV001", lastName: "Nguyễn Văn", firstName: "An", fullName: "Nguyễn Văn An",
  email: "an@example.test", gender: "Nam", majorId: "m1", trainingLevel: "Thạc sĩ", studyStatus: "Đã trúng tuyển", academicYear: "2025",
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  axios.get.mockImplementation(async url => {
    if (url.includes("/auth/isStaff")) return { data: { message: "admin" } };
    if (url.includes("/system/majors")) return { data: [{ id: "m1", name: "Công nghệ thông tin", program: "masters" }] };
    if (url.includes("/admission-records?")) return { data: { data: [record], pagination: { total: 1, totalPages: 1 }, stats: { total: 1 } } };
    return { data: [] };
  });
});

const mount = mode => render(<ThemeProvider theme={theme}><CssBaseline /><MemoryRouter>
  <Routes>
    <Route path="/" element={<AdmissionRecords mode={mode} />} />
    <Route path="/plan/admission-records/:id" element={<p>Trang chi tiết học viên</p>} />
    <Route path="/masters/admitted-records/:id" element={<p>Trang chi tiết học viên</p>} />
  </Routes>
</MemoryRouter></ThemeProvider>);

describe.each(["applications", "admitted-masters"])("Student record interactions: %s", mode => {
  it.each(["HV001", "an@example.test", "Nam"])("opens the populated profile on double click of %s", async text => {
    mount(mode);
    const cell = await screen.findByRole("cell", { name: text, exact: true });
    fireEvent.click(cell);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.doubleClick(cell);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("SỬA HỒ SƠ HỌC VIÊN")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Nguyễn Văn")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("An")).toBeInTheDocument();
    expect(screen.queryByText("Trang chi tiết học viên")).not.toBeInTheDocument();
  });

  it.each(["Nguyễn Văn", "An"])("navigates to the detail page by clicking the name %s", async name => {
    mount(mode);
    fireEvent.click(await screen.findByRole("link", { name }));
    expect(screen.getByText("Trang chi tiết học viên")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the pencil button opening the profile", async () => {
    mount(mode);
    await screen.findByRole("cell", { name: "HV001" });
    expect(screen.getByRole("columnheader", { name: /Năm nhập học/ })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2025" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa hồ sơ HV001" }));
    expect(within(screen.getByRole("dialog")).getByDisplayValue("HV001")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("textbox", { name: "Năm nhập học" })).toHaveValue("2025");
    expect(within(screen.getByRole("dialog")).queryByRole("textbox", { name: "Năm vào trường" })).not.toBeInTheDocument();
  });
});

it("creates a profile with the year selected in the filter", async () => {
  axios.post.mockResolvedValue({ data: {} });
  mount("applications");
  await screen.findByRole("cell", { name: "HV001" });
  const selectedYear = String(new Date().getFullYear() - 1);
  fireEvent.mouseDown(screen.getByLabelText("Năm"));
  fireEvent.click(await screen.findByRole("option", { name: selectedYear }));
  fireEvent.click(screen.getByRole("button", { name: "Thêm hồ sơ mới" }));
  const dialog = within(screen.getByRole("dialog"));
  const yearField = dialog.getByRole("textbox", { name: "Năm nhập học" });
  expect(yearField).toHaveValue(selectedYear);
  expect(yearField).toHaveAttribute("readonly");
  expect(dialog.queryByRole("textbox", { name: "Năm vào trường" })).not.toBeInTheDocument();
  fireEvent.mouseDown(dialog.getByLabelText("Phân loại hồ sơ"));
  const categories = screen.getByRole("listbox");
  expect(within(categories).getAllByRole("option").map(option => option.textContent)).toEqual([
    "Bình thường", "Dự thính", "Sinh viên", "Cựu SV học trước", "Cựu SV Tiền thạc sỹ",
  ]);
  fireEvent.click(within(categories).getByRole("option", { name: "Dự thính" }));
  fireEvent.change(dialog.getByPlaceholderText("Nguyễn Văn"), { target: { value: "Trần Văn" } });
  fireEvent.change(dialog.getByPlaceholderText("An"), { target: { value: "Bình" } });
  fireEvent.click(dialog.getByRole("button", { name: "Chấp nhận (Enter)" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/plan/admission-records"),
    expect.objectContaining({ academicYear: selectedYear, fullName: "Trần Văn Bình", profileCategory: "Dự thính" }),
    { withCredentials: true },
  ));
});

it("does not mark missing documents as submitted when editing an admitted profile", async () => {
  axios.put.mockResolvedValue({ data: {} });
  mount("admitted-masters");
  fireEvent.click(await screen.findByRole("button", { name: "Sửa hồ sơ HV001" }));
  const dialog = within(screen.getByRole("dialog"));
  for (const name of ["Đơn xin dự thi", "Sơ yếu lý lịch", "Bằng tốt nghiệp", "Giấy khám sức khoẻ", "Ảnh hồ sơ", "Bảng điểm"]) {
    expect(dialog.getByRole("checkbox", { name })).not.toBeChecked();
  }
  fireEvent.click(dialog.getByRole("checkbox", { name: "Miễn thi ngoại ngữ" }));
  fireEvent.click(dialog.getByRole("button", { name: "Chấp nhận (Enter)" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
    expect.stringContaining("/plan/admission-records/record-1"),
    expect.objectContaining({
      isExemptForeignLanguage: true,
      documents: { docDecision: false, docApplication: false, docCurriculumVitae: false, docDegree: false,
        docHealthCert: false, docPhoto: false, docSupplement: false, docTranscript: false },
    }),
    { withCredentials: true },
  ));
});

it("does not open the profile when double clicking the tuition checkbox", async () => {
  mount("admitted-masters");
  fireEvent.doubleClick(await screen.findByLabelText("Chọn xác nhận học phí HV001"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axios from "axios";
import AdmissionRecords from "../../pages/plan/admissionRecords";

jest.mock("axios");
jest.mock("@mui/icons-material", () => ({
  AddPhotoAlternateRounded: () => null, AddRounded: () => null, CheckCircleRounded: () => null,
  CloseRounded: () => null, DeleteRounded: () => null, EditRounded: () => null,
  PersonRounded: () => null, VisibilityRounded: () => null, SearchRounded: () => null,
}));
jest.mock("../../components/FeatureLayout", () => ({ children }) => <div>{children}</div>);
jest.mock("react-toastify", () => ({ ToastContainer: () => null, toast: { success: jest.fn(), error: jest.fn() } }));

const record = {
  id: "record-1", code: "HV001", lastName: "Nguyễn Văn", firstName: "An", fullName: "Nguyễn Văn An",
  email: "an@example.test", gender: "Nam", majorId: "m1", trainingLevel: "Thạc sĩ", studyStatus: "Đã trúng tuyển",
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  axios.get.mockImplementation(async url => {
    if (url.includes("/auth/isStaff")) return { data: { message: "admin" } };
    if (url.includes("/system/majors")) return { data: [{ id: "m1", name: "Công nghệ thông tin", program: "masters" }] };
    if (url.includes("/admission-records?")) return { data: { data: [record], pagination: { total: 1, totalPages: 1 }, stats: { total: 1 } } };
    return { data: [] };
  });
});

const mount = mode => render(<MemoryRouter>
  <Routes>
    <Route path="/" element={<AdmissionRecords mode={mode} />} />
    <Route path="/plan/admission-records/:id" element={<p>Trang chi tiết học viên</p>} />
    <Route path="/masters/admitted-records/:id" element={<p>Trang chi tiết học viên</p>} />
  </Routes>
</MemoryRouter>);

describe.each(["applications", "admitted-masters"])("Student record interactions: %s", mode => {
  it.each(["HV001", "an@example.test", "Nam"])("opens the populated profile on double click of %s", async text => {
    mount(mode);
    const cell = await screen.findByText(text);
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
    fireEvent.click(await screen.findByRole("button", { name: "Sửa hồ sơ HV001" }));
    expect(within(screen.getByRole("dialog")).getByDisplayValue("HV001")).toBeInTheDocument();
  });
});

it("does not open the profile when double clicking the tuition checkbox", async () => {
  mount("admitted-masters");
  fireEvent.doubleClick(await screen.findByLabelText("Chọn xác nhận học phí HV001"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

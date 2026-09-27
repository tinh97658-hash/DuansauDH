import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AssignClassGroups from "../../pages/masters/assignClassGroups";

jest.mock("@mui/icons-material", () => ({
  ArrowForwardRounded: () => null,
  AutoAwesomeRounded: () => null,
  DeleteOutlineRounded: () => null,
  GroupWorkRounded: () => null,
  PersonRounded: () => null,
  RefreshRounded: () => null,
  SearchRounded: () => null,
}));
jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
  defaults: {},
}));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
  ToastContainer: () => null,
}));
jest.mock("../../components/FeatureLayout", () => function FeatureLayoutMock({ children }) {
  return children;
});

const group = {
  id: "group-1",
  code: "L01",
  name: "Lớp 01",
  majorId: "major-1",
  memberCount: 0,
  maxStudents: 40,
  members: [],
};
const unassigned = {
  id: "record-new",
  code: "HV001",
  fullName: "Học viên chưa có lớp",
  majorId: "major-1",
  majorName: "Công nghệ thông tin",
  assignedGroup: null,
};
const assigned = {
  id: "record-assigned",
  code: "HV002",
  fullName: "Học viên đã có lớp",
  majorId: "major-1",
  majorName: "Công nghệ thông tin",
  assignedGroup: { id: "group-2", code: "L02", name: "Lớp 02" },
};

describe("AssignClassGroups", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes("/system/majors")) return Promise.resolve({ data: [] });
      if (url.includes("/eligible-students")) return Promise.resolve({ data: [unassigned, assigned] });
      if (url.includes("/masters/class-groups?")) return Promise.resolve({ data: [group] });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    axios.post.mockResolvedValue({ data: { message: "Đã phân lớp" } });
  });

  it("only allows students without a class to be selected and submitted", async () => {
    await act(async () => {
      render(<MemoryRouter><AssignClassGroups /></MemoryRouter>);
    });

    const assignedCheckbox = await screen.findByRole("checkbox", { name: "Học viên đã có lớp đã được phân lớp" });
    expect(assignedCheckbox).toBeDisabled();

    // Keep the request pending: this test verifies the submitted payload, not the refresh cycle.
    axios.post.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Học viên chưa có lớp" }));
    fireEvent.click(screen.getByRole("button", { name: /Gán vào nhóm/ }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/masters/class-groups/group-1/members"),
      { admissionRecordIds: ["record-new"] },
      { withCredentials: true },
    ));
  });

  it("shows existing class members even when the eligible-student year filter returns no records", async () => {
    const historicalGroup = {
      ...group,
      code: "25ATM01",
      name: "ATM2025.01",
      academicYear: "2025",
      memberCount: 1,
      members: [{
        id: "member-2025",
        admissionRecord: {
          id: "record-from-another-year",
          code: "HV-LEGACY",
          fullName: "Nguyễn Văn Lịch Sử",
          dob: "1998-01-15",
          gender: "Nam",
        },
        student: null,
      }],
    };
    axios.get.mockImplementation((url) => {
      if (url.includes("/system/majors")) return Promise.resolve({ data: [] });
      if (url.includes("/eligible-students")) return Promise.resolve({ data: [] });
      if (url.includes("/masters/class-groups?")) return Promise.resolve({ data: [historicalGroup] });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/masters/assign-class-groups?year=2025"]}>
          <AssignClassGroups />
        </MemoryRouter>,
      );
    });

    expect(await screen.findByText("Sĩ số: 1 / 40 học viên")).toBeInTheDocument();
    expect(screen.getByText("Danh sách học viên trong nhóm (1):")).toBeInTheDocument();
    expect(screen.getAllByText("Nguyễn Văn Lịch Sử")).toHaveLength(2);
    expect(screen.getAllByText("HV-LEGACY")).toHaveLength(2);
  });
});

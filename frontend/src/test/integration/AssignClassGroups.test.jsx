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
  tuitionPaid: false,
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

  it("only shows students without a class and submits the selected student", async () => {
    await act(async () => {
      render(<MemoryRouter><AssignClassGroups /></MemoryRouter>);
    });

    expect(await screen.findByRole("checkbox", { name: "Chọn Học viên chưa có lớp" })).toBeInTheDocument();
    expect(screen.queryByText("Học viên đã có lớp")).not.toBeInTheDocument();
    expect(screen.getByText("Chưa nộp")).toBeInTheDocument();

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

  it("keeps existing class members only in the target-group panel", async () => {
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
          extraData: { tuitionPayment: { paid: true } },
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
    expect(screen.getByText("Không còn học viên chưa được phân nhóm.")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Lịch")).toBeInTheDocument();
    expect(screen.getByText("Sử")).toBeInTheDocument();
    expect(screen.getAllByText("HV-LEGACY")).toHaveLength(1);
    expect(screen.getByText("Đã nộp")).toBeInTheDocument();
  });

  it("does not allow selecting more students than the target group's remaining capacity", async () => {
    const oneSeatGroup = { ...group, maxStudents: 1, memberCount: 0 };
    const secondUnassigned = {
      ...unassigned,
      id: "record-second",
      code: "HV003",
      fullName: "Học viên thứ hai",
    };
    axios.get.mockImplementation((url) => {
      if (url.includes("/system/majors")) return Promise.resolve({ data: [] });
      if (url.includes("/eligible-students")) return Promise.resolve({ data: [unassigned, secondUnassigned] });
      if (url.includes("/masters/class-groups?")) return Promise.resolve({ data: [oneSeatGroup] });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    await act(async () => {
      render(<MemoryRouter><AssignClassGroups /></MemoryRouter>);
    });

    fireEvent.click(await screen.findByRole("checkbox", { name: "Chọn Học viên chưa có lớp" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Chọn Học viên thứ hai" })).toBeDisabled());
    expect(screen.getByText(/Đã chọn:/)).toHaveTextContent("Đã chọn: 1 / 1 chỗ còn lại");
  });
});

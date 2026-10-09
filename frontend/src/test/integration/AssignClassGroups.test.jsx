import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AssignClassGroups from "../../pages/masters/assignClassGroups";
import ResizableSplit from "../../components/ResizableSplit";
import fs from "fs";
import path from "path";

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
  studyStatus: "Đã trúng tuyển",
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
    expect(screen.getAllByText("Học phí nhập học")).toHaveLength(2);
    expect(screen.getByText("Chưa nộp")).toBeInTheDocument();
    expect(screen.getByText("Chưa phân nhóm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gán vào lớp/ })).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Lớp mục tiêu" }));
    fireEvent.click(await screen.findByRole("option", { name: /L01/ }));

    // Keep the request pending: this test verifies the submitted payload, not the refresh cycle.
    axios.post.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Học viên chưa có lớp" }));
    fireEvent.click(screen.getByRole("button", { name: /Gán vào lớp/ }));

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
          note: "Ghi chú hồ sơ cũ",
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
        <MemoryRouter initialEntries={["/masters/assign-class-groups?year=2025&groupId=group-1"]}>
          <AssignClassGroups />
        </MemoryRouter>,
      );
    });

    expect(await screen.findByText("Sĩ số: 1 / 40 học viên")).toBeInTheDocument();
    expect(screen.getByText("Danh sách học viên trong lớp (1):")).toBeInTheDocument();
    expect(screen.getByText("Không còn học viên chưa có lớp.")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Lịch")).toBeInTheDocument();
    expect(screen.getByText("Sử")).toBeInTheDocument();
    expect(screen.getAllByText("HV-LEGACY")).toHaveLength(1);
    expect(screen.queryByText("Ghi chú hồ sơ cũ")).not.toBeInTheDocument();
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
      render(<MemoryRouter initialEntries={["/?groupId=group-1"]}><AssignClassGroups /></MemoryRouter>);
    });

    fireEvent.click(await screen.findByRole("checkbox", { name: "Chọn Học viên chưa có lớp" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Chọn Học viên thứ hai" })).toBeDisabled());
    expect(screen.getByText(/Đã chọn:/)).toHaveTextContent("Đã chọn: 1 / 1 chỗ còn lại");
  });

  it("keeps the overview and only the Major column in every filter scope", async () => {
    const majors = [
      { id: "major-1", name: "Chuyên ngành Một", disciplineId: "d1", discipline: { id: "d1", name: "Ngành Một" } },
      { id: "major-2", name: "Chuyên ngành Hai", disciplineId: "d2", discipline: { id: "d2", name: "Ngành Hai" } },
    ];
    const candidates = [
      { ...unassigned, fullName: "Nguyễn Văn An", dob: "1999-01-02", gender: "Nam", note: "Ghi chú tuyển sinh", tuitionPaid: true },
      { ...unassigned, id: "other-major", code: "HV-OTHER", majorId: "major-2", fullName: "Trần Thị Bình" },
      { ...unassigned, id: "paused", code: "HV-PAUSED", studyStatus: "Bảo lưu" },
      { ...unassigned, id: "admitted", code: "HV-ADMITTED", studyStatus: "Đã trúng tuyển" },
      { ...unassigned, id: "approved", code: "HV-APPROVED", status: "approved", studyStatus: "Nộp hồ sơ đầu vào" },
    ];
    axios.get.mockImplementation(async (url) => ({ data: url.includes("/system/majors") ? majors
      : url.includes("/eligible-students") ? candidates.filter((candidate) => !url.includes("majorId=") || url.includes(`majorId=${candidate.majorId}`))
        : [group] }));
    render(<MemoryRouter><AssignClassGroups /></MemoryRouter>);
    const table = await screen.findByRole("table", { name: "Học viên chưa phân lớp" });
    await screen.findByText("HV-OTHER");
    expect(screen.getByRole("button", { name: "Lớp mục tiêu" })).toHaveTextContent("Chọn lớp mục tiêu");
    const headers = () => within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    // The revised table always shows Major and never Discipline, including ALL/ALL.
    expect(headers()).toEqual(["", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", "Chuyên ngành", "Học phí nhập học", "Nhóm hiện tại"]);
    expect(within(table).getByText("Nguyễn Văn").closest("td")).toHaveTextContent(/^Nguyễn Văn$/);
    expect(within(table).getByText("1999-01-02")).toBeInTheDocument();
    expect(within(table).getByText("Nam")).toBeInTheDocument();
    expect(within(table).queryByText("Ghi chú tuyển sinh")).not.toBeInTheDocument();
    expect(within(table).getByText("Đã nộp")).toBeInTheDocument();
    expect(within(table).getAllByText("Chưa nộp")).toHaveLength(3);
    expect(screen.queryByText("HV-PAUSED")).not.toBeInTheDocument();
    expect(screen.getByText("HV-ADMITTED")).toBeInTheDocument();
    expect(screen.getByText("HV-APPROVED")).toBeInTheDocument();
    expect(screen.queryByText("Mã HV / SBD")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Ngành", exact: true }));
    fireEvent.click(await screen.findByRole("option", { name: "Ngành Một" }));
    await waitFor(() => expect(screen.queryByText("HV-OTHER")).not.toBeInTheDocument());
    expect(headers()).toEqual(["", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", "Chuyên ngành", "Học phí nhập học", "Nhóm hiện tại"]);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Chuyên ngành", exact: true }));
    fireEvent.click(await screen.findByRole("option", { name: "Chuyên ngành Một" }));
    expect(headers()).toEqual(["", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", "Chuyên ngành", "Học phí nhập học", "Nhóm hiện tại"]);
  });

  it("narrows candidates only after choosing a target and reads tuition status from the admission record", async () => {
    const target = { ...group, members: [{ id: "member", note: "Sai nguồn ghi chú", admissionRecord: {
      id: "member-record", code: "MEMBER", fullName: "Lê Văn Cường", dob: "1998-02-03", note: "Ghi chú hồ sơ thành viên",
    } }] };
    axios.get.mockImplementation(async (url) => ({ data: url.includes("/system/majors") ? []
      : url.includes("/eligible-students") ? [unassigned, { ...unassigned, id: "other", code: "HV-OTHER", majorId: "major-2" }]
        : [target] }));
    render(<MemoryRouter><AssignClassGroups /></MemoryRouter>);
    await screen.findByText("HV-OTHER");
    expect(screen.queryByText("MEMBER")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Lớp mục tiêu" }));
    fireEvent.click(await screen.findByRole("option", { name: /L01/ }));
    await screen.findByText("MEMBER");
    expect(screen.queryByText("HV-OTHER")).not.toBeInTheDocument();
    expect(screen.queryByText("Ghi chú hồ sơ thành viên")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Học viên trong lớp" })).getByText("Chưa nộp")).toBeInTheDocument();
    expect(screen.queryByText("Sai nguồn ghi chú")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ Lê Văn Cường khỏi lớp" })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Học viên trong lớp" })).getAllByRole("columnheader").map((cell) => cell.textContent))
      .toEqual(["STT", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Học phí nhập học", "Bỏ"]);
  });

  it("bounds long student codes and keeps the remove action sticky on the rendered member table", async () => {
    const longCode = "LOCAL-CNTT26-007-EXTRA-LONG-SEED";
    const target = { ...group, members: [{ id: "member", admissionRecord: {
      id: "member-record", code: longCode, fullName: "Nguyễn Văn Thành", note: "Ghi chú hồ sơ",
    } }] };
    axios.get.mockImplementation(async (url) => ({ data: url.includes("/system/majors") ? []
      : url.includes("/eligible-students") ? [{ ...unassigned, code: longCode }] : [target] }));
    render(<MemoryRouter initialEntries={["/?groupId=group-1"]}><AssignClassGroups /></MemoryRouter>);
    await screen.findByRole("button", { name: "Bỏ Nguyễn Văn Thành khỏi lớp" });
    for (const name of ["Học viên chưa phân lớp", "Học viên trong lớp"]) {
      const table = screen.getByRole("table", { name });
      expect(table).toHaveClass("assignment-table");
      expect(within(table).getByText(longCode)).toHaveAttribute("title", longCode);
      expect(within(table).getByText(longCode)).toHaveClass("assignment-code");
      expect(table.querySelector("col.assignment-code-col")).toBeInTheDocument();
      expect(table.querySelector("col.assignment-family-col")).toBeInTheDocument();
    }
    const memberTable = screen.getByRole("table", { name: "Học viên trong lớp" });
    expect(within(memberTable).getByRole("columnheader", { name: "Bỏ" })).toHaveClass("assignment-action");
    expect(within(memberTable).getByRole("button", { name: "Bỏ Nguyễn Văn Thành khỏi lớp" }).closest("td")).toHaveClass("assignment-action");
    // jsdom does not lay out tables; check the scoped rules here and measure pixels in the browser check.
    const css = fs.readFileSync(path.join(process.cwd(), "src/pages/masters/assignClassGroups.css"), "utf8");
    const codeWidth = css.match(/\.assignment-table \.assignment-code-col\{width:(\d+)px/);
    const familyWidth = css.match(/\.assignment-table \.assignment-family-col\{width:(\d+)px/);
    expect(Number(codeWidth[1])).toBeLessThan(Number(familyWidth[1]));
    expect(css).toMatch(/\.assignment-members \.assignment-action\{[^}]*position:sticky;right:0;/);
    expect(css).toMatch(/\.assignment-table \.assignment-code\{[^}]*white-space:nowrap;text-overflow:ellipsis/);
  });

  it("resizes the split by pointer and keyboard while preserving both panel minimums", () => {
    const originalPointerEvent = window.PointerEvent;
    window.PointerEvent = MouseEvent;
    try {
      const { container } = render(<ResizableSplit left={<div>Trái</div>} right={<div>Phải</div>} />);
      const split = container.querySelector(".resizable-split");
      split.getBoundingClientRect = () => ({ width: 1000, left: 0 });
      const divider = screen.getByRole("separator");
      divider.setPointerCapture = jest.fn(); divider.releasePointerCapture = jest.fn();
      fireEvent.pointerDown(divider, { button: 0, clientX: 650 });
      expect(divider).toHaveAttribute("aria-valuenow", "65");
      fireEvent.pointerMove(divider, { clientX: 999 });
      expect(divider).toHaveAttribute("aria-valuenow", "70");
      fireEvent.pointerMove(divider, { clientX: 0 });
      expect(divider).toHaveAttribute("aria-valuenow", "30");
      fireEvent.pointerUp(divider);
      expect(split).not.toHaveClass("is-dragging");
      fireEvent.keyDown(divider, { key: "ArrowRight" });
      expect(divider).toHaveAttribute("aria-valuenow", "32");
    } finally { window.PointerEvent = originalPointerEvent; }
  });
});

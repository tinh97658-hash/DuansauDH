import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import CourseOfferings from "../../pages/masters/courseOfferings";
import CourseMatrixPage from "../../pages/masters/courseMatrix";

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
const major = { id: "major", name: "Khai thác hàng hải", code: "KTHH", active: true };
const group = { id: "group", code: "KTHH-2026", name: "Nhóm 1", majorId: "major", academicYear: "2026", allowedWeekdays: [1, 3, 5], memberCount: 2 };
const subject = { id: "subject", code: "HP01", name: "Khai thác cảng" };
const participant = { id: "student:one", code: "HV001", fullName: "Nguyễn An", note: "Ghi chú nhóm không được tự điền" };
const mocks = (user = { role: "admin" }) => {
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/session") ? { user } : url.includes("/system/majors") ? [major] : url.includes("/masters/class-groups") ? [group] : url.includes("/course-offering-candidates") ? { subjects: [{ subject, eligibleClassGroups: [group] }] } : url.includes("/retakes?") ? [] : [] }));
  axios.post.mockImplementation(async (url) => ({ data: url.endsWith("/roster-preview") ? { participants: [participant], participantCount: 1 } : { id: "offering", subject, participantCount: 1 } }));
};
const reach = async () => {
  fireEvent.focus(await screen.findByRole("combobox", { name: "Chọn chuyên ngành" }));
  fireEvent.click(await screen.findByRole("option", { name: /Khai thác hàng hải/ }));
  await screen.findByRole("option", { name: "2026" });
  fireEvent.change(screen.getByRole("combobox", { name: "Khóa / Năm học" }), { target: { value: "2026" } });
  fireEvent.click(await screen.findByRole("button", { name: /HP01.*Khai thác cảng/ }));
};
beforeEach(() => jest.clearAllMocks());
it("labels only institute-level KC subjects as common", async () => {
  const crossMajorSubject = { ...subject, subjectType: "CN", allowCrossMajor: true };
  const commonSubject = { id: "common-subject", code: "HP02", name: "Học phần chung cấp Viện", subjectType: "KC", allowCrossMajor: true };
  axios.get.mockImplementation(async (url) => ({ data:
    url.endsWith("/auth/session") ? { user: { role: "admin" } }
      : url.includes("/system/majors") ? [major]
        : url.includes("/masters/class-groups") ? [group]
          : url.includes("/course-offering-candidates") ? { subjects: [
            { subject: crossMajorSubject, eligibleClassGroups: [group] },
            { subject: commonSubject, eligibleClassGroups: [group] },
          ] }
            : [],
  }));
  axios.post.mockResolvedValue({ data: { participants: [], participantCount: 0 } });

  render(<MemoryRouter><CourseOfferings /></MemoryRouter>);
  await reach();

  expect(within(screen.getByRole("button", { name: /HP01/ })).queryByText("Môn chung")).not.toBeInTheDocument();
  expect(within(screen.getByRole("button", { name: /HP02/ })).getByText("Môn chung")).toBeInTheDocument();
});
it("shows each group's own major and submits mixed-major groups outside the working scope", async () => {
  mocks();
  const maritime = { id: "maritime", name: "Khoa học hàng hải", active: true };
  const computing = { id: "computing", name: "Công nghệ thông tin", active: true };
  const maritimeGroup = { ...group, id: "maritime-group", code: "KTH2026.01", name: "Lớp hàng hải", majorId: maritime.id, major: maritime };
  // The catalog fallback must use this group's majorId, never the working scope.
  const computingGroup = { ...group, id: "computing-group", code: "CNT2026.02", name: "Lớp CNTT", majorId: computing.id };
  axios.get.mockImplementation(async (url) => ({ data:
    url.endsWith("/auth/session") ? { user: { role: "admin" } }
      : url.includes("/system/majors") ? [major, maritime, computing]
        : url.includes("/masters/class-groups") ? [group]
          : url.includes("/course-offering-candidates") ? { subjects: [{ subject, eligibleClassGroups: [group, maritimeGroup, computingGroup] }] }
            : [],
  }));
  render(<MemoryRouter><CourseOfferings /></MemoryRouter>);
  await reach();
  const maritimeButton = screen.getByRole("button", { name: /KTH2026.01 · Lớp hàng hải/ });
  const computingButton = screen.getByRole("button", { name: /CNT2026.02 · Lớp CNTT/ });
  expect(within(maritimeButton).getByText(maritime.name)).toBeInTheDocument();
  expect(within(computingButton).getByText(computing.name)).toBeInTheDocument();
  expect(within(computingButton).queryByText(major.name)).not.toBeInTheDocument();
  fireEvent.click(maritimeButton);
  fireEvent.click(computingButton);
  const next = screen.getByRole("button", { name: "Tạo lớp học phần" });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);
  const dialog = screen.getByRole("dialog", { name: "Xem trước danh sách lớp" });
  expect(within(dialog).getByText(`${maritime.name} · ${computing.name}`)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận tạo lớp" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/course-offerings$/), expect.objectContaining({
    subjectId: subject.id, classGroupIds: [maritimeGroup.id, computingGroup.id], majorId: major.id,
    academicYear: "2026", participantNotes: [],
  }), { withCredentials: true }));
  expect(await screen.findByRole("button", { name: "Sang Xếp lịch" })).toBeInTheDocument();
  expect(screen.getByText(`${maritime.name} · ${computing.name} · Năm 2026`)).toBeInTheDocument();
});
it("creates a real API draft with blank editable notes and opens scheduling after save", async () => {
  mocks(); render(<MemoryRouter><CourseOfferings /></MemoryRouter>);
  await reach();
  fireEvent.click(screen.getByRole("button", { name: /KTHH-2026 · Nhóm 1/ }));
  const create = screen.getByRole("button", { name: "Tạo lớp học phần" });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  const dialog = await screen.findByRole("dialog", { name: "Xem trước danh sách lớp" });
  const note = within(dialog).getByRole("textbox", { name: "Ghi chú HV001" });
  expect(note).toHaveValue("");
  fireEvent.change(note, { target: { value: "Miễn TA" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận tạo lớp" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/course-offerings$/), expect.objectContaining({ subjectId: "subject", classGroupIds: ["group"], majorId: "major", academicYear: "2026", participantNotes: [{ participantId: "student:one", note: "Miễn TA" }] }), { withCredentials: true }));
  expect(await screen.findByRole("button", { name: "Sang Xếp lịch" })).toBeInTheDocument();
});
it("uses session permissions and never exposes the demo role switch", async () => {
  mocks({ role: "supervisor", canManageScheduling: false });
  render(<MemoryRouter><CourseOfferings /></MemoryRouter>); await reach();
  expect(screen.getByRole("button", { name: /KTHH-2026 · Nhóm 1/ })).toBeDisabled();
  expect(screen.queryByRole("combobox", { name: "Vai trò" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tạo lớp học phần" })).toBeDisabled();
});
it("blocks creation when the authoritative roster fails", async () => {
  mocks(); axios.post.mockRejectedValue({ response: { data: { message: "Danh sách đã thay đổi" } } });
  render(<MemoryRouter><CourseOfferings /></MemoryRouter>); await reach();
  fireEvent.click(screen.getByRole("button", { name: /KTHH-2026 · Nhóm 1/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Danh sách đã thay đổi");
  expect(screen.getByRole("button", { name: "Tạo lớp học phần" })).toBeDisabled();
});

it("allows selecting and merging groups from different cohorts into the course offering", async () => {
  mocks();
  const group2024 = {
    id: "group-2024",
    code: "KTHH-2024",
    name: "Nhóm 1 Khóa 30",
    majorId: "major",
    academicYear: "2024",
    allowedWeekdays: [1, 3, 5],
    memberCount: 5,
  };
  axios.get.mockImplementation(async (url) => ({
    data: url.endsWith("/auth/session") ? { user: { role: "admin" } }
      : url.includes("/system/majors") ? [major]
      : url.includes("/masters/class-groups") ? [group]
      : url.includes("/course-offering-candidates") ? { subjects: [{ subject, eligibleClassGroups: [group, group2024] }] }
      : [],
  }));
  render(<MemoryRouter><CourseOfferings /></MemoryRouter>);
  await reach();

  expect(screen.getByText(/1 nhóm khóa khác/)).toBeInTheDocument();

  const button2024 = screen.getByRole("button", { name: /KTHH-2024/ });
  expect(within(button2024).getByText("Khóa 2024")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /KTHH-2026/ }));
  fireEvent.click(button2024);

  const next = screen.getByRole("button", { name: "Tạo lớp học phần" });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);

  const dialog = screen.getByRole("dialog", { name: "Xem trước danh sách lớp" });
  expect(within(dialog).getByText(/Nhóm 1 · 2026/)).toBeInTheDocument();
  expect(within(dialog).getByText(/Nhóm 1 Khóa 30 · 2024/)).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận tạo lớp" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringMatching(/course-offerings$/),
    expect.objectContaining({
      subjectId: subject.id,
      classGroupIds: [group.id, group2024.id],
      academicYear: "2026",
    }),
    { withCredentials: true }
  ));
});

it("suggests offering name dynamically and supports custom edit and reset", async () => {
  mocks();
  render(<MemoryRouter><CourseOfferings /></MemoryRouter>);
  await reach();

  const nameInput = screen.getByRole("textbox", { name: "Tên lớp học phần" });
  expect(nameInput).toHaveValue("Lớp Khai thác cảng - 2026");

  fireEvent.click(screen.getByRole("button", { name: /KTHH-2026 · Nhóm 1/ }));
  expect(nameInput).toHaveValue("Lớp Khai thác cảng - KTHH-2026");

  fireEvent.change(nameInput, { target: { value: "Lớp Khai thác cảng Chuyên sâu K32" } });
  expect(nameInput).toHaveValue("Lớp Khai thác cảng Chuyên sâu K32");

  const resetBtn = screen.getByRole("button", { name: /Dùng tên gợi ý tự động/ });
  expect(resetBtn).toBeInTheDocument();
  fireEvent.click(resetBtn);
  expect(nameInput).toHaveValue("Lớp Khai thác cảng - KTHH-2026");

  const next = screen.getByRole("button", { name: "Tạo lớp học phần" });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);

  const dialog = screen.getByRole("dialog", { name: "Xem trước danh sách lớp" });
  expect(within(dialog).getByText("Lớp Khai thác cảng - KTHH-2026")).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận tạo lớp" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringMatching(/course-offerings$/),
    expect.objectContaining({
      name: "Lớp Khai thác cảng - KTHH-2026",
    }),
    { withCredentials: true }
  ));
});

it("renders course matrix across cohorts, displays KPIs and switches between views", async () => {
  const mockOfferings = [
    {
      id: "offering-2026",
      name: "Lớp Khai thác cảng - 2026",
      subject,
      subjectId: subject.id,
      status: "active",
      participantCount: 15,
      groupLinks: [{ classGroupId: "g1", classGroup: { id: "g1", academicYear: "2026", name: "Nhóm 1", majorId: "major" } }],
      sessionSummary: { totalCount: 4, heldCount: 2, futurePlannedCount: 2 },
    },
    {
      id: "offering-2024",
      name: "Lớp Khai thác cảng - 2024",
      subject,
      subjectId: subject.id,
      status: "active",
      participantCount: 10,
      groupLinks: [{ classGroupId: "g2", classGroup: { id: "g2", academicYear: "2024", name: "Nhóm 2", majorId: "major" } }],
      sessionSummary: { totalCount: 0, heldCount: 0, futurePlannedCount: 0 },
    },
  ];
  axios.get.mockImplementation(async (url) => ({
    data: url.endsWith("/auth/session") ? { user: { role: "admin", canManageScheduling: true } }
      : url.includes("/system/majors") ? [major]
      : url.includes("/scheduling/course-offerings") ? mockOfferings
      : []
  }));

  render(<MemoryRouter initialEntries={["/masters/course-matrix"]}><CourseMatrixPage /></MemoryRouter>);

  expect(await screen.findByText("TỔNG SỐ LỚP HỌC PHẦN")).toBeInTheDocument();
  expect(screen.queryByText("MA TRẬN LỚP HỌC PHẦN THEO KHÓA")).not.toBeInTheDocument();
  expect(screen.getByText("CHƯA XẾP LỊCH")).toBeInTheDocument();

  // Check cohort columns exist
  expect(await screen.findByRole("region", { name: "Khóa 2026" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Khóa 2024" })).toBeInTheDocument();

  // Check offering cards exist
  expect(screen.getByText("Lớp Khai thác cảng - 2026")).toBeInTheDocument();
  expect(screen.getByText("Lớp Khai thác cảng - 2024")).toBeInTheDocument();

  // Check pivot table view switch
  fireEvent.click(screen.getByRole("button", { name: /Bảng ma trận môn/ }));
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "KHÓA 2026" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "KHÓA 2024" })).toBeInTheDocument();
});

it("displays combined student count in Box 2, shows all roster students, removes single class name and removes footer count text", async () => {
  mocks();
  const p1 = { id: "student:1", code: "HV001", fullName: "Nguyễn Văn A" };
  const p2 = { id: "student:2", code: "HV002", fullName: "Trần Thị B" };
  axios.post.mockImplementation(async (url) => ({
    data: url.endsWith("/roster-preview")
      ? { participants: [p1, p2], participantCount: 2 }
      : { id: "offering", subject, participantCount: 2 },
  }));

  render(<MemoryRouter><CourseOfferings /></MemoryRouter>);
  await reach();

  // Before selecting groups, Box 2 shows hint and 0 học viên
  expect(screen.getByText("HỌC VIÊN THAM GIA")).toBeInTheDocument();
  expect(screen.getByText("0 học viên")).toBeInTheDocument();
  expect(screen.getByText(/Chưa chọn lớp \/ nhóm nào/)).toBeInTheDocument();

  // Select group
  fireEvent.click(screen.getByRole("button", { name: /KTHH-2026 · Nhóm 1/ }));

  // Box 2 now displays total students count and both participants
  const box2 = document.querySelector(".sl-create-students");
  await waitFor(() => {
    expect(within(box2).getByText("2 học viên")).toBeInTheDocument();
    expect(within(box2).getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(within(box2).getByText("Trần Thị B")).toBeInTheDocument();
  });

  // Ensure single class name is NOT shown in Box 2
  expect(screen.queryByText(/THS-K32-N02/)).not.toBeInTheDocument();
  expect(document.querySelector(".sl-create-active-group")).toBeNull();

  // Ensure footer count text like "1 lớp / nhóm đã chọn" is NOT in the document
  expect(screen.queryByText(/lớp \/ nhóm đã chọn/)).not.toBeInTheDocument();

  // Ensure footer action buttons exist
  expect(screen.getByRole("button", { name: "Làm lại" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tạo lớp học phần" })).toBeInTheDocument();
});


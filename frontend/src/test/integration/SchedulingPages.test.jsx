const accessFixture = vi.hoisted(() => ({ permissions: ["scheduling.organize"] }));
vi.mock("../../features/accounts/usePermissions", () => ({ usePermissions: () => ({ can: permission => accessFixture.permissions.includes(permission) }) }));
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import CourseOfferings from "../../pages/masters/courseOfferings";
import CourseMatrixPage from "../../pages/masters/courseMatrix";

jest.mock("axios");
jest.mock("@mui/icons-material", () => ({
  CalendarMonthRounded: require("@mui/icons-material/CalendarMonthRounded").default,
  GridViewRounded: require("@mui/icons-material/GridViewRounded").default,
  LayersRounded: require("@mui/icons-material/LayersRounded").default,
  PendingActionsRounded: require("@mui/icons-material/PendingActionsRounded").default,
  SearchRounded: require("@mui/icons-material/SearchRounded").default,
  TableChartRounded: require("@mui/icons-material/TableChartRounded").default,
  ViewColumnRounded: require("@mui/icons-material/ViewColumnRounded").default,
}));
jest.mock("../../components/FeatureLayout", () => function Layout({ children }) { return <div>{children}</div>; });
const major = { id: "major", name: "Khai thác hàng hải", code: "KTHH", active: true };
const group = { id: "group", code: "KTHH-2026", name: "Nhóm 1", majorId: "major", academicYear: "2026", allowedWeekdays: [1, 3, 5], memberCount: 2 };
const subject = { id: "subject", code: "HP01", name: "Khai thác cảng" };
const participant = { id: "student:one", code: "HV001", fullName: "Nguyễn An", note: "Ghi chú nhóm không được tự điền" };
const mocks = (user = { role: "admin" }, permissions = ["scheduling.organize"]) => {
  accessFixture.permissions = permissions;
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/session") ? { user } : url.includes("/system/majors") ? [major] : url.includes("/scheduling/class-groups/options") ? [group] : url.includes("/course-offering-candidates") ? { subjects: [{ subject, eligibleClassGroups: [group] }] } : url.includes("/retakes?") ? [] : [] }));
  axios.post.mockImplementation(async (url) => ({ data: url.endsWith("/roster-preview") ? { participants: [participant], participantCount: 1 } : { id: "offering", subject, participantCount: 1 } }));
};
const reach = async () => {
  fireEvent.focus(await screen.findByRole("combobox", { name: "Chọn chuyên ngành" }));
  fireEvent.click(await screen.findByRole("option", { name: /Khai thác hàng hải/ }));
  await screen.findByRole("option", { name: "2026" });
  fireEvent.change(screen.getByRole("combobox", { name: "Khóa / Năm học" }), { target: { value: "2026" } });
  fireEvent.click(await screen.findByRole("button", { name: /HP01.*Khai thác cảng/ }));
};
beforeEach(() => { accessFixture.permissions = ["scheduling.organize"]; jest.clearAllMocks(); sessionStorage.clear(); });

it('disables a visible group outside the backend organization capability', async () => {
  mocks();
  const originalGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async url => url.includes('/course-offering-candidates')
    ? { data: { subjects: [{ subject, eligibleClassGroups: [{ ...group, canOrganize: false }] }] } }
    : originalGet(url));
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
  await reach();
  expect(screen.getByRole('button', { name: /KTHH-2026.*Nhóm 1/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Tạo lớp học phần' })).toBeDisabled();
  expect(axios.post).not.toHaveBeenCalled();
});

it.each(['major', 'another-major'])("omits internships from suggested courses and counts for %s", async majorId => {
  mocks();
  const scopedMajor = { ...major, id: majorId };
  const scopedGroup = { ...group, majorId };
  const courses = [subject,
    { id: 'practice-type', code: 'TT01', subjectType: 'TT', name: 'Thực hành tại cơ sở' },
    { id: 'practice-name', code: 'TT02', subjectType: 'CN', name: 'Thực tập chuyên ngành' },
    { id: 'practice-legacy', code: 'TT03', name: '  THỰC  TẬP TỐT NGHIỆP  ' },
  ];
  const originalGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async url => url.includes('/system/majors') ? { data: [scopedMajor] }
    : url.includes('/scheduling/class-groups/options') ? { data: [scopedGroup] }
      : url.includes('/course-offering-candidates') ? { data: { subjects: courses.map(course => ({ subject: course, eligibleClassGroups: [scopedGroup] })) } }
        : originalGet(url));
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
  fireEvent.focus(await screen.findByRole('combobox', { name: 'Chọn chuyên ngành' }));
  fireEvent.click(await screen.findByRole('option', { name: /Khai thác hàng hải/ }));
  await screen.findByRole('option', { name: '2026' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Khóa / Năm học' }), { target: { value: '2026' } });
  expect(await screen.findByText('1 học phần hiện có thể tổ chức.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /HP01.*Khai thác cảng/ })).toBeInTheDocument();
  for (const code of ['TT01', 'TT02', 'TT03']) expect(screen.queryByRole('button', { name: new RegExp(code) })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Tìm học phần' }), { target: { value: 'Thực tập' } });
  expect(screen.getByText('Không có học phần khớp từ khóa.')).toBeInTheDocument();
});

it("does not restore an internship selection or preview its roster from a saved draft", async () => {
  mocks();
  const practice = { ...subject, id: 'practice', code: 'TTTN', name: 'Thực tập chuyên ngành', subjectType: 'TT' };
  sessionStorage.setItem('scheduling:create-offering:current', JSON.stringify({
    majorId: major.id, year: '2026', subjectId: practice.id, groupIds: [group.id], offeringName: 'Lớp thực tập đang soạn',
  }));
  const originalGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async url => url.includes('/course-offering-candidates')
    ? { data: { subjects: [{ subject: practice, eligibleClassGroups: [group] }, { subject, eligibleClassGroups: [group] }] } }
    : originalGet(url));
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
  expect(await screen.findByText('1 học phần hiện có thể tổ chức.')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Tên lớp học phần' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /TTTN/ })).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

it("keeps the confirmation and entered note mounted when the tab becomes visible and rechecks the session", async () => {
  mocks();
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
  await reach();
  fireEvent.click(screen.getByRole("button", { name: /KTHH-2026.*Nhóm 1/ }));
  const next = screen.getByRole("button", { name: "Tạo lớp học phần" });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);
  const note = screen.getByRole("textbox", { name: "Ghi chú HV001" });
  fireEvent.change(note, { target: { value: "Giữ nguyên khi chụp màn hình" } });
  const originalGet = axios.get.getMockImplementation();
  let resolveSession;
  axios.get.mockImplementation(url => url.endsWith("/auth/session")
    ? new Promise(resolve => { resolveSession = resolve; }) : originalGet(url));
  const visibility = jest.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  try {
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(resolveSession).toBeDefined());
    expect(screen.getByRole("dialog", { name: "Xem trước danh sách lớp" })).toBeInTheDocument();
    expect(note).toHaveValue("Giữ nguyên khi chụp màn hình");
    await act(async () => resolveSession({ data: { user: { role: "admin" } } }));
    expect(screen.getByRole("textbox", { name: "Ghi chú HV001" })).toBe(note);
  } finally {
    visibility.mockRestore();
  }
});

it("restores the scope, course, class and custom name after leaving and reopening the page", async () => {
  mocks();
  const first = render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
  await reach();
  fireEvent.click(screen.getByRole("button", { name: /KTHH-2026.*Nhóm 1/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Tên lớp học phần" }), { target: { value: "Lớp đang soạn" } });
  await screen.findByText("HV001");
  first.unmount();
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
  await screen.findByText("HV001");
  expect(screen.getByRole("combobox", { name: "Khóa / Năm học" })).toHaveValue("2026");
  expect(screen.getByRole("textbox", { name: "Tên lớp học phần" })).toHaveValue("Lớp đang soạn");
  expect(screen.getByRole("button", { name: /KTHH-2026.*Nhóm 1/ })).toHaveAttribute("aria-pressed", "true");
});
it("selects a retake group as one class, previews only its failed learner and submits the group scope", async () => {
  mocks();
  const retake = { ...group, id: "retake-class", code: "CKTM2026.01", name: "CKTM2026.01 – Học lại", isRetake: true, memberCount: 1 };
  const originalGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async url => url.includes("/course-offering-candidates")
    ? { data: { subjects: [{ subject, eligibleClassGroups: [group], retakeClassGroups: [retake] }] } } : originalGet(url));
  const failed = { id: "admission:failed", code: "HV-FAILED", fullName: "Phan Hải Yến" };
  axios.post.mockImplementation(async url => ({ data: url.endsWith("/roster-preview")
    ? { participants: [failed], participantCount: 1 } : { id: "retake-offering", participantCount: 1 } }));
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
  await reach();
  fireEvent.click(screen.getByRole("button", { name: /CKTM2026.01/ }));
  await screen.findByText("HV-FAILED");
  const next = screen.getByRole("button", { name: "Tạo lớp học phần" });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);
  const dialog = screen.getByRole("dialog", { name: "Xem trước danh sách lớp" });
  expect(within(dialog).getByText("Yến")).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: /Xác nhận tạo lớp/ }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/scheduling\/course-offerings$/),
    expect.objectContaining({ classGroupIds: [retake.id], retakeClassGroupIds: [retake.id] }), expect.anything()));
});

it("shows a short class title with retake and newcomer counts", async () => {
  mocks();
  const mixed = { ...group, code: "CKTM2026.1.1", name: "CKTM2026.1.1", isRetake: true, memberCount: 2, retakeCount: 1, unstudiedCount: 1 };
  const originalGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(url => url.includes("/course-offering-candidates")
    ? Promise.resolve({ data: { subjects: [{ subject, eligibleClassGroups: [], retakeClassGroups: [mixed] }] } }) : originalGet(url));
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
  await reach();
  const card = screen.getByRole("button", { name: /CKTM2026.1.1/ });
  expect(within(card).getByText("CKTM2026.1.1")).toBeInTheDocument();
  expect(within(card).getByText("1 học lại")).toBeInTheDocument();
  expect(within(card).getByText("1 chưa học")).toBeInTheDocument();
  expect(within(card).getByText("2 học viên")).toBeInTheDocument();
  expect(within(card).queryByText(/Không đạt|Cần bố trí/)).not.toBeInTheDocument();
});
it("labels only KC knowledge-block subjects as common", async () => {
  const crossMajorSubject = { ...subject, subjectType: "CN", allowCrossMajor: true };
  const commonSubject = { id: "common-subject", code: "HP02", name: "Học phần kiến thức chung", subjectType: "KC", allowCrossMajor: true };
  axios.get.mockImplementation(async (url) => ({ data:
    url.endsWith("/auth/session") ? { user: { role: "admin" } }
      : url.includes("/system/majors") ? [major]
        : url.includes("/scheduling/class-groups/options") ? [group]
          : url.includes("/course-offering-candidates") ? { subjects: [
            { subject: crossMajorSubject, eligibleClassGroups: [group] },
            { subject: commonSubject, eligibleClassGroups: [group] },
          ] }
            : [],
  }));
  axios.post.mockResolvedValue({ data: { participants: [], participantCount: 0 } });

  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
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
        : url.includes("/scheduling/class-groups/options") ? [group]
          : url.includes("/course-offering-candidates") ? { subjects: [{ subject, eligibleClassGroups: [group, maritimeGroup, computingGroup] }] }
            : [],
  }));
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
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
  expect(within(dialog).getByText(maritime.name)).toBeInTheDocument();
  expect(within(dialog).getByText(computing.name)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận tạo lớp" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/course-offerings$/), expect.objectContaining({
    subjectId: subject.id, classGroupIds: [maritimeGroup.id, computingGroup.id], majorId: major.id,
    academicYear: "2026", participantNotes: [],
  }), { withCredentials: true }));
  expect(await screen.findByRole("button", { name: "Sang Xếp lịch" })).toBeInTheDocument();
  expect(screen.getByText(`${maritime.name} · ${computing.name} · Năm 2026`)).toBeInTheDocument();
});
it("creates a real API draft with blank editable notes and opens scheduling after save", async () => {
  mocks(); render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
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
it("prefills and saves the exam exemption note supplied by the roster preview", async () => {
  mocks();
  const exempt = { ...participant, profileForeignLanguageExempt: true, note: "Miễn thi" };
  const ordinary = { id: "admission:two", code: "HV002", fullName: "Trần Bình", note: "" };
  axios.post.mockImplementation(async url => ({ data: url.endsWith("/roster-preview")
    ? { participants: [exempt, ordinary], participantCount: 2 } : { id: "offering", subject, participantCount: 2 } }));
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
  await reach();
  fireEvent.click(screen.getByRole("button", { name: /KTHH-2026 · Nhóm 1/ }));
  const create = screen.getByRole("button", { name: "Tạo lớp học phần" });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  const dialog = within(await screen.findByRole("dialog", { name: "Xem trước danh sách lớp" }));
  expect(dialog.getByRole("textbox", { name: "Ghi chú HV001" })).toHaveValue("Miễn thi");
  expect(dialog.getByRole("textbox", { name: "Ghi chú HV002" })).toHaveValue("");
  fireEvent.click(dialog.getByRole("button", { name: "Xác nhận tạo lớp" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/course-offerings$/),
    expect.objectContaining({ participantNotes: [{ participantId: participant.id, note: "Miễn thi" }] }),
    { withCredentials: true }));
});

it("uses session permissions and never exposes the demo role switch", async () => {
  mocks({ role: "supervisor", canManageScheduling: true }, []);
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>); await reach();
  expect(screen.getByRole("button", { name: /KTHH-2026 · Nhóm 1/ })).toBeDisabled();
  expect(screen.queryByRole("combobox", { name: "Vai trò" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tạo lớp học phần" })).toBeDisabled();
});
it("blocks creation when the authoritative roster fails", async () => {
  mocks(); axios.post.mockRejectedValue({ response: { data: { message: "Danh sách đã thay đổi" } } });
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>); await reach();
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
      : url.includes("/scheduling/class-groups/options") ? [group]
      : url.includes("/course-offering-candidates") ? { subjects: [{ subject, eligibleClassGroups: [group, group2024] }] }
      : [],
  }));
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
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
  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
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

  render(<MemoryRouter useTransitions={false} initialEntries={["/masters/course-matrix"]}><CourseMatrixPage /></MemoryRouter>);

  expect(await screen.findByText("Tổng số lớp học phần")).toBeInTheDocument();
  expect(screen.queryByText("MA TRẬN LỚP HỌC PHẦN THEO KHÓA")).not.toBeInTheDocument();
  expect(screen.getByText("Chưa xếp lịch", { selector: ".sl-matrix-kpi span" })).toBeInTheDocument();

  // Check cohort columns exist
  expect(await screen.findByRole("region", { name: "Khóa 2026" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Khóa 2024" })).toBeInTheDocument();

  // Check offering cards exist
  expect(screen.getByText("Lớp Khai thác cảng - 2026")).toBeInTheDocument();
  expect(screen.getByText("Lớp Khai thác cảng - 2024")).toBeInTheDocument();

  // The whole card opens details; no separate visible "Xem chi tiết" button is needed.
  const offeringCard = screen.getByText("Lớp Khai thác cảng - 2026").closest(".sl-matrix-card");
  expect(within(offeringCard).queryByText("Xem chi tiết")).not.toBeInTheDocument();
  fireEvent.click(within(offeringCard).getByRole("button", { name: /Xem chi tiết.*2026/ }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));

  // Selecting one cohort lays its ordered offerings out in four columns.
  fireEvent.change(screen.getByLabelText("Khóa / năm học"), { target: { value: "2026" } });
  expect(document.querySelector(".sl-matrix-col-cards")).toHaveClass("sl-matrix-col-cards-four");
  fireEvent.change(screen.getByLabelText("Khóa / năm học"), { target: { value: "" } });

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

  render(<MemoryRouter useTransitions={false}><CourseOfferings /></MemoryRouter>);
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


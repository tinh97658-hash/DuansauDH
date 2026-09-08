import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import CreateClassFromStudentsDialog from "../../components/CreateClassFromStudentsDialog";
import ClassRosterDialog from "../../components/ClassRosterDialog";
import CourseOfferingSessions from "../../components/scheduling/CourseOfferingSessions";
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), defaults: {}, interceptors: { request: { use: jest.fn() } } }));
beforeEach(() => jest.resetAllMocks());
const group = { id: "root", name: "Nhóm HP", code: "ROOT" };

it("creates the selected roster with its user supplied name without a semester", async () => {
  axios.post.mockResolvedValue({ data: { id: "child", name: "Lớp mới" } });
  const created = jest.fn();
  render(<CreateClassFromStudentsDialog open groups={[group]} selectedIds={["student-a", "student-b"]} initialGroupId="root" onClose={() => {}} onCreated={created} />);
  expect(screen.queryByLabelText(/Học kỳ/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tạo" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Mã lớp"), { target: { value: "NEW" } });
  fireEvent.change(screen.getByLabelText("Tên Lớp HP"), { target: { value: "Lớp mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo" }));
  await waitFor(() => expect(created).toHaveBeenCalledWith({ id: "child", name: "Lớp mới" }));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/class-groups/from-students"), {
    parentGroupId: "root", code: "NEW", name: "Lớp mới", admissionRecordIds: ["student-a", "student-b"],
  });
});
it("keeps a failed creation open and displays the backend error", async () => {
  axios.post.mockRejectedValue({ response: { data: { message: "Học viên khác ngành" } } });
  const created = jest.fn();
  render(<CreateClassFromStudentsDialog open groups={[group]} selectedIds={["a"]} initialGroupId="root" onCreated={created} />);
  fireEvent.change(screen.getByLabelText("Mã lớp"), { target: { value: "NEW" } });
  fireEvent.change(screen.getByLabelText("Tên Lớp HP"), { target: { value: "Lớp mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo" }));
  expect(await screen.findByText("Học viên khác ngành")).toBeInTheDocument();
  expect(created).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Tên Lớp HP")).toHaveValue("Lớp mới");
});
it("uses the existing student code/name, saves class-specific notes and renames via backend", async () => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/auth/session") ? { user: { canManageScheduling: true } } : {
    id: "child", parentGroupId: "root", name: "Lớp cũ", members: [{ id: "member", note: "Cũ", student: { regNo: "HV123", fullName: "Học viên gốc" }, admissionRecord: { code: "SBD", fullName: "Tên hồ sơ" } }],
  } }));
  axios.put.mockResolvedValue({ data: {} });
  render(<ClassRosterDialog classId="child" onClose={() => {}} />);
  expect(await screen.findByText("HV123")).toBeInTheDocument();
  expect(screen.getByText("Học viên gốc")).toBeInTheDocument();
  expect(screen.queryByText("SBD")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tên lớp"), { target: { value: "Lớp đổi tên" } });
  fireEvent.click(screen.getByRole("button", { name: "Đổi tên" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/child/name"), { name: "Lớp đổi tên" }));
  await waitFor(() => expect(screen.getByLabelText("Ghi chú học viên 1")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Ghi chú học viên 1"), { target: { value: "Ghi chú lớp" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/child/member-notes/member"), { note: "Ghi chú lớp" }));
});
it("lists only scheduled sessions across weeks without generating a fixed session count", async () => {
  const offering = { id: "offering", name: "Lớp học phần", plannedUnits: 10 };
  const rows = [
    { id: "legacy-draft", isScheduled: false },
    { id: "first", sessionDate: "2999-09-12", period: "MORNING" },
    { id: "next-week", sessionDate: "2999-09-20", period: "AFTERNOON" },
  ];
  axios.get.mockResolvedValue({ data: rows });
  const select = jest.fn();
  render(<CourseOfferingSessions offering={offering} onSchedule={select} />);
  const actions = await screen.findAllByRole("button", { name: "Xem lịch" });
  expect(actions).toHaveLength(2);
  fireEvent.click(actions[1]);
  expect(select).toHaveBeenCalledWith(rows[2]);
  expect(screen.queryByRole("button", { name: "Phân buổi" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Số tiết/)).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});
it("shows an invalid sessions response as an error and does not expose generation to readers", async () => {
  axios.get.mockResolvedValue({ data: {} });
  render(<CourseOfferingSessions offering={{ id: "plan", status: "active" }} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được các buổi học.");
  expect(screen.queryByRole("button", { name: "Phân buổi" })).not.toBeInTheDocument();
});

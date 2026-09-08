import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import CourseOfferings from "../../pages/masters/courseOfferings";

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
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/course-offerings$/), { subjectId: "subject", classGroupIds: ["group"], majorId: "major", academicYear: "2026", participantNotes: [{ participantId: "student:one", note: "Miễn TA" }] }, { withCredentials: true }));
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

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AssignClassGroups from "../../pages/masters/assignClassGroups";
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), defaults: {}, interceptors: { request: { use: jest.fn() } } }));
jest.mock("../../components/FeatureLayout", () => ({ children }) => <main>{children}</main>);
jest.mock("../../components/CreateClassFromStudentsDialog", () => () => null);
jest.mock("../../components/ClassRosterDialog", () => () => null);
jest.mock("react-toastify", () => ({ ToastContainer: () => null, toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
const groups = ["A", "B"].map((code) => ({ id: code, code, name: "Nhóm " + code, majorId: "major", academicYear: "2026", maxStudents: 40 }));
let students;
beforeEach(() => {
  jest.clearAllMocks();
  students = [{ id: "hv1", code: "HV1", fullName: "Học viên Một", majorId: "major", assignedGroup: groups[0] },
    { id: "hv2", code: "HV2", fullName: "Học viên Hai", majorId: "major", assignedGroup: null }];
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/auth/session")) return { data: { user: { canManageScheduling: true } } };
    if (url.includes("/system/majors")) return { data: [{ id: "major", name: "Ngành" }] };
    if (url.includes("/eligible-students")) return { data: students.map(s => ({ ...s })) };
    return { data: groups };
  });
  axios.post.mockImplementation(async (_url, body) => {
    students = students.map(s => body.admissionRecordIds.includes(s.id) ? { ...s, assignedGroup: groups[1] } : s);
    return { data: { success: true } };
  });
});
const mount = () => render(<MemoryRouter initialEntries={["/masters/assign-class-groups?majorId=major&year=2026&groupId=B"]}><AssignClassGroups /></MemoryRouter>);
it("shows assigned records, blocks their checkbox and row, and assigns only unassigned learners", async () => {
  mount();
  const assigned = await screen.findByRole("checkbox", { name: "Chọn học viên HV1" });
  expect(assigned).toBeDisabled();
  expect(within(assigned.closest("tr")).getByText("A")).toBeInTheDocument();
  fireEvent.click(assigned.closest("tr"));
  expect(screen.getByRole("button", { name: "Gán vào nhóm" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả học viên chưa phân nhóm" }));
  expect(assigned).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Chọn học viên HV2" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Gán vào nhóm" }));
  await waitFor(() => expect(screen.getByRole("checkbox", { name: "Chọn học viên HV2" })).toBeDisabled());
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/B/members"), { admissionRecordIds: ["hv2"] }, expect.anything());
  expect(screen.getByRole("button", { name: "Gán vào nhóm" })).toBeDisabled();
});
it("keeps status filters meaningful and clears selection when its record is filtered out", async () => {
  mount(); await screen.findByRole("checkbox", { name: "Chọn học viên HV2" });
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn học viên HV2" }));
  fireEvent.click(screen.getByRole("button", { name: "Đã phân nhóm" }));
  expect(screen.queryByRole("checkbox", { name: "Chọn học viên HV2" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Gán vào nhóm" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Chưa phân nhóm" }));
  expect(screen.getByRole("checkbox", { name: "Chọn học viên HV2" })).not.toBeChecked();
  expect(screen.queryByRole("checkbox", { name: "Chọn học viên HV1" })).not.toBeInTheDocument();
});

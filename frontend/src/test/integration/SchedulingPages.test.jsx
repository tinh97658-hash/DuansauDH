import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import axios from "axios";
import CourseOfferings from "../../pages/masters/courseOfferings";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), defaults: {}, interceptors: { request: { use: jest.fn() } } }));
jest.mock("../../components/FeatureLayout", () => ({ children }) => <main>{children}</main>);

const major = { id: "major", code: "CNTT", name: "Công nghệ thông tin", active: true };
const subject = { id: "subject", code: "CSDL", name: "Cơ sở dữ liệu nâng cao", credits: 3 };
const group = (id, canMerge = true) => ({ id, code: id, name: "Lớp " + id.toUpperCase(), majorId: major.id, major, academicYear: "2026", memberCount: 2, canMerge });
const learner = (id) => ({ identity: "student:" + id, studentId: id, admissionRecordId: "admission-" + id, regNo: "HV00" + id, fullName: "Học viên " + id, note: null });
const sourceRosters = { a: [learner("1"), learner("2")], b: [learner("2"), learner("3")], c: [learner("4")] };
let manager, sourceGroups, savedOffering;
beforeEach(() => {
  jest.clearAllMocks(); manager = true; sourceGroups = [group("a"), group("b"), group("c", false)]; savedOffering = null;
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/auth/session")) return { data: { user: { canManageScheduling: manager } } };
    if (url.includes("/plan/training-plan")) return { data: [major] };
    if (url.endsWith("/masters/class-groups")) return { data: sourceGroups };
    if (url.includes("course-offering-candidates")) return { data: { subjects: [{ subject, eligibleClassGroups: sourceGroups }] } };
    if (url.endsWith("/course-offerings/offering")) return { data: { ...savedOffering, participants: savedOffering.participants.map((row) => ({ ...row })) } };
    throw Error("Unexpected GET " + url);
  });
  axios.post.mockImplementation(async (url, body) => {
    const uniqueParticipants = [...new Map(body.classGroupIds.flatMap((id) => sourceRosters[id]).map((row) => [row.identity, { ...row }])).values()];
    if (url.endsWith("/participant-preview")) return { data: { participantCount: uniqueParticipants.length, classGroupCount: body.classGroupIds.length, participants: uniqueParticipants } };
    if (url.endsWith("/course-offerings")) {
      savedOffering = {
        id: "offering", name: body.name, subject, subjectId: subject.id,
        groupLinks: body.classGroupIds.map((id) => ({ classGroup: sourceGroups.find((row) => row.id === id) })),
        participants: uniqueParticipants.map((row) => ({ ...row, id: "member-" + row.studentId, note: body.participantNotes.find((note) => note.studentId === row.studentId)?.note || "" })),
        participantCount: uniqueParticipants.length,
      };
      return { data: savedOffering };
    }
    throw Error("Unexpected POST " + url);
  });
  axios.put.mockImplementation(async (url, body) => {
    if (url.endsWith("/name")) savedOffering.name = body.name;
    else {
      const participant = savedOffering.participants.find((row) => url.endsWith("/participants/" + row.id + "/note"));
      if (!participant) throw Error("Unknown participant");
      participant.note = body.note;
    }
    return { data: savedOffering };
  });
});

function Probe() { return <div data-testid="schedule-location">{useLocation().search}</div>; }
function mount(path = "/masters/course-offerings") {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/masters/course-offerings" element={<CourseOfferings />} />
    <Route path="/masters/schedule" element={<Probe />} />
  </Routes></MemoryRouter>);
}
async function select(label, option) {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name: option }));
}
async function chooseSubject() {
  await waitFor(() => expect(screen.getByLabelText("Chuyên ngành")).not.toHaveAttribute("aria-disabled", "true"));
  await select("Chuyên ngành", "CNTT · Công nghệ thông tin");
  await select("Khóa / Năm học", "2026");
  fireEvent.click(await screen.findByRole("button", { name: /Cơ sở dữ liệu nâng cao/ }));
  await screen.findByRole("checkbox", { name: "Chọn Lớp A" });
}
async function selectSources(ids = ["a", "b"]) {
  for (const id of ids) fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Lớp " + id.toUpperCase() }));
  await waitFor(() => expect(screen.getByRole("button", { name: "TIẾP TỤC" })).toBeEnabled());
}
async function confirmStep() {
  fireEvent.change(screen.getByLabelText(/Tên lớp học phần/), { target: { value: "Lớp CNTT bổ sung" } });
  await selectSources();
  fireEvent.click(screen.getByRole("button", { name: "TIẾP TỤC" }));
  await screen.findByText("Kiểm tra thông tin trước khi tạo");
}
const createCalls = () => axios.post.mock.calls.filter(([url]) => url.endsWith("/course-offerings"));

it("keeps viewing independent from selected sources and counts each learner once", async () => {
  mount(); await chooseSubject();
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Lớp A" }));
  fireEvent.click(screen.getByRole("button", { name: "Xem Lớp B" }));
  const roster = screen.getByTestId("source-roster");
  expect(await within(roster).findByText("HV003")).toBeInTheDocument();
  expect(within(roster).queryByText("HV001")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Chọn Lớp A" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Chọn Lớp B" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Lớp B" }));
  expect(await screen.findByText("3 HỌC VIÊN")).toBeInTheDocument();
  expect(screen.getByText("2 LỚP / NHÓM ĐÃ CHỌN")).toBeInTheDocument();
  expect(createCalls()).toHaveLength(0);
  expect(axios.get.mock.calls.find(([url]) => url.includes("course-offering-candidates"))[0]).toContain("majorId=major&academicYear=2026");
  expect(screen.queryByText(/Học kỳ/)).not.toBeInTheDocument();
});

it("preserves the form and notes when going back, then creates only on final confirmation", async () => {
  mount(); await chooseSubject(); await confirmStep();
  const roster = screen.getByTestId("course-offering-roster");
  expect(within(roster).getAllByRole("columnheader").map((node) => node.textContent)).toEqual(["STT", "Mã học viên", "Họ và tên học viên", "Ghi chú"]);
  expect(within(roster).getByText("01")).toBeInTheDocument();
  expect(within(roster).getAllByRole("row")).toHaveLength(4);
  fireEvent.change(screen.getByLabelText("Ghi chú HV002"), { target: { value: "Học viên học bổ sung" } });
  fireEvent.click(screen.getByRole("button", { name: /QUAY LẠI CHỈNH SỬA/ }));
  expect(screen.getByLabelText(/Tên lớp học phần/)).toHaveValue("Lớp CNTT bổ sung");
  expect(screen.getByRole("checkbox", { name: "Chọn Lớp A" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Chọn Lớp B" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "TIẾP TỤC" }));
  expect(screen.getByLabelText("Ghi chú HV002")).toHaveValue("Học viên học bổ sung");
  expect(createCalls()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "XÁC NHẬN TẠO LỚP HỌC PHẦN" }));
  expect(await screen.findByText("ĐÃ TẠO LỚP HỌC PHẦN")).toBeInTheDocument();
  expect(createCalls()).toHaveLength(1);
  expect(createCalls()[0][1]).toEqual({
    name: "Lớp CNTT bổ sung", subjectId: "subject", classGroupIds: ["a", "b"],
    participantNotes: [1, 2, 3].map((id) => ({ studentId: String(id), admissionRecordId: "admission-" + id, note: id === 2 ? "Học viên học bổ sung" : "" })),
  });
  fireEvent.click(screen.getByRole("button", { name: /SANG XẾP LỊCH/ }));
  expect(await screen.findByTestId("schedule-location")).toHaveTextContent("?offeringId=offering");
});

it("loads a created class by URL and persists renaming and participant notes", async () => {
  const view = mount(); await chooseSubject(); await confirmStep();
  fireEvent.click(screen.getByRole("button", { name: "XÁC NHẬN TẠO LỚP HỌC PHẦN" }));
  await screen.findByText("ĐÃ TẠO LỚP HỌC PHẦN");
  fireEvent.click(screen.getByText("Xem danh sách học viên / Đổi tên lớp"));
  fireEvent.change(screen.getByLabelText("Tên lớp học phần"), { target: { value: "Lớp CNTT đổi tên" } });
  fireEvent.click(screen.getByRole("button", { name: "Đổi tên" }));
  await screen.findByText("Đã lưu tên lớp học phần.");
  fireEvent.change(screen.getByLabelText("Ghi chú HV001"), { target: { value: "Ghi chú trong lớp HP" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
  await screen.findByText("Đã lưu ghi chú học viên.");
  view.unmount(); mount("/masters/course-offerings?offeringId=offering");
  await screen.findByText("ĐÃ TẠO LỚP HỌC PHẦN");
  fireEvent.click(screen.getByText("Xem danh sách học viên / Đổi tên lớp"));
  expect(await screen.findByDisplayValue("Lớp CNTT đổi tên")).toBeInTheDocument();
  expect(screen.getByLabelText("Ghi chú HV001")).toHaveValue("Ghi chú trong lớp HP");
  expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/offering/participants/member-1/note"), { note: "Ghi chú trong lớp HP" });
});

it("allows a nonmergeable source on its own while preventing multiple incompatible sources", async () => {
  mount(); await chooseSubject();
  expect(screen.getByRole("checkbox", { name: "Chọn Lớp C" })).toBeEnabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Lớp C" }));
  expect(screen.getByRole("checkbox", { name: "Chọn Lớp A" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Chọn Lớp B" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Tên lớp học phần/), { target: { value: "Lớp xếp riêng" } });
  await screen.findByText("1 HỌC VIÊN");
  fireEvent.click(screen.getByRole("button", { name: "TIẾP TỤC" }));
  fireEvent.click(screen.getByRole("button", { name: "XÁC NHẬN TẠO LỚP HỌC PHẦN" }));
  await screen.findByText("ĐÃ TẠO LỚP HỌC PHẦN");
  expect(createCalls()[0][1].classGroupIds).toEqual(["c"]);
  expect(screen.getByRole("button", { name: /SANG XẾP LỊCH/ })).toBeEnabled();
});

it("validates required scope and resets the form without creating or deleting data", async () => {
  mount();
  await waitFor(() => expect(screen.getByRole("button", { name: "TIẾP TỤC" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "TIẾP TỤC" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Chọn chuyên ngành");
  await chooseSubject();
  fireEvent.change(screen.getByLabelText(/Tên lớp học phần/), { target: { value: "Tên chưa lưu" } });
  await selectSources(["a"]);
  fireEvent.click(screen.getByRole("button", { name: "LÀM LẠI" }));
  expect(screen.getByLabelText(/Tên lớp học phần/)).toHaveValue("");
  expect(screen.getByText("0 LỚP / NHÓM ĐÃ CHỌN")).toBeInTheDocument();
  expect(createCalls()).toHaveLength(0);
  expect(axios.put).not.toHaveBeenCalled();
});

it("disables creation and editing when the session lacks scheduling permission", async () => {
  manager = false; mount(); await chooseSubject();
  expect(screen.getByLabelText(/Tên lớp học phần/)).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Chọn Lớp A" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "TIẾP TỤC" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Xem Lớp B" }));
  expect(await within(screen.getByTestId("source-roster")).findByText("HV003")).toBeInTheDocument();
  expect(createCalls()).toHaveLength(0);
});

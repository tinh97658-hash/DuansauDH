import { renderWithPermissions } from "../renderWithPermissions";
import { vi } from "vitest";
import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import axios from "axios";
import CreateClassGroups from "../../pages/masters/createClassGroups";

const render = (ui, options) => renderWithPermissions(ui, ["masters.manage"], options);

jest.mock("axios");
jest.mock("../../components/FeatureLayout", () => ({ children }) => <div>{children}</div>);
vi.mock(import("@mui/icons-material"), () => ({
  AddRounded: () => null, DeleteRounded: () => null, EditRounded: () => null,
  GroupWorkRounded: () => null, SearchRounded: () => null,
}));

const year = String(new Date().getFullYear());
const major = { id: "major-1", code: "CNTT", name: "Công nghệ thông tin" };
const curriculum = { id: "curriculum-1", code: `CT-CNTT-${year}`, name: "CTĐT CNTT", applicableFromYear: year, active: true };
const mockRequests = () => {
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/auth/isStaff")) return { data: { message: "admin" } };
    if (url.includes("/plan/curriculums")) return { data: [curriculum] };
    if (url.includes("/masters/class-groups")) return { data: [] };
    return { data: [] };
  });
  axios.post.mockResolvedValue({ data: { success: true } });
};

const renderPage = () => render(
  <MemoryRouter>
    <CreateClassGroups />
  </MemoryRouter>,
);

const openCreateDialog = async () => {
  renderPage();
  const add = await screen.findByRole("button", { name: "Thêm nhóm mới" });
  await waitFor(() => expect(add).toBeEnabled());
  fireEvent.click(add);
  return screen.getByRole("dialog");
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequests();
});

test("does not expose automatic student assignment while creating groups", async () => {
  await openCreateDialog();
  expect(screen.queryByRole("checkbox", { name: /Phân học viên tự động/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cân bằng sĩ số" })).not.toBeInTheDocument();
});

const ReturnLocation = () => {
  const location = useLocation();
  return <output data-testid="returned-url">{location.pathname}{location.search}</output>;
};

test.each([true, false])("quick-create prefills scope and returns to assignment (created ID: %s)", async (withId) => {
  const scopedMajor = { ...major, disciplineId: "d1", discipline: { id: "d1", name: "Ngành CNTT" } };
  const defaultGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async (url) => url.includes("/system/majors")
    ? { data: [scopedMajor] } : defaultGet(url));
  axios.post.mockResolvedValue({ data: withId ? { groups: [{
    id: "new-group", majorId: major.id, academicYear: year, status: "open",
  }] } : { success: true } });
  render(<MemoryRouter initialEntries={[`/masters/create-class-groups?quickCreate=1&program=masters&year=${year}&disciplineId=d1&majorId=${major.id}&returnTo=https://example.com`]}>
    <Routes>
      <Route path="/masters/create-class-groups" element={<CreateClassGroups />} />
      <Route path="/masters/assign-class-groups" element={<ReturnLocation />} />
    </Routes>
  </MemoryRouter>);
  expect(await screen.findByRole("dialog")).toHaveTextContent("Ngành CNTT");
  const create = screen.getByRole("button", { name: "Tạo 1 nhóm" });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  expect(await screen.findByTestId("returned-url")).toHaveTextContent(
    `/masters/assign-class-groups?year=${year}&disciplineId=d1&majorId=${major.id}${withId ? "&groupId=new-group" : ""}`,
  );
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/masters/class-groups/batch"),
    expect.objectContaining({ majorId: major.id, academicYear: year, maxStudents: 20, count: 1 }),
    { withCredentials: true });
});

test("changing group count refreshes names and keeps a create-only action", async () => {
  await openCreateDialog();
  fireEvent.change(screen.getByLabelText("Số nhóm cần tạo"), { target: { value: "3" } });

  expect(await screen.findByText(`CNTT ${year}.1.1`)).toBeInTheDocument();
  expect(screen.getByText(`CNTT ${year}.1.2`)).toBeInTheDocument();
  expect(screen.getByText(`CNTT ${year}.1.3`)).toBeInTheDocument();

  await waitFor(() => expect(screen.getByRole("button", { name: "Tạo 3 nhóm" })).toBeEnabled());
});

test("creates empty group shells without automatic assignment fields", async () => {
  await openCreateDialog();
  expect(screen.getByLabelText("Sĩ số tối đa / nhóm")).toHaveValue(20);
  fireEvent.change(screen.getByLabelText("Sĩ số tối đa / nhóm"), { target: { value: "25" } });
  fireEvent.change(screen.getByLabelText("Số nhóm cần tạo"), { target: { value: "3" } });
  const createButton = await screen.findByRole("button", { name: "Tạo 3 nhóm" });
  await waitFor(() => expect(createButton).toBeEnabled());
  fireEvent.click(createButton);

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/batch"),
    expect.not.objectContaining({ autoAssign: expect.anything() }),
    { withCredentials: true },
  ));
  expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/batch"),
    expect.objectContaining({ maxStudents: 25, count: 3 }),
    { withCredentials: true },
  );
});

test("starts at group 1 independently of other majors", async () => {
  const defaultGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/masters/class-groups")) {
      return { data: [{
        id: "other-group",
        code: `NH${year.slice(-2)}01`,
        name: `QLTC${year}.01`,
        majorId: "other-major",
        academicYear: year,
        status: "closed",
      }] };
    }
    return defaultGet(url);
  });

  await openCreateDialog();
  const createButton = screen.getByRole("button", { name: "Tạo 1 nhóm" });
  await waitFor(() => expect(createButton).toBeEnabled());
  expect(screen.getByText(`CNTT ${year}.1.1`)).toBeInTheDocument();
  fireEvent.click(createButton);

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/batch"),
    expect.objectContaining({ intakeRound: 1, nameIndexes: [1] }),
    { withCredentials: true },
  ));
});

test("changing intake round starts numbering within the selected round", async () => {
  const defaultGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/masters/class-groups")) return { data: [
      { code: `CNTT ${year}.1.1`, majorId: major.id, academicYear: year, intakeRound: 1 },
    ] };
    return defaultGet(url);
  });
  await openCreateDialog();
  fireEvent.change(screen.getByLabelText("Đợt"), { target: { value: "2" } });
  expect(await screen.findByText(`CNTT ${year}.2.1`)).toBeInTheDocument();
  const createButton = screen.getByRole("button", { name: "Tạo 1 nhóm" });
  await waitFor(() => expect(createButton).toBeEnabled());
  fireEvent.click(createButton);
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/batch"),
    expect.objectContaining({ intakeRound: 2, nameIndexes: [1] }),
    { withCredentials: true },
  ));
});

test("allows overriding the generated template and submits the previewed codes", async () => {
  await openCreateDialog();
  const templateInput = screen.getByLabelText("Quy tắc mã nhóm");
  expect(templateInput).toHaveValue(`CNTT ${year}.1.{n}`);
  fireEvent.change(templateInput, { target: { value: "LOP-CNTT-{n}" } });
  fireEvent.change(screen.getByLabelText("Số nhóm cần tạo"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Đợt"), { target: { value: "2" } });
  expect(templateInput).toHaveValue("LOP-CNTT-{n}");
  expect(screen.getByText("LOP-CNTT-1")).toBeInTheDocument();
  expect(screen.getByText("LOP-CNTT-2")).toBeInTheDocument();
  const createButton = screen.getByRole("button", { name: "Tạo 2 nhóm" });
  await waitFor(() => expect(createButton).toBeEnabled());
  fireEvent.click(createButton);
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/batch"),
    expect.objectContaining({ nameTemplate: "LOP-CNTT-{n}", nameIndexes: [1, 2], intakeRound: 2 }),
    { withCredentials: true },
  ));
});

test("requires the numbering token in a manually edited template", async () => {
  await openCreateDialog();
  fireEvent.change(screen.getByLabelText("Quy tắc mã nhóm"), { target: { value: "LOP-CNTT" } });
  expect(screen.getByText(/phải chứa đúng một ký hiệu/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tạo 1 nhóm" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Quy tắc mã nhóm"), { target: { value: "" } });
  expect(screen.getByLabelText("Quy tắc mã nhóm")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Tạo 1 nhóm" })).toBeDisabled();
});

test("previews and creates missing 01 then 04 when 02 and 03 already exist", async () => {
  const defaultGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/masters/class-groups")) return { data: [
      { code: `NH${year.slice(-2)}01`, name: `QLTC${year}.01`, majorId: "other-major", academicYear: year },
      ...[2, 3].map((number) => ({
        code: `CNTT ${year}.1.${number}`, name: `CNTT ${year}.1.${number}`, majorId: major.id, academicYear: year,
      })),
    ] };
    return defaultGet(url);
  });
  await openCreateDialog();
  fireEvent.change(screen.getByLabelText("Số nhóm cần tạo"), { target: { value: "2" } });
  const createButton = screen.getByRole("button", { name: "Tạo 2 nhóm" });
  await waitFor(() => expect(createButton).toBeEnabled());
  expect(screen.getByText(`CNTT ${year}.1.1`)).toBeInTheDocument();
  expect(screen.getByText(`CNTT ${year}.1.4`)).toBeInTheDocument();
  fireEvent.click(createButton);
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/batch"),
    expect.objectContaining({ nameIndexes: [1, 4], intakeRound: 1, count: 2 }),
    { withCredentials: true },
  ));
});

test("opens edit dialog with Image 2 compact layout and updates class group", async () => {
  const existingGroup = {
    id: "group-1",
    code: `CNTT ${year}.1.1`,
    name: `Lớp Thạc sĩ CNTT Khóa ${year} - Lớp 01`,
    majorId: "major-1",
    curriculumId: "curriculum-1",
    academicYear: year,
    maxStudents: 40,
    status: "open",
    note: "Ghi chú ban đầu",
    memberCount: 0,
    major,
    curriculum,
  };
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/auth/isStaff")) return { data: { message: "admin" } };
    if (url.includes("/plan/curriculums")) return { data: [curriculum] };
    if (url.includes("/masters/class-groups")) return { data: [existingGroup] };
    return { data: [] };
  });
  axios.put = jest.fn().mockResolvedValue({ data: { success: true } });

  renderPage();
  const editButton = await screen.findByRole("button", { name: "Chỉnh sửa" });
  fireEvent.click(editButton);

  expect(await screen.findByText("CHỈNH SỬA NHÓM HỌC VIÊN")).toBeInTheDocument();
  expect(screen.getByLabelText("Mã nhóm")).toHaveValue(`CNTT ${year}.1.1`);
  expect(screen.queryByLabelText("Tên nhóm học viên")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Sĩ số tối đa / nhóm")).toHaveValue(40);

  fireEvent.change(screen.getByLabelText("Mã nhóm"), { target: { value: `CNTT ${year}.2.1` } });
  const saveButton = screen.getByRole("button", { name: "Lưu nhóm" });
  fireEvent.click(saveButton);

  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
    expect.stringContaining("/masters/class-groups/group-1"),
    expect.objectContaining({
      code: `CNTT ${year}.2.1`,
      name: `CNTT ${year}.2.1`,
      maxStudents: 40,
    }),
    { withCredentials: true },
  ));
});


test("changes an assigned specialist only in the group editor and saves with the group", async () => {
  const group = { id: "group-1", code: `CNTT ${year}.1.1`, majorId: major.id, curriculumId: curriculum.id,
    academicYear: year, status: "open", major, curriculum, responsibleStaffId: "staff-1", responsibleStaff: { name: "Chuyên viên A" } };
  axios.get.mockImplementation(async url => {
    if (url.includes("/system/majors")) return { data: [major] };
    if (url.includes("/plan/curriculums")) return { data: [curriculum] };
    if (url.includes("/masters/class-groups")) return { data: [group] };
    if (url.includes("/groups/assignees")) return { data: [
      { id: "staff-1", name: "Chuyên viên A", email: "a@example.com" },
      { id: "staff-2", name: "Chuyên viên B", email: "b@example.com" },
    ] };
    return { data: [] };
  });
  axios.put = jest.fn().mockResolvedValue({ data: {} });
  renderWithPermissions(<MemoryRouter><CreateClassGroups /></MemoryRouter>, ["masters.manage", "groups.assign"]);
  await screen.findByText("Chuyên viên A");
  expect(screen.queryByRole("button", { name: "Đổi chuyên viên" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Phân công", exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
  const select = await screen.findByRole("button", { name: /Chuyên viên phụ trách/ });
  await waitFor(() => expect(select).toBeEnabled());
  fireEvent.mouseDown(select);
  fireEvent.click(await screen.findByRole("option", { name: "Chuyên viên B — b@example.com" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu nhóm" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/masters/class-groups/group-1"),
    expect.objectContaining({ responsibleStaffId: "staff-2" }), { withCredentials: true }));
});

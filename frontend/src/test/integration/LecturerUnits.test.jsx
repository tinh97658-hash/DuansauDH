import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import Lecturers from "../../pages/system/lecturers";
import { lecturerGroupsForOffering, lecturerUnitOf, recommendedUnitForOffering } from "../../utils/lecturerQualification";
import { alphabeticalOptionGroups } from "../../utils/optionGroups";

jest.mock("axios", () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn(), defaults: {} }));
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../components/FeatureLayout", () => ({ children }) => <div>{children}</div>);

const units = [{ id: "unit-1", name: "Đơn vị từ API", active: true }, { id: "inactive", name: "Đơn vị ngừng dùng", active: false }];
const legacy = { id: "gv", code: "GV01", name: "Nguyễn An", faculty: "Tên đơn vị cũ", phone: "123", active: true, disciplineId: null,
  academicRank: "Phó Giáo sư", academicDegree: "Tiến sĩ", teachingType: "Thỉnh giảng" };
let rows;
beforeEach(() => {
  jest.clearAllMocks(); rows = [];
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" }
    : url.endsWith("/disciplines") ? units : rows }));
  axios.post.mockResolvedValue({ data: {} }); axios.put.mockResolvedValue({ data: {} });
});

it("loads units from the catalog and creates with an ID, never free text or a required major", async () => {
  render(<Lecturers />);
  fireEvent.click(await screen.findByRole("button", { name: "Thêm mới" }));
  const dialog = screen.getByRole("dialog");
  const unitSelect = within(dialog).getByRole("button", { name: "Đơn vị" });
  fireEvent.change(within(dialog).getByLabelText("Mã giảng viên"), { target: { value: "GV02" } });
  fireEvent.change(within(dialog).getByLabelText("Họ và tên"), { target: { value: "Trần Bình" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.mouseDown(unitSelect);
  fireEvent.click(await screen.findByRole("option", { name: "Đơn vị từ API" }));
  expect(screen.queryByRole("option", { name: "Đơn vị ngừng dùng" })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  const body = axios.post.mock.calls[0][1];
  expect(body).toMatchObject({ code: "GV02", name: "Trần Bình", disciplineId: "unit-1" });
  expect(body).not.toHaveProperty("faculty"); expect(body).not.toHaveProperty("majorId");
});

it.each([false, true])("preserves legacy data while editing (link unit: %s)", async (link) => {
  rows = [legacy]; render(<Lecturers />);
  const code = await screen.findByText("GV01");
  await screen.findByRole("button", { name: "Thêm mới" });
  expect(screen.getByRole("columnheader", { name: "Đơn vị" })).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Ngành" })).not.toBeInTheDocument();
  fireEvent.doubleClick(code.closest("tr"));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/Đơn vị cũ: Tên đơn vị cũ/)).toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Chuyên ngành")).not.toBeInTheDocument();
  if (link) {
    fireEvent.mouseDown(within(dialog).getByRole("button", { name: "Đơn vị" }));
    fireEvent.click(await screen.findByRole("option", { name: "Đơn vị từ API" }));
  }
  fireEvent.change(within(dialog).getByLabelText("Họ và tên"), { target: { value: "Nguyễn An sửa" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalled());
  const body = axios.put.mock.calls[0][1];
  expect(body).toMatchObject({ name: "Nguyễn An sửa", phone: "123", disciplineId: link ? "unit-1" : null,
    academicRank: "Phó Giáo sư", academicDegree: "Tiến sĩ", teachingType: "Thỉnh giảng" });
  for (const key of ["faculty", "majorId", "email", "department", "staffId"]) expect(body).not.toHaveProperty(key);
});

it("keeps a previously selected inactive unit available on edit", async () => {
  rows = [{ ...legacy, disciplineId: "inactive", discipline: units[1] }]; render(<Lecturers />);
  const code = await screen.findByText("GV01");
  await screen.findByRole("button", { name: "Thêm mới" });
  fireEvent.doubleClick(code.closest("tr"));
  expect(screen.getByRole("button", { name: "Đơn vị" })).toHaveTextContent("Đơn vị ngừng dùng");
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String),
    expect.objectContaining({ disciplineId: "inactive" }), expect.any(Object)));
});

it("uses IDs for recommendation and never guesses a unit from text, major or class group", () => {
  const offering = { subject: { major: { disciplineId: "u2" } } };
  const candidates = [
    { name: "Bình", disciplineId: "u1", discipline: { name: "Cùng tên" }, majorId: "m" },
    { name: "An", disciplineId: "u2", discipline: { name: "Cùng tên" }, majorId: "other" },
    { name: "Chưa rõ", faculty: "Cùng tên", major: { disciplineId: "u2" } },
    { name: "Chưa tải", disciplineId: "missing" },
  ];
  const groups = lecturerGroupsForOffering(candidates, offering);
  expect(groups.map((group) => group.key)).toEqual(["unit:u2", "unit:u1", "unassigned"]);
  expect(groups.map((group) => group.recommended)).toEqual([true, false, false]);
  expect(lecturerUnitOf(candidates[2])).toBeNull();
  expect(recommendedUnitForOffering({ groupLinks: [{ classGroup: { major: { disciplineId: "u2" } } }] })).toBeNull();
  expect(lecturerGroupsForOffering(candidates, {}).every((group) => !group.recommended)).toBe(true);
});

it.each(["add", "edit"])("%s form renders letter headers, keeps duplicate labels by ID and puts empty last", async (mode) => {
  const options = [
    { id: "q", name: "Quản lý", active: true },
    { id: "k2", name: "Kỹ thuật", active: true },
    { id: "a", name: "An toàn", active: true },
    { id: "k1", name: "Kỹ thuật", active: true },
  ];
  rows = mode === "edit" ? [{ ...legacy, disciplineId: "k2" }] : [];
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" }
    : url.endsWith("/disciplines") ? options : rows }));
  render(<Lecturers />);
  const add = await screen.findByRole("button", { name: "Thêm mới" });
  if (mode === "add") fireEvent.click(add);
  else fireEvent.doubleClick((await screen.findByText("GV01")).closest("tr"));
  fireEvent.mouseDown(screen.getByRole("button", { name: "Đơn vị" }));
  await screen.findByRole("option", { name: "Quản lý" });
  const list = screen.getByRole("listbox");
  expect([...list.children].filter((item) => item.classList.contains("MuiListSubheader-root")).map((item) => item.textContent))
    .toEqual(["A", "K", "Q", "KHÁC"]);
  const heading = within(list).getByText("K");
  expect(heading).toHaveAttribute("role", "presentation");
  expect(heading).not.toHaveAttribute("tabindex");
  fireEvent.click(heading);
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  const items = within(list).getAllByRole("option");
  expect(items.map((item) => item.textContent)).toEqual(["An toàn", "Kỹ thuật", "Kỹ thuật", "Quản lý", "(Không có)"]);
  expect(items.filter((item) => item.textContent === "Kỹ thuật").map((item) => item.getAttribute("data-value")))
    .toEqual(["k2", "k1"]);
  fireEvent.click(items[2]);
  fireEvent.change(screen.getByLabelText("Mã giảng viên"), { target: { value: "GV03" } });
  fireEvent.change(screen.getByLabelText("Họ và tên"), { target: { value: "Nguyễn An" } });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(mode === "add" ? axios.post : axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ disciplineId: "k1" }), expect.any(Object)));
});

it("puts malformed labels in the final group without deleting options", () => {
  const options = [{ value: "bad", label: "  " }, { value: "none", label: "(Không có)" }, { value: "a", label: "Ánh sáng" }];
  const groups = alphabeticalOptionGroups(options);
  expect(groups.map((group) => group.label)).toEqual(["A", "KHÁC"]);
  expect(groups.flatMap((group) => group.items)).toHaveLength(3);
});

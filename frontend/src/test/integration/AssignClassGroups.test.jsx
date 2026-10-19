import React from "react";
import { act, fireEvent, render, screen, waitFor, within, cleanup } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { vi } from "vitest";
import axios from "axios";
import { toast } from "react-toastify";
import AssignClassGroups from "../../pages/masters/assignClassGroups";
import ResizableSplit from "../../components/ResizableSplit";

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), defaults: {} } }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, ToastContainer: () => null }));
vi.mock("../../components/FeatureLayout", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock(import("@mui/icons-material"), () => ({
  ArrowBackRounded: () => null, ArrowForwardRounded: () => null, CheckCircleOutlineRounded: () => null, WarningAmberRounded: () => null,
  DeleteOutlineRounded: () => null, GroupWorkRounded: () => null, PersonRounded: () => null, SearchRounded: () => null,
}));

const year = String(new Date().getFullYear());
const majors = [
  { id: "m1", code: "HTTT", name: "Hệ thống thông tin", disciplineId: "d1", discipline: { id: "d1", name: "Công nghệ thông tin" } },
  { id: "m2", name: "Khoa học dữ liệu", disciplineId: "d1", discipline: { id: "d1", name: "Công nghệ thông tin" } },
  { id: "m3", name: "Kế toán", disciplineId: "d2", discipline: { id: "d2", name: "Kinh tế" } },
];
const candidate = (id, fullName, majorId = "m1") => ({ id, code: id, fullName, majorId, academicYear: year, studyStatus: "Đã trúng tuyển", tuitionPaid: false });
const first = candidate("a", "Nguyễn Văn An");
const second = candidate("b", "Trần Thị Bình");
const member = { id: "member-x", admissionRecord: { id: "x", fullName: "Lê Văn X", code: "OLD", extraData: { tuitionPayment: { paid: true } } } };
const baseGroup = { id: "g1", code: "HTTT.1", majorId: "m1", academicYear: year, program: "masters", status: "open", maxStudents: 4, memberCount: 1, members: [member] };
const assignmentUrl = `/?year=${year}&disciplineId=d1&majorId=m1&groupId=g1`;
let serverGroups;
let serverStudents;
const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="url">{location.search}</output><output data-testid="path">{location.pathname}</output><button onClick={() => navigate(-1)}>Browser Back</button><button onClick={() => navigate(1)}>Browser Forward</button><button onClick={() => navigate(`/?year=${year}&disciplineId=d1&majorId=m2`)}>External scope change</button></>;
};
const openPage = async (url = "/") => {
  await act(async () => { render(<MemoryRouter initialEntries={[url]}><Navigation /><AssignClassGroups /></MemoryRouter>); });
};
const choose = async (label, option) => {
  fireEvent.mouseDown(screen.getByRole("button", { name: label, exact: true }));
  const item = await screen.findByRole("option", { name: option });
  await act(async () => { fireEvent.click(item); });
};
const selectStudent = async (name) => {
  const checkbox = await screen.findByRole("checkbox", { name: `Chọn ${name}` });
  await waitFor(() => expect(checkbox).toBeEnabled());
  await act(async () => { fireEvent.click(checkbox); });
};
const selectedCount = (count) => expect(document.getElementById("assignment-selection-status")).toHaveTextContent(count ? `Đã chọn ${count} học viên` : "Chưa chọn học viên");

describe("AssignClassGroups summary and assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    serverGroups = [baseGroup, { ...baseGroup, id: "g2", code: "HTTT.2", maxStudents: 1, memberCount: 0, members: [] }];
    serverStudents = [first, second];
    axios.get.mockImplementation(async (url) => ({ data: url.includes("/system/majors") ? majors
      : url.includes("/plan/curriculums") ? [{ id: "ct1", code: "CT1", name: "CTĐT", applicableFromYear: year, active: true }]
        : url.includes("eligible-students") ? serverStudents : serverGroups }));
    axios.post.mockResolvedValue({ data: { message: "Đã phân nhóm" } });
    axios.delete.mockResolvedValue({ data: {} });
  });
  afterEach(cleanup);

  const duplicateMajors = () => {
    const rows = majors.map((major) => major.id === "m3" ? major : { ...major, name: "Khai thác hàng hải", code: major.id === "m1" ? "KTHH" : "KTHH2" });
    const defaultGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url) => url.includes("/system/majors") ? Promise.resolve({ data: rows }) : defaultGet(url));
    serverStudents = [first, candidate("b2", "Trần B", "m2"), candidate("c2", "Lê C", "m2")];
    serverGroups = [baseGroup, { ...baseGroup, id: "major-b-group", majorId: "m2", members: [], memberCount: 0 }];
    return rows;
  };

  it("distinguishes duplicate options and Summary rows while preserving counts, IDs and Back/Forward", async () => {
    duplicateMajors();
    await openPage(`/?year=${year}&disciplineId=d1`);
    const a = await screen.findByRole("button", { name: "KTHH — Khai thác hàng hải" });
    const b = screen.getByRole("button", { name: "KTHH2 — Khai thác hàng hải" });
    expect(a).toHaveTextContent("1 HV");
    expect(b).toHaveTextContent("2 HV");
    fireEvent.click(a);
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent("majorId=m1"));
    expect(screen.getByRole("button", { name: "Chuyên ngành", exact: true })).toHaveTextContent("KTHH — Khai thác hàng hải");
    fireEvent.click(screen.getByRole("button", { name: "Quay lại tổng quan" }));
    fireEvent.click(await screen.findByRole("button", { name: "KTHH2 — Khai thác hàng hải" }));
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent("majorId=m2"));
    expect(screen.queryByRole("checkbox", { name: `Chọn ${first.fullName}` })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browser Back" }));
    await screen.findByRole("list", { name: "Tổng quan phân nhóm" });
    fireEvent.click(screen.getByRole("button", { name: "Browser Back" }));
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent("majorId=m1"));
    fireEvent.click(screen.getByRole("button", { name: "Browser Forward" }));
    await screen.findByRole("list", { name: "Tổng quan phân nhóm" });
    fireEvent.click(screen.getByRole("button", { name: "Browser Forward" }));
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent("majorId=m2"));
    await choose("Chuyên ngành", "KTHH — Khai thác hàng hải");
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent("majorId=m1"));
    await choose("Chuyên ngành", "KTHH2 — Khai thác hàng hải");
    expect(screen.getByTestId("url")).toHaveTextContent("majorId=m2");
  });

  it.each([["m1", "KTHH"], ["m2", "KTHH2"]])("restores duplicate-name %s by ID after remount", async (id, code) => {
    duplicateMajors();
    const url = `/?year=${year}&disciplineId=d1&majorId=${id}`;
    await openPage(url);
    await waitFor(() => expect(screen.getByRole("button", { name: "Chuyên ngành", exact: true })).toHaveTextContent(`${code} — Khai thác hàng hải`));
    const saved = screen.getByTestId("url").textContent;
    cleanup();
    await openPage(`/${saved}`);
    await waitFor(() => expect(screen.getByRole("button", { name: "Chuyên ngành", exact: true })).toHaveTextContent(`${code} — Khai thác hàng hải`));
    expect(new URLSearchParams(screen.getByTestId("url").textContent).get("majorId")).toBe(id);
  });

  it("warns about unresolved duplicate catalog labels without exposing IDs", async () => {
    const rows = duplicateMajors();
    rows[0].code = null;
    rows[1].code = "";
    await openPage(`/?year=${year}&disciplineId=d1`);
    expect(await screen.findByRole("alert")).toHaveTextContent("trùng tên chưa có mã phân biệt");
    fireEvent.mouseDown(screen.getByRole("button", { name: "Chuyên ngành", exact: true }));
    const options = await screen.findAllByRole("option", { name: "Khai thác hàng hải (chưa có mã chuyên ngành)" });
    expect(options).toHaveLength(2);
    options.forEach((option) => expect(option.textContent).not.toMatch(/undefined|null|m1|m2/));
  });

  it("renders dedicated learner code and full-name columns with clear missing-code fallback and no redundant columns", async () => {
    const longName = "Nguyễn Thị Hoàng Anh Phương Minh Châu";
    serverStudents = [
      { ...candidate("long", longName), lastName: "Nguyễn Thị Hoàng Anh Phương Minh", firstName: "Châu", code: "HV-2026-LONG-IDENTIFIER-001", gender: "Nữ", dob: "1990-12-31", tuitionPaid: true },
      { ...candidate("no-code", "Trần Nam"), code: "", gender: "Nam", dob: "1994-01-02" },
      { ...candidate("unknown", "Lê An"), code: "", tuitionPaid: null },
      { ...candidate("assigned", "Người đã có nhóm"), assignedGroup: { id: "g2", name: "Một nhóm có tên rất dài" } },
      candidate("other-major", "Người thuộc chuyên ngành khác", "m2"),
    ];
    await openPage(assignmentUrl);
    const table = await screen.findByRole("table", { name: "Học viên chưa phân nhóm" });
    await waitFor(() => expect(within(table).getAllByRole("checkbox")).toHaveLength(4));
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["", "Mã học viên", "Họ tên", "Ngày sinh", "Học phí nhập học"]);
    const row = within(table).getByRole("checkbox", { name: `Chọn ${longName}` }).closest("tr");
    expect(within(row).getByTitle(longName)).toHaveTextContent(longName);
    expect(getComputedStyle(row.cells[0]).position).toBe("sticky");
    expect(getComputedStyle(row.cells[1]).position).toBe("sticky");
    expect(getComputedStyle(row.cells[2]).position).toBe("sticky");
    expect(row.cells[1]).toHaveTextContent("HV-2026-LONG-IDENTIFIER-001");
    expect(within(row.cells[1]).getByTitle("HV-2026-LONG-IDENTIFIER-001")).toBeInTheDocument();
    expect(row.cells[2]).toHaveTextContent(longName);
    expect(row.cells[2]).not.toHaveTextContent("HV-2026");
    expect(within(row).queryByText("Nữ")).not.toBeInTheDocument();
    expect(row).toHaveTextContent("1990-12-31");
    expect(within(row).getByText("Đã nộp")).toBeInTheDocument();
    const noCode = within(table).getByRole("checkbox", { name: "Chọn Trần Nam" }).closest("tr");
    expect(noCode.cells[1].textContent).toBe("Chưa có");
    expect(noCode.cells[1]).not.toHaveTextContent("no-code");
    expect(noCode.cells[2].textContent).toBe("Trần Nam");
    expect(within(noCode).getByText("Chưa nộp")).toBeInTheDocument();
    expect(within(table).getByText("Chưa có dữ liệu")).toBeInTheDocument();
    expect(within(table).queryByText("Người đã có nhóm")).not.toBeInTheDocument();
    expect(within(table).queryByText("Người thuộc chuyên ngành khác")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chuyên ngành", exact: true })).toHaveTextContent("Hệ thống thông tin");
  });

  it("keeps code and phone search working with the recomposed identity and retains hidden selection", async () => {
    serverStudents = [{ ...first, code: "HV2026-01" }, { ...second, phone: "0912345678", code: "" }];
    await openPage(assignmentUrl);
    const search = screen.getByPlaceholderText(/Tìm học viên theo mã/);
    fireEvent.change(search, { target: { value: "HV2026-01" } });
    await selectStudent(first.fullName);
    expect(screen.queryByRole("checkbox", { name: `Chọn ${second.fullName}` })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "0912345678" } });
    await selectStudent(second.fullName);
    selectedCount(2);
    expect(screen.queryByRole("checkbox", { name: `Chọn ${first.fullName}` })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByRole("checkbox", { name: `Chọn ${first.fullName}` })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: `Chọn ${second.fullName}` })).toBeChecked();
  });

  it("starts in a compact summary, counts closed classes, excludes other scopes and allows only major entry points", async () => {
    serverGroups.push(
      { ...baseGroup, id: "closed", status: "closed", members: [{ id: "closed-member", studentId: "legacy" }] },
      { ...baseGroup, id: "duplicate", members: [member] },
      { ...baseGroup, id: "past", academicYear: String(Number(year) - 1), members: [{ id: "past-member" }] },
      { ...baseGroup, id: "doctoral", program: "doctoral", members: [{ id: "doctoral-member" }] },
      { ...baseGroup, id: "accounting", majorId: "m3", members: [{ id: "accounting-member" }] },
    );
    serverStudents.push(candidate("c", "Phạm C", "m2"), candidate("d", "Đỗ D", "m3"), { ...first, id: "paused", studyStatus: "Bảo lưu" }, { ...first, id: "assigned", assignedGroup: { id: "closed" } });
    await openPage();
    const table = await screen.findByRole("list", { name: "Tổng quan phân nhóm" });
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nhóm mục tiêu" })).not.toBeInTheDocument();
    expect(within(table).getByRole("button", { name: majors[0].name })).toHaveTextContent("2 HV");
    const multiMajorCard = within(table).getByRole("button", { name: majors[0].name }).closest(".assignment-discipline-card");
    expect(multiMajorCard.querySelector(".assignment-summary-discipline")).toHaveTextContent("3 HV");
    expect(within(multiMajorCard).getByRole("button", { name: majors[1].name })).toHaveTextContent("1 HV");
    expect(screen.queryByRole("columnheader")).not.toBeInTheDocument();
    expect(axios.get.mock.calls.filter(([url]) => url.includes("class-groups?"))[0][0]).not.toContain("status=open");
    expect(screen.getByTestId("url")).toHaveTextContent(`year=${year}`);
    await choose("Ngành", "Công nghệ thông tin");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Kế toán" })).not.toBeInTheDocument());
    expect(screen.getByRole("list", { name: "Tổng quan phân nhóm" })).toBeInTheDocument();
  });

  it("shows a single-major count only in the actionable row even when discipline and major names match", async () => {
    const sameNameMajors = majors.map((major) => major.id === "m1" ? { ...major, name: major.discipline.name } : major);
    axios.get.mockImplementation(async (url) => ({ data: url.includes("/system/majors") ? sameNameMajors
      : url.includes("eligible-students") ? serverStudents : serverGroups }));
    await openPage();
    const row = await screen.findByRole("button", { name: majors[0].discipline.name });
    const card = row.closest(".assignment-discipline-card");
    expect(card.querySelector(".assignment-summary-discipline")).toHaveTextContent(majors[0].discipline.name);
    expect(card.querySelector(".assignment-discipline-total")).toBeNull();
    expect(within(card).getAllByText("2 HV")).toHaveLength(1);
    expect(row).toHaveTextContent("2 HV");
    fireEvent.click(row);
    await screen.findByRole("table", { name: "Học viên chưa phân nhóm" });
    expect(screen.getByTestId("url")).toHaveTextContent("disciplineId=d1&majorId=m1");
  });

  it("syncs click, URL, filters, browser Back/Forward and the return action", async () => {
    await openPage();
    fireEvent.click(await screen.findByRole("button", { name: "Hệ thống thông tin" }));
    await screen.findByRole("table", { name: "Học viên chưa phân nhóm" });
    expect(screen.getByTestId("url")).toHaveTextContent("disciplineId=d1&majorId=m1");
    expect(screen.getByRole("button", { name: "Ngành", exact: true })).toHaveTextContent("Công nghệ thông tin");
    expect(screen.getByRole("button", { name: "Chuyên ngành", exact: true })).toHaveTextContent("Hệ thống thông tin");
    fireEvent.click(screen.getByRole("button", { name: "Browser Back" }));
    await screen.findByRole("list", { name: "Tổng quan phân nhóm" });
    fireEvent.click(screen.getByRole("button", { name: "Browser Forward" }));
    await screen.findByRole("table", { name: "Học viên chưa phân nhóm" });
    fireEvent.click(screen.getByRole("button", { name: "Quay lại tổng quan" }));
    await screen.findByRole("list", { name: "Tổng quan phân nhóm" });
    expect(screen.getByTestId("url")).toHaveTextContent(`?year=${year}`);
    await waitFor(() => expect(screen.getByTestId("url")).not.toHaveTextContent("majorId"));
  });

  it.each([`/?year=${year}`, `/?year=${year}&disciplineId=d1`, "/?year=invalid&disciplineId=stale&majorId=m1", `/?year=${year}&disciplineId=d1&majorId=m3`])("safely normalizes incomplete or invalid scope %s", async (url) => {
    await openPage(url);
    await screen.findByRole("list", { name: "Tổng quan phân nhóm" });
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("url")).not.toHaveTextContent("majorId"));
    expect(screen.getByTestId("url")).toHaveTextContent(`year=${year}`);
  });

  it("restores assignment on refresh and restricts the target selector to open masters classes in scope", async () => {
    serverGroups.push({ ...baseGroup, id: "closed", code: "CLOSED", status: "closed" }, { ...baseGroup, id: "other", code: "OTHER", majorId: "m2" });
    await openPage(assignmentUrl);
    await screen.findByText("Sĩ số: 1 / 4 học viên");
    expect(screen.getByRole("separator")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Nhóm mục tiêu" }));
    expect(await screen.findByRole("option", { name: /HTTT.2/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /CLOSED|OTHER/ })).not.toBeInTheDocument();
  });

  it("normalizes existing major + group links from the class list", async () => {
    await openPage(`/?year=${year}&majorId=m1&groupId=g1`);
    await screen.findByText("Sĩ số: 1 / 4 học viên");
    expect(screen.getByTestId("url")).toHaveTextContent("disciplineId=d1");
    expect(screen.getByRole("button", { name: "Chuyên ngành", exact: true })).toHaveTextContent("Hệ thống thông tin");
  });

  it("preserves hidden selections and reports capacity inline without extra actions or alert rows", async () => {
    await openPage(assignmentUrl);
    const search = screen.getByPlaceholderText(/Tìm học viên theo mã/);
    fireEvent.change(search, { target: { value: "Nguyễn" } });
    await selectStudent(first.fullName);
    fireEvent.change(search, { target: { value: "Trần" } });
    await selectStudent(second.fullName);
    selectedCount(2);
    expect(screen.queryByRole("button", { name: "Xem đã chọn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bỏ chọn tất cả" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: `Chọn ${second.fullName}` })).toBeChecked();
    await choose("Nhóm mục tiêu", /HTTT.2/);
    selectedCount(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.getElementById("assignment-selection-status")).toHaveTextContent("Nhóm còn 1 chỗ · Vượt 1 học viên");
    expect(screen.getByRole("button", { name: "Gán 2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gán 2" })).toHaveAttribute("aria-describedby", "assignment-selection-status");
    fireEvent.change(search, { target: { value: "Nguyễn" } });
    await selectStudent(first.fullName);
    expect(screen.getByRole("button", { name: "Gán 1" })).toBeEnabled();
    fireEvent.change(search, { target: { value: "Trần" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả học viên" }));
    selectedCount(0);
  });

  it.each([
    ["one usable", [{ ...baseGroup, id: "only" }], "only"],
    ["deterministic code order", [{ ...baseGroup, id: "later", code: "HTTT.3" }, { ...baseGroup, id: "first", code: "HTTT.2" }], "first"],
    ["full first group", [{ ...baseGroup, maxStudents: 1 }, { ...baseGroup, id: "available", code: "HTTT.2" }], "available"],
  ])("auto-selects %s without reloading the scope", async (_, groups, expected) => {
    serverGroups = groups;
    await openPage(`/?year=${year}&disciplineId=d1&majorId=m1`);
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent(`groupId=${expected}`));
    expect(axios.get.mock.calls.filter(([url]) => url.includes("class-groups?")).length).toBe(1);
  });

  it("respects an explicit quick-create target and manual full-group selection", async () => {
    serverGroups = [{ ...baseGroup, maxStudents: 1 }, { ...baseGroup, id: "created", code: "HTTT.3" }];
    await openPage(`/?year=${year}&disciplineId=d1&majorId=m1&groupId=created`);
    await screen.findByText("Sĩ số: 1 / 4 học viên");
    expect(screen.getByTestId("url")).toHaveTextContent("groupId=created");
    await choose("Nhóm mục tiêu", /HTTT.1/);
    await screen.findByText("Nhóm hiện tại đã đủ sĩ số.");
    expect(screen.getByTestId("url")).toHaveTextContent("groupId=g1");
    expect(screen.queryByRole("button", { name: /Tạo mới/ })).not.toBeInTheDocument();
  });

  it("replaces an invalid target with an available group", async () => {
    await openPage(`/?year=${year}&disciplineId=d1&majorId=m1&groupId=removed`);
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent("groupId=g1"));
  });

  it.each([false, true])("shows actionable no-capacity guidance (full=%s) without a generic choose-target prompt", async (full) => {
    serverGroups = full ? [{ ...baseGroup, maxStudents: 1 }] : [];
    await openPage(`/?year=${year}&disciplineId=d1&majorId=m1`);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(full ? "Các nhóm hiện tại đã đủ sĩ số" : "Chưa có nhóm đang mở");
    expect(within(alert).getByRole("button", { name: /Tạo mới/ })).toBeInTheDocument();
    expect(screen.getByTestId("url")).not.toHaveTextContent("groupId");
    expect(screen.queryByText(/để xem thành viên và/)).not.toBeInTheDocument();
    await selectStudent(first.fullName);
    selectedCount(1);
    expect(screen.getByRole("button", { name: "Gán 1" })).toBeDisabled();
  });

  it("select-all changes only visible rows and retains hidden selections", async () => {
    await openPage(assignmentUrl);
    await selectStudent(first.fullName);
    fireEvent.change(screen.getByPlaceholderText(/Tìm học viên theo mã/), { target: { value: "Trần" } });
    expect(screen.getByRole("checkbox", { name: "Chọn tất cả học viên" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả học viên" }));
    selectedCount(2);
    expect(screen.getByRole("checkbox", { name: "Chọn tất cả học viên" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả học viên" }));
    selectedCount(1);
    fireEvent.change(screen.getByPlaceholderText(/Tìm học viên theo mã/), { target: { value: "" } });
    expect(screen.getByRole("checkbox", { name: "Chọn tất cả học viên" })).toHaveAttribute("data-indeterminate", "true");
  });

  it.each(["Năm tuyển sinh", "Ngành", "Chuyên ngành"])("clears selection when %s changes", async (filter) => {
    await openPage(assignmentUrl);
    await selectStudent(first.fullName);
    await choose(filter, filter === "Năm tuyển sinh" ? String(Number(year) - 1) : filter === "Ngành" ? "Kinh tế" : "Khoa học dữ liệu");
    if (filter === "Ngành") {
      await screen.findByText("Không còn học viên chờ phân nhóm");
      await choose("Chuyên ngành", "Kế toán");
    }
    await waitFor(() => selectedCount(0));
    expect(screen.getByRole("button", { name: "Gán" })).toBeDisabled();
  });

  it("confirms removal, cancels without DELETE, then reloads members while retaining other selections", async () => {
    await openPage(assignmentUrl);
    await selectStudent(first.fullName);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ Lê Văn X khỏi nhóm" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Bỏ Lê Văn X khỏi nhóm HTTT.1?");
    expect(axios.delete).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(axios.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ Lê Văn X khỏi nhóm" }));
    let finish;
    axios.delete.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Bỏ khỏi nhóm", exact: true }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Bỏ khỏi nhóm", exact: true })).toBeDisabled();
    serverGroups = [{ ...baseGroup, memberCount: 0, members: [] }];
    await act(async () => finish({ data: {} }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await screen.findByText("Sĩ số: 0 / 4 học viên");
    selectedCount(1);
    expect(axios.delete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("checkbox", { name: `Chọn ${first.fullName}` })).toBeChecked();
  });

  it.each([400, 404, 409])("reconciles stale assignment HTTP %s with current candidates, members and capacity", async (status) => {
    await openPage(assignmentUrl);
    await selectStudent(first.fullName);
    await selectStudent(second.fullName);
    serverStudents = [first];
    serverGroups = [{ ...baseGroup, maxStudents: 2, memberCount: 2, members: [member, { id: "b-member", admissionRecord: second }] }];
    axios.post.mockRejectedValue({ response: { status, data: { message: "Dữ liệu đã thay đổi" } } });
    fireEvent.click(screen.getByRole("button", { name: "Gán 2" }));
    await screen.findByText("Sĩ số: 2 / 2 học viên");
    selectedCount(1);
    expect(screen.getByRole("checkbox", { name: `Chọn ${first.fullName}` })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: `Chọn ${second.fullName}` })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gán 1" })).toBeDisabled();
    expect(toast.error).toHaveBeenCalledWith("Dữ liệu đã thay đổi");
  });

  it("submits once, clears selection only on successful assignment, and preserves tuition display", async () => {
    await openPage(assignmentUrl);
    await selectStudent(first.fullName);
    expect(screen.getByText("Đã nộp")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa nộp")).toHaveLength(2);
    let finish;
    axios.post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const assign = screen.getByRole("button", { name: "Gán 1" });
    fireEvent.click(assign);
    fireEvent.click(assign);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/g1/members"), { admissionRecordIds: ["a"] }, { withCredentials: true });
    serverStudents = [second];
    await act(async () => finish({ data: {} }));
    await waitFor(() => selectedCount(0));
  });

  it("ignores late responses from an older scope", async () => {
    const oldRequests = [];
    axios.get.mockImplementation((url) => {
      if (url.includes("/system/majors")) return Promise.resolve({ data: majors });
      if (!url.includes("majorId=")) return new Promise((resolve) => oldRequests.push({ url, resolve }));
      return Promise.resolve({ data: url.includes("eligible-students") ? [first] : [baseGroup] });
    });
    await openPage();
    await choose("Chuyên ngành", "Hệ thống thông tin");
    await screen.findByRole("checkbox", { name: `Chọn ${first.fullName}` });
    await act(async () => oldRequests.forEach(({ url, resolve }) => resolve({ data: url.includes("eligible-students") ? [candidate("wrong", "Sai phạm vi", "m3")] : [] })));
    expect(screen.queryByText("wrong")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: `Chọn ${first.fullName}` })).toBeInTheDocument();
  });
  it("hides zero-work majors and their discipline parents, with no report columns", async () => {
    await openPage();
    const queue = await screen.findByRole("list", { name: "Tổng quan phân nhóm" });
    expect(within(queue).queryByRole("button", { name: majors[1].name })).not.toBeInTheDocument();
    expect(within(queue).queryByRole("button", { name: majors[2].name })).not.toBeInTheDocument();
    expect(within(queue).queryByText("Kinh tế")).not.toBeInTheDocument();
    expect(within(queue).queryByText("Đã phân")).not.toBeInTheDocument();
    expect(within(queue).queryByText("Tổng")).not.toBeInTheDocument();
  });

  it("shows the completed-work empty state even when assigned groups exist", async () => {
    serverStudents = [];
    await openPage();
    expect(await screen.findByText("Không còn học viên chờ phân nhóm")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tổng quan phân nhóm" })).not.toBeInTheDocument();
    expect(screen.getByText(/Tất cả học viên trong phạm vi hiện tại/)).toBeInTheDocument();
  });

  it("keeps overview within the candidate header and clears both scope IDs", async () => {
    await openPage(assignmentUrl);
    const overview = screen.getByRole("button", { name: "Quay lại tổng quan" });
    expect(overview.parentElement).toHaveTextContent("Học viên chưa phân nhóm");
    fireEvent.click(overview);
    await waitFor(() => expect(screen.getByTestId("url")).toHaveTextContent(`?year=${year}`));
    expect(screen.getByTestId("url").textContent).toBe(`?year=${year}`);
  });

  it("guides staff to available alternatives without quick-create and preserves selection", async () => {
    serverGroups[0] = { ...baseGroup, maxStudents: 1 };
    await openPage(assignmentUrl);
    await selectStudent(first.fullName);
    expect(await screen.findByText("Nhóm hiện tại đã đủ sĩ số.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tạo mới/ })).not.toBeInTheDocument();
    await choose("Nhóm mục tiêu", /HTTT.2/);
    selectedCount(1);
    expect(screen.getByRole("button", { name: "Gán 1" })).toBeEnabled();
  });

  it("offers ClassGroup quick-create only when no eligible alternative has capacity", async () => {
    serverGroups = [{ ...baseGroup, maxStudents: 1 },
      { ...baseGroup, id: "closed", status: "closed", members: [], memberCount: 0 },
      { ...baseGroup, id: "other-major", majorId: "m2", members: [], memberCount: 0 },
      { ...baseGroup, id: "past", academicYear: String(Number(year) - 1), members: [], memberCount: 0 },
      { ...baseGroup, id: "doctoral", program: "doctoral", members: [], memberCount: 0 }];
    await openPage(assignmentUrl);
    fireEvent.click(await screen.findByRole("button", { name: /Tạo mới/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Tạo nhóm học viên mới");
    expect(screen.getByTestId("path").textContent).toBe("/");
    const params = new URLSearchParams(screen.getByTestId("url").textContent);
    expect(params.get("year")).toBe(year);
    expect(params.get("disciplineId")).toBe("d1");
    expect(params.get("majorId")).toBe("m1");
    expect(params.get("groupId")).toBe("g1");
  });

  const prepareCreateDraft = async (noGroups = false) => {
    serverGroups = noGroups ? [] : [{ ...baseGroup, maxStudents: 1 }];
    serverStudents = ["Đinh An", "Đinh Bình", "Đinh Cường", "Lê Dũng", "Trần Em"].map((name, index) => candidate(`draft-${index}`, name));
    await openPage(assignmentUrl);
    const selectAll = await screen.findByRole("checkbox", { name: "Chọn tất cả học viên" });
    await waitFor(() => expect(selectAll).toBeEnabled());
    fireEvent.click(selectAll);
    fireEvent.change(screen.getByPlaceholderText("Tìm học viên theo mã, họ tên, số điện thoại..."), { target: { value: "Đinh" } });
    selectedCount(5);
    return screen.getByTestId("url").textContent;
  };
  const openInlineCreate = async () => {
    fireEvent.click(screen.getByRole("button", { name: "+ Tạo mới" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Tạo 1 nhóm" })).toBeEnabled());
    return dialog;
  };
  const expectDraft = (count = 5) => {
    selectedCount(count);
    expect(screen.getByPlaceholderText("Tìm học viên theo mã, họ tên, số điện thoại...")).toHaveValue("Đinh");
    expect(screen.getAllByRole("checkbox", { name: /^Chọn Đinh/ })).toHaveLength(3);
    expect(screen.getByTestId("path").textContent).toBe("/");
  };
  const createdGroup = (id, cap = 5, overrides = {}) => ({ ...baseGroup, id, code: `HTTT.${id}`, memberCount: 0, members: [], maxStudents: cap, ...overrides });
  const createResponse = (rows, response = rows) => axios.post.mockImplementation(async () => {
    serverGroups = [...serverGroups, ...rows];
    return { data: { groups: response } };
  });
  const saveInline = async (dialog) => {
    fireEvent.click(within(dialog).getByRole("button", { name: /Tạo \d+ nhóm/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  };

  it("inline open/cancel locks scope and preserves five selected IDs, hidden search, target and URL without reloading", async () => {
    const url = await prepareCreateDraft();
    const dialog = await openInlineCreate();
    for (const label of ["Ngành", "Chuyên ngành", "Năm / khóa"]) expect(within(dialog).getByRole("button", { name: label })).toHaveAttribute("aria-disabled", "true");
    const calls = axios.get.mock.calls.length;
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expectDraft();
    expect(screen.getByTestId("url").textContent).toBe(url);
    expect(axios.get).toHaveBeenCalledTimes(calls);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([5, 3])("inline create capacity %s preserves hidden selection and enforces capacity before assigning all five IDs", async (cap) => {
    await prepareCreateDraft(true);
    const dialog = await openInlineCreate();
    fireEvent.change(within(dialog).getByLabelText("Sĩ số tối đa / nhóm"), { target: { value: String(cap) } });
    createResponse([createdGroup("new", cap)]);
    await saveInline(dialog);
    expectDraft();
    expect(new URLSearchParams(screen.getByTestId("url").textContent).get("groupId")).toBe("new");
    if (cap === 3) {
      expect(document.getElementById("assignment-selection-status")).toHaveTextContent("Vượt 2 học viên");
      expect(screen.getByRole("button", { name: "Gán 5" })).toBeDisabled();
    } else {
      expect(screen.getByRole("button", { name: "Gán 5" })).toBeEnabled();
      axios.post.mockResolvedValue({ data: {} });
      fireEvent.click(screen.getByRole("button", { name: "Gán 5" }));
      await waitFor(() => expect(axios.post).toHaveBeenLastCalledWith(expect.stringContaining("/new/members"), { admissionRecordIds: serverStudents.map((student) => student.id) }, { withCredentials: true }));
    }
  });

  it("inline create failure preserves entered values, target and draft and allows retry", async () => {
    const url = await prepareCreateDraft();
    const dialog = await openInlineCreate();
    fireEvent.change(within(dialog).getByLabelText("Ghi chú"), { target: { value: "Giữ bản nháp" } });
    axios.post.mockRejectedValueOnce({ response: { data: { message: "Không thể kết nối để tạo nhóm" } } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo 1 nhóm" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Không thể kết nối để tạo nhóm");
    expect(within(dialog).getByLabelText("Ghi chú")).toHaveValue("Giữ bản nháp");
    selectedCount(5);
    expect(screen.getByTestId("url").textContent).toBe(url);
    createResponse([createdGroup("retry")]);
    await saveInline(dialog);
    expectDraft();
  });

  it.each(["missing-id", "closed", "full", "wrong-major", "wrong-year", "wrong-program"])("does not choose unusable created groups (%s) or silently fall back", async (reason) => {
    await prepareCreateDraft(true);
    const dialog = await openInlineCreate();
    const invalid = createdGroup("unusable", 5, reason === "closed" ? { status: "closed" } : reason === "full" ? { maxStudents: 0 } : reason === "wrong-major" ? { majorId: "m2" } : reason === "wrong-year" ? { academicYear: "2000" } : reason === "wrong-program" ? { program: "doctoral" } : {});
    createResponse([invalid, createdGroup("manual")], reason === "missing-id" ? [{}] : [invalid]);
    await saveInline(dialog);
    expectDraft();
    expect(new URLSearchParams(screen.getByTestId("url").textContent).has("groupId")).toBe(false);
    expect(screen.getByText(/Đã tạo nhóm, nhưng chưa có nhóm mới khả dụng/)).toBeInTheDocument();
    await choose("Nhóm mục tiêu", /HTTT.manual/);
    expect(screen.getByRole("button", { name: "Gán 5" })).toBeEnabled();
    expectDraft();
  });

  it("chooses the first usable group in creation response order rather than code sort order", async () => {
    await prepareCreateDraft();
    const dialog = await openInlineCreate();
    fireEvent.change(within(dialog).getByLabelText("Số nhóm cần tạo"), { target: { value: "3" } });
    const rows = [createdGroup("closed", 5, { status: "closed" }), createdGroup("z-first"), createdGroup("a-second")];
    createResponse(rows);
    await saveInline(dialog);
    expectDraft();
    expect(new URLSearchParams(screen.getByTestId("url").textContent).get("groupId")).toBe("z-first");
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/batch"), expect.objectContaining({ count: 3, majorId: "m1", academicYear: year, curriculumId: "ct1" }), { withCredentials: true });
  });

  it("preserves the draft if creation succeeds but the target reload fails, without allowing a duplicate create retry", async () => {
    const url = await prepareCreateDraft();
    const dialog = await openInlineCreate();
    axios.post.mockImplementation(async () => {
      axios.get.mockRejectedValueOnce(new Error("Reload offline"));
      return { data: { groups: [createdGroup("saved")] } };
    });
    await saveInline(dialog);
    expectDraft();
    expect(screen.getByTestId("url").textContent).toBe(url);
    expect(screen.getByText(/Đã tạo nhóm nhưng chưa tải lại được/)).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(1);
    serverGroups.push(createdGroup("saved"));
    fireEvent.click(screen.getByRole("button", { name: "Tải lại nhóm" }));
    await waitFor(() => expect(new URLSearchParams(screen.getByTestId("url").textContent).get("groupId")).toBe("saved"));
    expectDraft();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("ignores a create response after browser navigation changes the Assignment scope", async () => {
    await prepareCreateDraft();
    const dialog = await openInlineCreate();
    let finish;
    axios.post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo 1 nhóm" }));
    await waitFor(() => expect(finish).toBeDefined());
    // Simulate router/browser navigation outside the modal, not a pointer click through its backdrop.
    await act(async () => fireEvent.click(screen.getByText("External scope change")));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => finish({ data: { groups: [createdGroup("late")] } }));
    expect(new URLSearchParams(screen.getByTestId("url").textContent).get("majorId")).toBe("m2");
    expect(new URLSearchParams(screen.getByTestId("url").textContent).get("groupId")).not.toBe("late");
    selectedCount(0);
  });

  it("does not reload or navigate from a create response after leaving Assignment", async () => {
    await prepareCreateDraft();
    const dialog = await openInlineCreate();
    let finish;
    axios.post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo 1 nhóm" }));
    await waitFor(() => expect(finish).toBeDefined());
    cleanup();
    const calls = axios.get.mock.calls.length;
    await act(async () => finish({ data: { groups: [createdGroup("late")] } }));
    expect(axios.get).toHaveBeenCalledTimes(calls);
    expect(screen.queryByTestId("url")).not.toBeInTheDocument();
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

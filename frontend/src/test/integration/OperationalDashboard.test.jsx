import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { vi } from "vitest";
import axios from "axios";
import Home from "../../pages/viewLogged";

vi.mock("axios", () => ({ default: { get: vi.fn(), defaults: {} } }));
vi.mock("../../components/navbarNew", () => ({ default: () => <nav aria-label="Ribbon hiện có">VMU</nav> }));
vi.mock("../../components/footer", () => ({ default: () => <footer>Footer hiện có</footer> }));
const permissions = { grouping: true, scheduling: true, grades: true, progress: true, overview: true };
const fixture = (count = 7, year = "2026") => ({ year, permissions, sources: {
  grouping: { status: "ready", data: { count, itemCount: count ? 1 : 0, href: `/masters/assign-class-groups?year=${year}`, items: count ? [
    { id: "m1", title: "Công nghệ thông tin", detail: "Khoa học máy tính", count, unit: "HV", href: `/masters/assign-class-groups?year=${year}&disciplineId=d1&majorId=m1` },
  ] : [] } },
  grades: { status: "ready", data: { count: 0, itemCount: 0, href: `/masters/exam-lists?year=${year}`, items: [] } },
  teaching: { status: "ready", data: {
    scheduling: { count: 1, itemCount: 1, href: `/masters/schedule?year=${year}&queue=unscheduled`, items: [
      { id: "o1", title: "CNTT 2026.1.1", detail: "Cơ sở dữ liệu", href: `/masters/schedule?year=${year}&offeringId=o1` },
    ] },
    progress: { count: 0, itemCount: 0, href: `/masters/schedule?year=${year}&queue=pending-confirmation`, items: [] },
    overview: { active: 3, inProgress: 2, unscheduled: 1, completed: 4 },
  } },
} });
const Location = () => { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; };
const open = async () => {
  await act(async () => render(<MemoryRouter initialEntries={["/viewLogged?year=2026"]}><Location /><Home /></MemoryRouter>));
};
beforeEach(() => { vi.clearAllMocks(); axios.get.mockResolvedValue({ data: fixture() }); });

it("replaces the hero with a compact dashboard and keeps the existing layout chrome", async () => {
  await open();
  expect(screen.getByRole("heading", { name: "Bảng điều khiển công việc" })).toBeInTheDocument();
  expect(screen.getByText("Theo dõi các công việc cần xử lý và tình trạng nghiệp vụ theo năm tuyển sinh.")).toBeInTheDocument();
  expect(screen.queryByText("ĐÀO TẠO SAU ĐẠI HỌC")).not.toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Ribbon hiện có" })).toHaveTextContent("VMU");
  expect(screen.getByText("Footer hiện có")).toBeInTheDocument();
  expect(document.querySelector(".home-hero")).toBeNull();
  expect(screen.getAllByRole("article")).toHaveLength(4);
  expect(within(screen.getByRole("article", { name: "Học viên chưa phân nhóm" })).getByText("7")).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledTimes(1);
});

it("hides inaccessible widgets, previews, warnings and management overview", async () => {
  const data = fixture(); data.permissions = { grouping: false, scheduling: false, progress: false, overview: false, grades: true };
  axios.get.mockResolvedValue({ data });
  await open();
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.queryByText("Học viên chưa phân nhóm")).not.toBeInTheDocument();
  expect(screen.queryByText("CẢNH BÁO")).not.toBeInTheDocument();
  expect(screen.queryByText("TÌNH HÌNH ĐÀO TẠO")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Xếp lịch/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Phân bổ học viên chờ xử lý" })).not.toBeInTheDocument();
});

it("deep-links learner grouping to the selected year and a concrete major", async () => {
  await open();
  const grouping = screen.getByRole("article", { name: "Học viên chưa phân nhóm" });
  expect(within(grouping).getByRole("link", { name: "Phân nhóm" })).toHaveAttribute("href", "/masters/assign-class-groups?year=2026");
  const major = screen.getByRole("link", { name: /Công nghệ thông tin.*Khoa học máy tính/ });
  fireEvent.click(major);
  expect(screen.getByTestId("location")).toHaveTextContent("/masters/assign-class-groups?year=2026&disciplineId=d1&majorId=m1");
});

it("supports keyboard focus and Enter activation for scheduling", async () => {
  await open();
  const link = within(screen.getByRole("article", { name: "Lớp chưa xếp lịch" })).getByRole("link", { name: "Xếp lịch" });
  link.focus(); expect(link).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  expect(screen.getByTestId("location")).toHaveTextContent("/masters/schedule?year=2026&queue=unscheduled");
});

it("renders calm healthy cards and empty warnings without giant zero values", async () => {
  const data = fixture(0); data.sources.teaching.data.scheduling = { ...data.sources.teaching.data.scheduling, count: 0, items: [] };
  axios.get.mockResolvedValue({ data });
  await open();
  expect(screen.getByText("Không còn học viên chờ phân nhóm")).toBeInTheDocument();
  expect(screen.getByText("Không có cảnh báo")).toBeInTheDocument();
  expect(screen.getByText("Chưa phát hiện vấn đề cần xử lý.")).toBeInTheDocument();
  expect(screen.getByText("Không có mục chờ xử lý")).toBeInTheDocument();
  expect(screen.getByText("Mọi đầu việc trong phạm vi hiện tại đã hoàn thành.")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Xem chi tiết" })).toHaveLength(4);
  expect(screen.queryByRole("link", { name: "Xem phạm vi" })).not.toBeInTheDocument();
  for (const card of screen.getAllByRole("article")) expect(within(card).queryByText("0")).not.toBeInTheDocument();
});

it("keeps other widgets usable when grades fail and retries only that source", async () => {
  const data = fixture(); data.sources.grades = { status: "error" };
  axios.get.mockResolvedValue({ data });
  await open();
  expect(screen.getByRole("link", { name: "Phân nhóm" })).toBeInTheDocument();
  const grades = screen.getByRole("article", { name: "Lớp chưa nhập đủ điểm" });
  expect(within(grades).getByRole("alert")).toHaveTextContent("Chưa tải được dữ liệu.");
  axios.get.mockResolvedValue({ data: { year: "2026", permissions, sources: { grades: fixture().sources.grades } } });
  await act(async () => fireEvent.click(within(grades).getByRole("button", { name: "Thử lại" })));
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringContaining("/dashboard/operational"), expect.objectContaining({ params: { year: "2026", section: "grades" } }));
  expect(within(grades).getByText("Không có lớp chờ bổ sung điểm")).toBeInTheDocument();
});

it("never reports a healthy warning panel when its source failed", async () => {
  const data = fixture(); data.sources.teaching = { status: "error" };
  axios.get.mockResolvedValue({ data });
  await open();
  expect(screen.queryByText("Không có cảnh báo")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Phân nhóm" })).toBeInTheDocument();
});

it("ignores late old-year results and requests the newly selected year", async () => {
  let finishOld;
  axios.get.mockImplementation((url, options) => options.params.year === "2026"
    ? new Promise((resolve) => { finishOld = resolve; }) : Promise.resolve({ data: fixture(3, "2025") }));
  await open();
  fireEvent.change(screen.getByRole("combobox", { name: "Năm tuyển sinh" }), { target: { value: "2025" } });
  await waitFor(() => expect(screen.getByRole("link", { name: "Phân nhóm" })).toHaveAttribute("href", "/masters/assign-class-groups?year=2025"));
  await act(async () => finishOld({ data: fixture(100, "2026") }));
  expect(within(screen.getByRole("article", { name: "Học viên chưa phân nhóm" })).getByText("3")).toBeInTheDocument();
  expect(screen.queryByText("100")).not.toBeInTheDocument();
});

it("does not present unavailable work as a completed queue for an account without actions", async () => {
  axios.get.mockResolvedValue({ data: { permissions: {}, sources: {} } });
  await open();
  expect(screen.getByText("Chưa có tác vụ được giao")).toBeInTheDocument();
  expect(screen.queryByText("Mọi đầu việc trong phạm vi hiện tại đã hoàn thành.")).not.toBeInTheDocument();
});

it("keeps multiple actionable queues without a duplicate distribution panel or count charts", async () => {
  const data = fixture(12);
  data.sources.grouping.data.itemCount = 6;
  data.sources.grouping.data.items = [
    { id: "m1", title: "Công nghệ thông tin", detail: "Khoa học máy tính", count: 4, unit: "HV", href: "/masters/assign-class-groups?year=2026&disciplineId=d1&majorId=m1" },
    { id: "m2", title: "Hệ thống thông tin", detail: "Khoa học máy tính", count: 3, unit: "HV", href: "/masters/assign-class-groups?year=2026&disciplineId=d1&majorId=m2" },
  ];
  axios.get.mockResolvedValue({ data });
  await open();
  expect(screen.queryByRole("region", { name: "Phân bổ học viên chờ xử lý" })).not.toBeInTheDocument();
  expect(document.querySelector(".od-distribution, .od-mini-bar")).toBeNull();
  const inbox = screen.getByRole("region", { name: "VIỆC CẦN XỬ LÝ" });
  expect(within(inbox).getByRole("region", { name: "Học viên chưa phân nhóm" })).toHaveTextContent("Hiển thị 2/6 mục");
  expect(within(inbox).getByRole("region", { name: "Lớp chưa xếp lịch" })).toHaveTextContent("CNTT 2026.1.1");
  expect(within(inbox).queryByRole("region", { name: "Lớp chưa nhập đủ điểm" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("article", { name: "Học viên chưa phân nhóm" })).getByText("12")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Hệ thống thông tin.*3 HV.*Phân nhóm/ })).toHaveAttribute("href", data.sources.grouping.data.items[1].href);
});

it("keeps a failed grouping queue actionable without an empty warning column or a false healthy state", async () => {
  const data = fixture();
  data.permissions = { grouping: true };
  data.sources.grouping = { status: "error" };
  axios.get.mockResolvedValue({ data });
  await open();
  const inbox = screen.getByRole("region", { name: "VIỆC CẦN XỬ LÝ" });
  expect(within(inbox).getByRole("alert")).toHaveTextContent("Chưa tải được dữ liệu.");
  expect(within(inbox).queryByText("Không có mục chờ xử lý")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "CẢNH BÁO" })).not.toBeInTheDocument();
  expect(document.querySelector(".od-main")).toHaveClass("od-main-single");
});

it.each([5, 12])("shows only the first three prioritized warnings out of %s and links to the existing full queue", async (total) => {
  const data = fixture();
  const detail = "Một mô tả cảnh báo dài cần được giữ đầy đủ khi truy cập bằng bàn phím hoặc công nghệ hỗ trợ. ".repeat(7);
  data.sources.teaching.data.progress = { count: total, itemCount: total, href: "/masters/schedule?year=2026&queue=pending-confirmation", items: Array.from({ length: 5 }, (_, index) => ({
    id: `warning-${index}`, title: `Lớp cảnh báo ${index + 1}`, detail,
    href: `/masters/schedule?year=2026&offeringId=o${index}&queue=pending-confirmation`,
  })) };
  axios.get.mockResolvedValue({ data });
  await open();
  const warnings = screen.getByRole("complementary", { name: "CẢNH BÁO" });
  expect(within(warnings).getAllByRole("listitem")).toHaveLength(3);
  expect(within(warnings).getAllByRole("listitem").map((li) => li.querySelector("strong").textContent)).toEqual(["Lớp cảnh báo 1", "Lớp cảnh báo 2", "Lớp cảnh báo 3"]);
  expect(within(warnings).queryByText("Lớp cảnh báo 4")).not.toBeInTheDocument();
  expect(within(warnings).getAllByTitle(detail.trim())).toHaveLength(3);
  const all = within(warnings).getByRole("link", { name: `Xem tất cả ${total} lớp` });
  expect(all).toHaveAttribute("href", data.sources.teaching.data.progress.href);
  const first = within(warnings).getByRole("link", { name: `Lớp cảnh báo 1. ${detail}`.trim() });
  expect(first).toHaveAttribute("aria-label", `Lớp cảnh báo 1. ${detail}`);
  fireEvent.click(first);
  expect(screen.getByTestId("location")).toHaveTextContent("/masters/schedule?year=2026&offeringId=o0&queue=pending-confirmation");
});

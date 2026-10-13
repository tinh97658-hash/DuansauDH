import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import Schedule from "../../features/scheduling/Schedule";

jest.mock("axios");
const majors = [
  { id: "cntt", name: "Công nghệ thông tin", disciplineId: "engineering", discipline: { id: "engineering", name: "Kỹ thuật" } },
  { id: "qtkd", name: "Quản trị kinh doanh", disciplineId: "economics", discipline: { id: "economics", name: "Kinh tế" } },
];
const offerings = [5, 0, 2, 0].map((heldCount, index) => {
  const id = ["A", "B", "C", "D"][index];
  return { id, name: `Lớp ${id}`, status: "active", participantCount: 20,
    subject: { code: `HP-${id}`, name: index === 0 || index === 2 ? "Học phần chung" : "Học phần riêng", credits: 3 },
    sessionSummary: { heldCount, futurePlannedCount: 20 - heldCount },
    groupLinks: [{ classGroup: { id: `g-${id}`, code: `NHOM-${id}`, majorId: index < 2 ? "cntt" : "qtkd",
      academicYear: index % 2 ? "2025" : "2026", allowedWeekdays: [1, 2, 3, 4, 5] } }],
  };
});
const cards = () => Array.from(screen.getByRole("complementary").querySelectorAll("article.sl-card"), card => card.id);
const badge = () => screen.getByRole("heading", { name: /LỚP HỌC PHẦN/ }).querySelector("b");
const sortButton = label => screen.getByRole("button", { name: label });
const openSchedule = async () => {
  render(<MemoryRouter><Schedule user={{ canManageScheduling: true }} /></MemoryRouter>);
  await screen.findByText("Lớp A");
  await waitFor(() => expect(cards()).toHaveLength(4));
};
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation(async url => ({ data: url.includes("/course-offerings?") ? offerings
    : url.includes("/system/majors?") ? majors : [] }));
});

it("cycles DEFAULT → ASC → DESC → DEFAULT immediately while preserving the filtered count badge", async () => {
  await openSchedule();
  expect(cards()).toEqual(["offering-A", "offering-B", "offering-C", "offering-D"]);
  expect(badge()).toHaveTextContent("4");
  fireEvent.click(sortButton("Sắp xếp theo số buổi"));
  expect(cards()).toEqual(["offering-B", "offering-D", "offering-C", "offering-A"]);
  expect(sortButton("Số buổi tăng dần")).toHaveAttribute("aria-pressed", "true");
  expect(within(sortButton("Số buổi tăng dần")).getByTestId("ArrowUpwardRoundedIcon")).toBeInTheDocument();
  expect(badge()).toHaveTextContent("4");
  fireEvent.click(sortButton("Số buổi tăng dần"));
  expect(cards()).toEqual(["offering-A", "offering-C", "offering-B", "offering-D"]);
  expect(within(sortButton("Số buổi giảm dần")).getByTestId("ArrowDownwardRoundedIcon")).toBeInTheDocument();
  fireEvent.click(sortButton("Số buổi giảm dần"));
  expect(cards()).toEqual(["offering-A", "offering-B", "offering-C", "offering-D"]);
  expect(sortButton("Sắp xếp theo số buổi")).toHaveAttribute("aria-pressed", "false");
  expect(badge()).toHaveTextContent("4");
  expect(axios.get.mock.calls.filter(([url]) => url.includes("/course-offerings?"))).toHaveLength(1);
});

it("combines search with ASC and DESC without clearing the search or changing count semantics", async () => {
  await openSchedule();
  const search = screen.getByPlaceholderText("Tìm lớp học phần...");
  fireEvent.change(search, { target: { value: "chung" } });
  expect(cards()).toEqual(["offering-A", "offering-C"]);
  expect(badge()).toHaveTextContent("2");
  fireEvent.click(sortButton("Sắp xếp theo số buổi"));
  expect(cards()).toEqual(["offering-C", "offering-A"]);
  expect(search).toHaveValue("chung");
  fireEvent.click(sortButton("Số buổi tăng dần"));
  expect(cards()).toEqual(["offering-A", "offering-C"]);
  expect(search).toHaveValue("chung");
  expect(badge()).toHaveTextContent("2");
});

it("combines DESC with discipline, major and academic-year filters", async () => {
  await openSchedule();
  fireEvent.click(sortButton("Sắp xếp theo số buổi"));
  fireEvent.click(sortButton("Số buổi tăng dần"));
  fireEvent.click(screen.getByRole("button", { name: "Mở Ngành" }));
  fireEvent.click(within(screen.getByRole("listbox", { name: "Ngành" })).getByRole("option", { name: "Kinh tế" }));
  expect(cards()).toEqual(["offering-C", "offering-D"]);
  fireEvent.click(screen.getByRole("button", { name: "Mở Chuyên ngành" }));
  fireEvent.click(within(screen.getByRole("listbox", { name: "Chuyên ngành" })).getByRole("option", { name: "Quản trị kinh doanh" }));
  expect(cards()).toEqual(["offering-C", "offering-D"]);
  fireEvent.change(screen.getByLabelText("Khóa / Năm"), { target: { value: "2025" } });
  expect(cards()).toEqual(["offering-D"]);
  expect(badge()).toHaveTextContent("1");
  expect(sortButton("Số buổi giảm dần")).toBeInTheDocument();
});

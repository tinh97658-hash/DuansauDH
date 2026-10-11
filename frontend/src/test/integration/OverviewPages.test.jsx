import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Home from "../../pages/viewLogged";
import Procedure from "../../pages/procedurePage";
import Progress from "../../pages/progressReviewPage";
jest.mock("../../components/navbarNew", () => () => <header data-testid="real-shell" />);
function renderPages(path = "/") {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/" element={<Home />} /><Route path="/viewLogged" element={<Home />} />
    <Route path="/procedure" element={<Procedure />} /><Route path="/progressReview" element={<Progress />} />
  </Routes></MemoryRouter>);
}
it("keeps shell, hero copy and exactly three footer routes", () => {
  renderPages();
  expect(screen.getByTestId("real-shell")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("HỆ THỐNG QUẢN LÝĐÀO TẠO SAU ĐẠI HỌC");
  expect(screen.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("aria-current", "page");
  expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/", "/procedure", "/progressReview"]);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("navigates three tabs and shows reference information and procedure note", () => {
  renderPages();
  fireEvent.click(screen.getByRole("link", { name: "Quy trình đào tạo" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Quy trình đào tạo sau đại học");
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getByText("Có xác nhận của giảng viên hướng dẫn và đơn vị chuyên môn theo yêu cầu từng giai đoạn.")).toBeInTheDocument();
  expect(screen.getByText(/Biểu mẫu và mốc thời gian cụ thể/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Quy trình đào tạo" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("link", { name: "Theo dõi tiến độ" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Đánh giá tiến độ học tập và nghiên cứu");
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getByText("Nhận xét của giảng viên hướng dẫn và kết luận của đơn vị chuyên môn.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Theo dõi tiến độ" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("link", { name: "Trang chủ" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("HỆ THỐNG QUẢN LÝ");
});
it("preserves /viewLogged presentation", () => {
  const { container } = renderPages("/viewLogged");
  expect(container.querySelector(".home-hero")).toBeInTheDocument();
  expect(container.querySelector(".overview-hero")).not.toBeInTheDocument();
});

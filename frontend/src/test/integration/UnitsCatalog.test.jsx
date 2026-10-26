import { renderWithPermissions } from "../renderWithPermissions";
import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import Units from "../../pages/system/units";
import Lecturers from "../../pages/system/lecturers";

const render = (ui, options) => renderWithPermissions(ui, ["catalog.manage"], options);

jest.mock("axios");
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../components/FeatureLayout", () => ({ children }) => <div>{children}</div>);

it("fills the screen with a small catalog and remembers independently resized columns", async () => {
  localStorage.clear();
  const size = jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" }
    : [{ id: "unit-ck", code: "CK", name: "Viện Cơ khí", active: true }] }));
  try {
    const view = render(<Units />);
    await screen.findByText("CK");
    const widths = () => screen.getAllByRole("slider").map(handle => Number(handle.getAttribute("aria-valuenow")));
    expect(widths()).toHaveLength(5);
    expect(widths().reduce((sum, width) => sum + width, 0)).toBeCloseTo(1000);
    expect(screen.getByRole("table", { name: "Đơn vị" })).toHaveStyle({ width: "1000px" });
    const name = screen.getByRole("slider", { name: "Độ rộng cột Tên đơn vị" });
    const initial = Number(name.getAttribute("aria-valuenow"));
    fireEvent.keyDown(name, { key: "ArrowRight" });
    expect(Number(name.getAttribute("aria-valuenow"))).toBe(initial + 10);
    expect(widths().reduce((sum, width) => sum + width, 0)).toBeCloseTo(1000);
    view.unmount();
    render(<Units />);
    await screen.findByText("CK");
    expect(screen.getByRole("slider", { name: "Độ rộng cột Tên đơn vị" })).toHaveAttribute("aria-valuenow", String(initial + 10));
  } finally { size.mockRestore(); localStorage.clear(); }
});

it("manages faculty names separately from disciplines and reflects a renamed unit on lecturers", async () => {
  const unit = { id: "unit-ck", code: "CK", name: "Viện Cơ khí", active: true };
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" }
    : url.endsWith("/system/units") ? [unit]
      : [{ id: "gv", code: "GV1", name: "Nguyễn An", unitId: unit.id, unit: { ...unit }, faculty: "Tên cũ", active: true }] }));
  axios.put.mockImplementation(async (url, body) => { Object.assign(unit, body); return { data: unit }; });
  const view = render(<Units />);
  expect(await screen.findByText("Viện Cơ khí")).toBeInTheDocument();
  fireEvent.doubleClick(screen.getByText("Viện Cơ khí"));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tên đơn vị"), { target: { value: "Viện Cơ khí mới" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/system/units/unit-ck"),
    expect.objectContaining({ name: "Viện Cơ khí mới" }), { withCredentials: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(await screen.findByText("Viện Cơ khí mới")).toBeInTheDocument();
  view.unmount();
  render(<Lecturers />);
  expect(await screen.findByText("Viện Cơ khí mới")).toBeInTheDocument();
  expect(screen.queryByText(/chưa liên kết/)).not.toBeInTheDocument();
  expect(axios.get.mock.calls.some(([url]) => url.endsWith("/disciplines"))).toBe(false);
});

it("uses the catalog name in both the lecturer table and picker even when other name fields differ", async () => {
  const unit = { id: "unit-ck", code: "CK", name: "Viện Cơ khí chính xác", active: true };
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" }
    : url.endsWith("/system/units") ? [unit]
      : [{ id: "gv", code: "GV1", name: "Nguyễn An", unitId: unit.id,
        unit: { id: unit.id, name: "Tên quan hệ cũ" }, faculty: "Tên khoa cũ", active: true }] }));
  render(<Lecturers />);
  const cell = await screen.findByRole("cell", { name: unit.name });
  expect(screen.queryByText("Tên quan hệ cũ")).not.toBeInTheDocument();
  expect(screen.queryByText(/Tên khoa cũ/)).not.toBeInTheDocument();
  await screen.findByRole("button", { name: "Thêm mới" });
  fireEvent.doubleClick(cell.closest("tr"));
  const picker = within(screen.getByRole("dialog")).getByRole("button", { name: "Đơn vị" });
  expect(picker).toHaveTextContent(unit.name);
  fireEvent.mouseDown(picker);
  expect(await screen.findByRole("option", { name: unit.name })).toBeInTheDocument();
});

it("opens a popup on double click and preserves a rejected value for correction", async () => {
  const unit = { id: "unit-ck", code: "CK", name: "Viện Cơ khí", active: true };
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" } : [unit] }));
  axios.put.mockReset();
  axios.put.mockRejectedValueOnce({ response: { data: { message: "Mã đã tồn tại" } } })
    .mockImplementationOnce(async (_, body) => { Object.assign(unit, body); return { data: unit }; });
  render(<Units />);
  const nameCell = await screen.findByText("Viện Cơ khí");
  fireEvent.click(nameCell);
  expect(screen.queryByLabelText("Tên đơn vị")).not.toBeInTheDocument();
  fireEvent.doubleClick(nameCell);
  fireEvent.change(screen.getByLabelText("Tên đơn vị"), { target: { value: "Hủy tên này" } });
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText("Viện Cơ khí")).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
  fireEvent.change(screen.getByLabelText("Mã đơn vị"), { target: { value: "DUP" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(await screen.findByText("Mã đã tồn tại")).toBeInTheDocument();
  expect(screen.getByLabelText("Mã đơn vị")).toHaveValue("DUP");
  fireEvent.change(screen.getByLabelText("Mã đơn vị"), { target: { value: "CK2" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole("cell", { name: "CK2" })).toBeInTheDocument());
  expect(axios.put).toHaveBeenLastCalledWith(expect.stringContaining("/system/units/unit-ck"), { code: "CK2", name: unit.name, active: true }, { withCredentials: true });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("does not show a legacy faculty name as a unit when no catalog unit is selected", async () => {
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" }
    : url.endsWith("/system/units") ? []
      : [{ id: "gv", code: "GV1", name: "Nguyễn An", unitId: null, faculty: "Tên khoa ngoài danh mục", active: true }] }));
  render(<Lecturers />);
  expect(await screen.findByRole("cell", { name: "Chưa chọn đơn vị" })).toBeInTheDocument();
  expect(screen.queryByText(/Tên khoa ngoài danh mục/)).not.toBeInTheDocument();
});

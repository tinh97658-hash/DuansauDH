import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import Units from "../../pages/system/units";
import Lecturers from "../../pages/system/lecturers";

jest.mock("axios");
jest.mock("@mui/icons-material", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../components/FeatureLayout", () => ({ children }) => <div>{children}</div>);

it("manages faculty names separately from disciplines and reflects a renamed unit on lecturers", async () => {
  const unit = { id: "unit-ck", code: "CK", name: "Viện Cơ khí", active: true };
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" }
    : url.endsWith("/system/units") ? [unit]
      : [{ id: "gv", code: "GV1", name: "Nguyễn An", unitId: unit.id, unit: { ...unit }, faculty: "Tên cũ", active: true }] }));
  axios.put.mockImplementation(async (url, body) => { Object.assign(unit, body); return { data: unit }; });
  const view = render(<Units />);
  expect(await screen.findByText("Viện Cơ khí")).toBeInTheDocument();
  fireEvent.doubleClick(await screen.findByRole("button", { name: "Sửa" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Tên đơn vị"), { target: { value: "Viện Cơ khí mới" } });
  fireEvent.keyDown(screen.getByLabelText("Tên đơn vị"), { key: "Enter" });
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

it("cancels inline edits and preserves a rejected value so it can be corrected and saved", async () => {
  const unit = { id: "unit-ck", code: "CK", name: "Viện Cơ khí", active: true };
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" } : [unit] }));
  axios.put.mockReset();
  axios.put.mockRejectedValueOnce({ response: { data: { message: "Mã đã tồn tại" } } })
    .mockResolvedValueOnce({ data: { code: "CK2" } });
  render(<Units />);
  const nameCell = await screen.findByRole("button", { name: "Sửa tên đơn vị CK" });
  fireEvent.click(nameCell);
  expect(screen.queryByLabelText("Tên đơn vị")).not.toBeInTheDocument();
  fireEvent.doubleClick(nameCell);
  fireEvent.change(screen.getByLabelText("Tên đơn vị"), { target: { value: "Hủy tên này" } });
  fireEvent.keyDown(screen.getByLabelText("Tên đơn vị"), { key: "Escape" });
  expect(screen.getByText("Viện Cơ khí")).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
  fireEvent.doubleClick(screen.getByRole("button", { name: "Sửa mã đơn vị CK" }));
  fireEvent.change(screen.getByLabelText("Mã đơn vị"), { target: { value: "DUP" } });
  fireEvent.blur(screen.getByLabelText("Mã đơn vị"));
  expect(await screen.findByText("Mã đã tồn tại")).toBeInTheDocument();
  expect(screen.getByLabelText("Mã đơn vị")).toHaveValue("DUP");
  fireEvent.change(screen.getByLabelText("Mã đơn vị"), { target: { value: "CK2" } });
  fireEvent.keyDown(screen.getByLabelText("Mã đơn vị"), { key: "Enter" });
  expect(await screen.findByText("CK2")).toBeInTheDocument();
  expect(axios.put).toHaveBeenLastCalledWith(expect.stringContaining("/system/units/unit-ck"), { code: "CK2" }, { withCredentials: true });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("does not show a legacy faculty name as a unit when no catalog unit is selected", async () => {
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith("/auth/isStaff") ? { message: "admin" }
    : url.endsWith("/system/units") ? []
      : [{ id: "gv", code: "GV1", name: "Nguyễn An", unitId: null, faculty: "Tên khoa ngoài danh mục", active: true }] }));
  render(<Lecturers />);
  expect(await screen.findByRole("cell", { name: "Chưa chọn đơn vị" })).toBeInTheDocument();
  expect(screen.queryByText(/Tên khoa ngoài danh mục/)).not.toBeInTheDocument();
});

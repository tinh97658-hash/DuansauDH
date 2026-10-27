import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { TableBody, TableCell, TableRow } from "@mui/material";
import ResizableTable from "../../components/ResizableTable";

const columns = [
  { key: "name", label: "Họ đệm", width: 160 },
  { key: "email", label: "Email", width: 240 },
];
const table = (freezeThrough) => <ResizableTable columns={columns} storageKey="test-column-widths" freezeThrough={freezeThrough}>
  <TableBody><TableRow><TableCell>Nguyễn Văn</TableCell><TableCell>a@example.com</TableCell></TableRow></TableBody>
</ResizableTable>;
const pointer = (element, type, x) => {
  const event = createEvent[type](element);
  Object.defineProperties(event, {
    clientX: { value: x }, button: { value: 0 }, pointerId: { value: 1 },
  });
  fireEvent(element, event);
};

beforeEach(() => localStorage.clear());

it("shares spare container width evenly, preserves manual resizing, and updates frozen offsets on viewport changes", () => {
  let available = 900;
  const size = jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => available);
  const originalObserver = global.ResizeObserver;
  let measure;
  const disconnect = jest.fn();
  global.ResizeObserver = jest.fn(function (callback) { measure = callback; return { observe: jest.fn(), disconnect }; });
  try {
    const view = render(table("email"));
    const name = screen.getByRole("slider", { name: "Độ rộng cột Họ đệm" });
    const email = screen.getByRole("slider", { name: "Độ rộng cột Email" });
    const emailHeader = screen.getByRole("columnheader", { name: /Email/ });
    expect(name).toHaveAttribute("aria-valuenow", "410");
    expect(email).toHaveAttribute("aria-valuenow", "490");
    expect(emailHeader).toHaveStyle({ left: "410px" });
    fireEvent.keyDown(email, { key: "ArrowRight" });
    expect(email).toHaveAttribute("aria-valuenow", "500");
    expect(name).toHaveAttribute("aria-valuenow", "400");
    expect(JSON.parse(localStorage.getItem("test-column-widths"))).toEqual({ email: 500 });
    available = 1000;
    act(() => measure());
    expect(name).toHaveAttribute("aria-valuenow", "500");
    expect(emailHeader).toHaveStyle({ left: "500px" });
    available = 300;
    act(() => measure());
    expect(name).toHaveAttribute("aria-valuenow", "160");
    expect(email).toHaveAttribute("aria-valuenow", "500");
    expect(screen.getByRole("table")).toHaveStyle({ width: "660px" });
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  } finally { size.mockRestore(); global.ResizeObserver = originalObserver; }
});

it("resizes only the dragged column and remembers its width after remounting", () => {
  const view = render(table());
  const handle = screen.getByRole("slider", { name: "Độ rộng cột Email" });
  handle.setPointerCapture = jest.fn();
  pointer(handle, "pointerDown", 200);
  pointer(handle, "pointerMove", 280);
  expect(handle).toHaveAttribute("aria-valuenow", "240");
  pointer(handle, "pointerUp", 280);
  expect(handle).toHaveAttribute("aria-valuenow", "320");
  expect(screen.getByRole("slider", { name: "Độ rộng cột Họ đệm" })).toHaveAttribute("aria-valuenow", "160");
  view.unmount();
  render(table());
  expect(screen.getByRole("slider", { name: "Độ rộng cột Email" })).toHaveAttribute("aria-valuenow", "320");
});

it("supports keyboard resizing, enforces a minimum width, and auto-fits on double click", () => {
  render(table());
  const handle = screen.getByRole("slider", { name: "Độ rộng cột Email" });
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(handle).toHaveAttribute("aria-valuenow", "250");
  for (let i = 0; i < 30; i += 1) fireEvent.keyDown(handle, { key: "ArrowLeft" });
  expect(handle).toHaveAttribute("aria-valuenow", "60");
  const measure = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 270 });
  try {
    fireEvent.doubleClick(handle);
    expect(Number(handle.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(286);
  } finally { measure.mockRestore(); }
});

it("keeps the previous width when a drag is cancelled", () => {
  render(table());
  const handle = screen.getByRole("slider", { name: "Độ rộng cột Email" });
  handle.setPointerCapture = jest.fn();
  pointer(handle, "pointerDown", 200);
  pointer(handle, "pointerMove", 280);
  pointer(handle, "pointerCancel", 280);
  expect(handle).toHaveAttribute("aria-valuenow", "240");
});

it("keeps frozen headers and cells aligned when preceding columns are resized", () => {
  render(table("email"));
  const nameHeader = screen.getByRole("columnheader", { name: /Họ đệm/ });
  const emailHeader = screen.getByRole("columnheader", { name: /Email/ });
  const nameCell = screen.getByRole("cell", { name: "Nguyễn Văn" });
  const emailCell = screen.getByRole("cell", { name: "a@example.com" });
  expect(nameHeader).toHaveStyle({ position: "sticky", left: "0px" });
  expect(nameCell).toHaveStyle({ position: "sticky", left: "0px" });
  expect(emailHeader).toHaveStyle({ position: "sticky", left: "160px" });
  expect(emailCell).toHaveStyle({ position: "sticky", left: "160px" });
  fireEvent.keyDown(screen.getByRole("slider", { name: "Độ rộng cột Họ đệm" }), { key: "ArrowRight" });
  expect(emailHeader).toHaveStyle({ left: "170px" });
  expect(emailCell).toHaveStyle({ left: "170px" });
});

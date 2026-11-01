import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import DateField from "../../components/DateField";

function Form({ initial = "2026-10-17", ...props }) {
  const [value, setValue] = useState(initial);
  return <><DateField label="Ngày" value={value} onChange={event => setValue(event.target.value)} {...props} />
    <output data-testid="iso">{value}</output></>;
}

it("displays and edits dd/mm/yy while retaining full ISO years in the form", () => {
  render(<Form />);
  const field = screen.getByRole("textbox", { name: "Ngày" });
  expect(field).toHaveValue("17/10/26");
  fireEvent.change(field, { target: { value: "02/11/26" } });
  expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-02");
  fireEvent.change(field, { target: { value: "30/06/2099" } });
  fireEvent.blur(field);
  expect(field).toHaveValue("30/06/99");
  expect(screen.getByTestId("iso")).toHaveTextContent("2099-06-30");
});

it("rejects impossible dates and dates outside bounds, and supports clearing", () => {
  render(<Form min="2026-10-17" />);
  const field = screen.getByRole("textbox", { name: "Ngày" });
  for (const date of ["31/02/26", "16/10/26"]) {
    fireEvent.change(field, { target: { value: date } });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("iso")).toBeEmptyDOMElement();
  }
  fireEvent.change(field, { target: { value: "" } });
  expect(field).toHaveAttribute("aria-invalid", "false");
  expect(field).toHaveAttribute("placeholder", "dd/mm/yy");
});

it("selects a month and year and updates the ISO form value", () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn ngày: Ngày" }));
  const calendar = screen.getByRole("dialog");
  fireEvent.change(within(calendar).getByRole("combobox", { name: "Năm" }), { target: { value: "2027" } });
  fireEvent.change(within(calendar).getByRole("combobox", { name: "Tháng" }), { target: { value: "1" } });
  fireEvent.click(within(calendar).getByRole("button", { name: "02/01/27" }));
  expect(screen.getByRole("textbox", { name: "Ngày" })).toHaveValue("02/01/27");
  expect(screen.getByTestId("iso")).toHaveTextContent("2027-01-02");
});

it("revalidates an existing end date when the start-date bound changes", () => {
  const { rerender } = render(<Form min="2026-10-17" />);
  const field = screen.getByRole("textbox", { name: "Ngày" });
  expect(field).toHaveAttribute("aria-invalid", "false");
  rerender(<Form min="2026-10-18" />);
  expect(field).toHaveValue("17/10/26");
  expect(field).toHaveAttribute("aria-invalid", "true");
  rerender(<Form min="2026-10-16" />);
  expect(field).toHaveAttribute("aria-invalid", "false");
});

it("opens the shared calendar and picks a short display date with an ISO form value", () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn ngày: Ngày" }));
  const calendar = screen.getByRole("dialog", { name: "Chọn ngày: Ngày" });
  expect(calendar).toHaveClass("app-date-calendar");
  expect(within(calendar).getByRole("button", { name: "17/10/26" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(calendar).getByRole("button", { name: "Tháng sau" }));
  fireEvent.click(within(calendar).getByRole("button", { name: "02/11/26" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Ngày" })).toHaveValue("02/11/26");
  expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-02");
});

it("enforces date bounds in the calendar and allows clearing", () => {
  render(<Form min="2026-10-17" max="2026-10-20" />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn ngày: Ngày" }));
  const calendar = screen.getByRole("dialog");
  expect(within(calendar).getByRole("button", { name: "16/10/26" })).toBeDisabled();
  expect(within(calendar).getByRole("button", { name: "21/10/26" })).toBeDisabled();
  expect(within(calendar).getByRole("button", { name: "Tháng trước" })).toBeDisabled();
  expect(within(calendar).getByRole("button", { name: "Tháng sau" })).toBeDisabled();
  fireEvent.click(within(calendar).getByRole("button", { name: "Xóa" }));
  expect(screen.getByTestId("iso")).toBeEmptyDOMElement();
  expect(screen.getByRole("textbox", { name: "Ngày" })).toHaveValue("");
});

it("does not open a calendar for a read-only field", () => {
  render(<Form readOnly />);
  expect(screen.getByRole("button", { name: "Chọn ngày: Ngày" })).toBeDisabled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

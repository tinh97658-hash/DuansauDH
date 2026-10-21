import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

it("keeps the native calendar and updates the same ISO form value", () => {
  const { container } = render(<Form />);
  fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: "2027-01-02" } });
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

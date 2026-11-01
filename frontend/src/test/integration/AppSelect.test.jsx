import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import AppSelect from "../../components/AppSelect";

function Form() {
  const [period, setPeriod] = useState("MORNING");
  return <><label>Buổi thi<AppSelect value={period} onChange={event => setPeriod(event.target.value)}>
    <option value="MORNING">Sáng</option><option value="AFTERNOON">Chiều</option>
    <option value="CLOSED" disabled>Đã khóa</option>
  </AppSelect></label><output data-testid="value">{period}</output></>;
}

it("opens a shared menu instead of the platform picker and retains form values", () => {
  render(<Form />);
  const select = screen.getByRole("combobox", { name: "Buổi thi" });
  expect(fireEvent.mouseDown(select, { button: 0 })).toBe(false);
  const menu = screen.getByRole("listbox");
  expect(within(menu).getByRole("option", { name: "Sáng" })).toHaveAttribute("aria-selected", "true");
  expect(within(menu).getByRole("option", { name: "Đã khóa" })).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(within(menu).getByRole("option", { name: "Chiều" }));
  expect(select).toHaveValue("AFTERNOON");
  expect(screen.getByTestId("value")).toHaveTextContent("AFTERNOON");
});

it("opens with the keyboard and allows cancelling without changing selection", () => {
  render(<Form />);
  const select = screen.getByRole("combobox", { name: "Buổi thi" });
  fireEvent.keyDown(select, { key: "ArrowDown" });
  const menu = screen.getByRole("listbox");
  fireEvent.keyDown(menu, { key: "Escape" });
  expect(select).toHaveValue("MORNING");
  expect(select).toHaveAttribute("aria-expanded", "false");
});

it("opens the same menu on touch and does not open disabled controls", () => {
  const { rerender } = render(<AppSelect aria-label="Buổi" value="AM" onChange={() => {}}><option value="AM">Sáng</option></AppSelect>);
  const select = screen.getByRole("combobox", { name: "Buổi" });
  const touch = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperty(touch, "pointerType", { value: "touch" });
  fireEvent(select, touch);
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  rerender(<AppSelect aria-label="Buổi" disabled value="AM"><option value="AM">Sáng</option></AppSelect>);
  expect(select).toBeDisabled();
  expect(select).toHaveAttribute("aria-expanded", "false");
});

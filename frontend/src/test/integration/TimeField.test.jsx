import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import TimeField from "../../components/TimeField";

function Form({ initial = "09:00", ...props }) {
  const [value, setValue] = useState(initial);
  return <><TimeField aria-label="Kết thúc" value={value} onChange={event => setValue(event.target.value)} {...props} />
    <output data-testid="time">{value}</output></>;
}

it("uses the shared picker for hours, minutes and morning/afternoon while retaining 24-hour values", () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn giờ: Kết thúc" }));
  const picker = screen.getByRole("dialog", { name: "Chọn giờ: Kết thúc" });
  expect(picker).toHaveClass("app-time-picker");
  for (const [group, selected] of [["Giờ", "09"], ["Phút", "00"], ["Buổi", "SA"]]) {
    expect(within(within(picker).getByRole("group", { name: group })).getByRole("button", { name: selected })).toHaveAttribute("aria-pressed", "true");
  }
  fireEvent.click(within(within(picker).getByRole("group", { name: "Buổi" })).getByRole("button", { name: "CH" }));
  fireEvent.click(within(within(picker).getByRole("group", { name: "Phút" })).getByRole("button", { name: "30" }));
  expect(screen.getByTestId("time")).toHaveTextContent("21:30");
  fireEvent.click(within(picker).getByRole("button", { name: "Xong" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Kết thúc" })).toHaveValue("21:30");
});

it.each([["00:15", "12:15"], ["12:15", "00:15"]])("handles midnight and noon correctly from %s", (initial, expected) => {
  render(<Form initial={initial} />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn giờ: Kết thúc" }));
  const period = within(screen.getByRole("dialog")).getByRole("group", { name: "Buổi" });
  fireEvent.click(within(period).getByRole("button", { name: initial === "00:15" ? "CH" : "SA" }));
  expect(screen.getByTestId("time")).toHaveTextContent(expected);
});

it("retains the last valid time during partial typing and rejects invalid hours", () => {
  render(<Form />);
  const input = screen.getByRole("textbox", { name: "Kết thúc" });
  fireEvent.change(input, { target: { value: "2" } });
  expect(screen.getByTestId("time")).toHaveTextContent("09:00");
  fireEvent.change(input, { target: { value: "25:00" } });
  fireEvent.blur(input);
  expect(input).toHaveValue("09:00");
  fireEvent.change(input, { target: { value: "10:45" } });
  expect(screen.getByTestId("time")).toHaveTextContent("10:45");
});

it("does not open a picker for locked fields", () => {
  render(<Form disabled />);
  expect(screen.getByRole("button", { name: "Chọn giờ: Kết thúc" })).toBeDisabled();
});

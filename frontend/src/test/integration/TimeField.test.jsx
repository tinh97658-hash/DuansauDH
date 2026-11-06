import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import TimeField from "../../components/TimeField";

function Form({ initial = "09:00", ...props }) {
  const [value, setValue] = useState(initial);
  return <><TimeField aria-label="Kết thúc" value={value} onChange={event => setValue(event.target.value)} {...props} />
    <output data-testid="time">{value}</output></>;
}

it("edits a compact digital clock with exact hours and minutes", () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn giờ: Kết thúc" }));
  const picker = screen.getByRole("dialog", { name: "Chọn giờ: Kết thúc" });
  expect(picker).toHaveClass("app-time-picker");
  expect(within(picker).getByRole('spinbutton',{name:'Giờ chính xác'})).toHaveValue('09');
  expect(within(picker).getByRole('spinbutton',{name:'Phút chính xác'})).toHaveValue('00');
  expect(within(picker).queryByRole("group", { name: "Buổi" })).not.toBeInTheDocument();
  fireEvent.change(within(picker).getByRole('spinbutton',{name:'Giờ chính xác'}),{target:{value:'21'}});
  fireEvent.change(within(picker).getByRole('spinbutton',{name:'Phút chính xác'}),{target:{value:'30'}});
  expect(screen.getByTestId("time")).toHaveTextContent("21:30");
  fireEvent.click(within(picker).getByRole("button", { name: "Xong" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Kết thúc" })).toHaveValue("21:30");
});

it.each([["00:15", "12:15"], ["12:15", "00:15"]])("handles midnight and noon correctly from %s", (initial, expected) => {
  render(<Form initial={initial} />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn giờ: Kết thúc" }));
  const hours = within(screen.getByRole("dialog")).getByRole("group", { name: "Giờ" });
  fireEvent.change(within(hours).getByRole('spinbutton'),{target:{value:expected.slice(0,2)}});
  expect(screen.getByTestId("time")).toHaveTextContent(expected);
});

it("accepts exact minutes and restores the previous valid value after invalid typing", () => {
  render(<Form initial="23:17" />);
  fireEvent.click(screen.getByRole("button", { name: "Chọn giờ: Kết thúc" }));
  const minute = screen.getByRole("spinbutton", { name: "Phút chính xác" });
  expect(minute).toHaveValue('17');
  fireEvent.focus(minute);
  fireEvent.change(minute, { target: { value: "59" } });
  expect(screen.getByTestId("time")).toHaveTextContent("23:59");
  fireEvent.change(minute, { target: { value: "60" } });
  fireEvent.blur(minute);
  expect(screen.getByTestId("time")).toHaveTextContent("23:59");
  expect(minute).toHaveValue('59');
});

it('carries minutes across midnight and supports keyboard adjustments',()=>{
  render(<Form initial="23:59"/>);
  fireEvent.click(screen.getByRole('button',{name:'Chọn giờ: Kết thúc'}));
  fireEvent.click(screen.getByRole('button',{name:'Tăng phút'}));
  expect(screen.getByTestId('time')).toHaveTextContent('00:00');
  fireEvent.click(screen.getByRole('button',{name:'Giảm phút'}));
  expect(screen.getByTestId('time')).toHaveTextContent('23:59');
  fireEvent.keyDown(screen.getByRole('spinbutton',{name:'Giờ chính xác'}),{key:'ArrowUp'});
  expect(screen.getByTestId('time')).toHaveTextContent('00:59');
  fireEvent.keyDown(screen.getByRole('spinbutton',{name:'Phút chính xác'}),{key:'Enter'});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

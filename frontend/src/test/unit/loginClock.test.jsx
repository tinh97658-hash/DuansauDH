import React from "react";
import { act, render, screen } from "@testing-library/react";
import LoginClock from "../../components/loginClock";

describe("login Vietnam clock", () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-16T15:04:05Z")); });
  afterEach(() => { jest.useRealTimers(); });
  it("formats UTC+7 and updates every second", () => {
    const { unmount } = render(<LoginClock />);
    expect(screen.getByText("22:04:05 GMT+7")).toHaveAttribute("datetime", "2026-10-16T15:04:05.000Z");
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText("22:04:06 GMT+7")).toBeInTheDocument();
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});

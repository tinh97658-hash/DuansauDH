import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppearanceSettingsProvider, FONT_SIZE_KEY } from "../../context/AppearanceSettings";
import Appearance from "../../pages/system/appearance";

vi.mock("../../components/FeatureLayout", () => ({ default: ({ children }) => <main>{children}</main> }));
const view = () => render(<AppearanceSettingsProvider><Appearance /></AppearanceSettingsProvider>);

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("applies, persists, restores and resets the selected size", () => {
  const first = view();
  expect(screen.getByRole("radio", { name: "Mặc định (100%)" })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: "150%" }));
  expect(document.documentElement).toHaveAttribute("data-font-size", "150");
  expect(localStorage.getItem(FONT_SIZE_KEY)).toBe("150");
  first.unmount();
  view();
  expect(screen.getByRole("radio", { name: "150%" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Khôi phục mặc định" }));
  expect(document.documentElement).toHaveAttribute("data-font-size", "100");
  expect(localStorage.getItem(FONT_SIZE_KEY)).toBe("100");
});

it("ignores invalid saved sizes and synchronizes changes from another tab", async () => {
  localStorage.setItem(FONT_SIZE_KEY, "999");
  view();
  expect(screen.getByRole("radio", { name: "Mặc định (100%)" })).toBeChecked();
  localStorage.setItem(FONT_SIZE_KEY, "110");
  fireEvent(window, new StorageEvent("storage", { key: FONT_SIZE_KEY, newValue: "110" }));
  await waitFor(() => expect(screen.getByRole("radio", { name: "Lớn (110%)" })).toBeChecked());
});

it("still applies the size when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  view();
  fireEvent.click(screen.getByRole("radio", { name: "Nhỏ (90%)" }));
  expect(document.documentElement).toHaveAttribute("data-font-size", "90");
  expect(screen.getByRole("alert")).toHaveTextContent("chỉ được áp dụng trong phiên hiện tại");
});

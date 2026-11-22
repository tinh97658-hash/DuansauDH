import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppearanceSettingsProvider, FONT_SIZE_KEY } from "../../context/AppearanceSettings";
import { AuthSessionContext } from "../../context/AuthSession";
import RibbonHeader from "../../components/RibbonHeader";
import Appearance from "../../pages/system/appearance";

vi.mock("../../components/FeatureLayout", () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock("../../features/notifications/NotificationBell", () => ({ default: () => <div data-testid="bell" /> }));
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

it("deduplicates matching tab/group breadcrumbs and switches font size from the header menu", async () => {
  render(
    <MemoryRouter initialEntries={["/plan/training-plan"]}>
      <AuthSessionContext.Provider value={{ user: { role: "custom" }, access: { permissions: ["plan.view"], roles: [] } }}>
        <AppearanceSettingsProvider>
          <RibbonHeader />
        </AppearanceSettingsProvider>
      </AuthSessionContext.Provider>
    </MemoryRouter>,
  );

  const breadcrumb = screen.getByRole("navigation", { name: "Vị trí hiện tại" });
  expect([...breadcrumb.querySelectorAll("button, strong")].map((item) => item.textContent)).toEqual([
    "Kế hoạch khóa mới",
    "Kế hoạch đào tạo",
  ]);

  const fontTrigger = screen.getByRole("button", { name: "Cỡ chữ giao diện: 100%" });
  fireEvent.click(fontTrigger);
  const menu = await screen.findByRole("menu", { name: "Cỡ chữ giao diện" });
  fireEvent.click(within(menu).getByRole("menuitem", { name: "150%" }));

  expect(document.documentElement).toHaveAttribute("data-font-size", "150");
  expect(localStorage.getItem(FONT_SIZE_KEY)).toBe("150");
  expect(screen.getByRole("button", { name: "Cỡ chữ giao diện: 150%" })).toBeInTheDocument();
});

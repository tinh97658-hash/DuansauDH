import { fireEvent } from "@testing-library/react";
import { listenForBackgroundRefresh } from "../../utils/backgroundRefresh";

let stop;
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); });
afterEach(() => { stop?.(); vi.restoreAllMocks(); vi.useRealTimers(); });

it("skips fresh data and coalesces focus, visibility and polling into one refresh", () => {
  const refresh = vi.fn();
  stop = listenForBackgroundRefresh(refresh, { interval: 30000 });
  fireEvent.focus(window);
  expect(refresh).not.toHaveBeenCalled();
  vi.advanceTimersByTime(30000);
  fireEvent.focus(window);
  fireEvent(document, new Event("visibilitychange"));
  expect(refresh).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(30000);
  expect(refresh).toHaveBeenCalledTimes(2);
});

it("skips hidden tabs, busy requests and focus on individual controls", () => {
  let busy = true;
  const refresh = vi.fn();
  stop = listenForBackgroundRefresh(refresh, { canRefresh: () => !busy });
  vi.advanceTimersByTime(30000);
  fireEvent.focus(window);
  busy = false;
  const input = document.createElement("input");
  document.body.appendChild(input);
  fireEvent.focus(input);
  input.remove();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(refresh).not.toHaveBeenCalled();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  fireEvent.focus(window);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("removes listeners and polling on unmount", () => {
  const refresh = vi.fn();
  stop = listenForBackgroundRefresh(refresh, { interval: 30000 });
  stop();
  vi.advanceTimersByTime(60000);
  fireEvent.focus(window);
  fireEvent(document, new Event("visibilitychange"));
  expect(refresh).not.toHaveBeenCalled();
});

it("accepts a native window focus event after the freshness interval", () => {
  const refresh = vi.fn();
  stop = listenForBackgroundRefresh(refresh);
  vi.advanceTimersByTime(31000);
  window.dispatchEvent(new Event("focus"));
  expect(refresh).toHaveBeenCalledTimes(1);
});

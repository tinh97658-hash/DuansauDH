import { act, fireEvent, renderHook } from "@testing-library/react";
import { useLoad } from "../../features/scheduling/shared";

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it("preserves data on background refresh, coalesces events and lets explicit reload bypass freshness", async () => {
  let finish;
  const loader = vi.fn().mockResolvedValueOnce("initial").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result, unmount } = renderHook(() => useLoad(loader, []));
  await act(async () => {});
  await act(async () => { fireEvent.focus(window); });
  expect(loader).toHaveBeenCalledTimes(1);
  await act(async () => {
    vi.advanceTimersByTime(30000);
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
  });
  expect(loader).toHaveBeenCalledTimes(2);
  expect(result.current.data).toBe("initial");
  expect(result.current.loading).toBe(false);
  await act(async () => { vi.advanceTimersByTime(30000); fireEvent.focus(window); });
  expect(loader).toHaveBeenCalledTimes(2);
  await act(async () => { finish("updated"); });
  await act(async () => { result.current.reload(); });
  expect(loader).toHaveBeenCalledTimes(3);
  unmount();
});

it("aborts old scopes and ignores their late responses", async () => {
  const requests = [];
  const loader = vi.fn(signal => new Promise(resolve => requests.push({ signal, resolve })));
  const { result, rerender, unmount } = renderHook(({ scope }) => useLoad(loader, [scope]), { initialProps: { scope: "one" } });
  await act(async () => {});
  rerender({ scope: "two" });
  await act(async () => {});
  expect(requests[0].signal.aborted).toBe(true);
  await act(async () => { requests[1].resolve("new"); requests[0].resolve("old"); });
  expect(result.current.data).toBe("new");
  unmount();
  expect(requests[1].signal.aborted).toBe(true);
});

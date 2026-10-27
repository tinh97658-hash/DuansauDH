import { act, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
afterEach(() => vi.restoreAllMocks());
import { useLoad } from '../../features/scheduling/shared';

it('aborts the obsolete request and ignores its result when scope changes', async () => {
  const requests = [];
  const loader = vi.fn((scope, signal) => new Promise(resolve => requests.push({ scope, signal, resolve })));
  const { result, rerender, unmount } = renderHook(({ scope }) => useLoad(signal => loader(scope, signal), [scope]), {
    initialProps: { scope: 'first' },
  });
  await waitFor(() => expect(requests).toHaveLength(1));
  rerender({ scope: 'second' });
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0].signal.aborted).toBe(true);
  await act(async () => { requests[1].resolve('current'); });
  await waitFor(() => expect(result.current.data).toBe('current'));
  await act(async () => { requests[0].resolve('obsolete'); });
  expect(result.current.data).toBe('current');
  unmount();
  expect(requests[1].signal.aborted).toBe(true);
});

it('does not issue duplicate visibility refreshes while a request is still running', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const requests = [];
  const loader = vi.fn(() => new Promise(resolve => requests.push(resolve)));
  const { result } = renderHook(() => useLoad(loader, []));
  await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
  fireEvent(document, new Event('visibilitychange')); fireEvent(document, new Event('visibilitychange'));
  expect(loader).toHaveBeenCalledTimes(1);
  await act(async () => { requests[0]('initial'); });
  await waitFor(() => expect(result.current.loading).toBe(false));
  fireEvent(document, new Event('visibilitychange'));
  await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
  expect(result.current.data).toBe('initial');
  expect(result.current.loading).toBe(false);
  await act(async () => { requests[1]('refreshed'); });
  await waitFor(() => expect(result.current.data).toBe('refreshed'));
});

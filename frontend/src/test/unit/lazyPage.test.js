import { lazyPage, preloadPage } from '../../utils/lazyPage';

it('preloads code once for a dynamic route without rendering a page', async () => {
  const loader = vi.fn().mockResolvedValue({ default: () => null });
  lazyPage(loader, ['/test-records/:id']);
  preloadPage('/test-records/a?tab=leave');
  preloadPage('/test-records/b');
  await Promise.resolve();
  expect(loader).toHaveBeenCalledTimes(1);
});

it('chooses an exact route before a dynamic route', () => {
  const detail = vi.fn().mockResolvedValue({ default: () => null });
  const preview = vi.fn().mockResolvedValue({ default: () => null });
  lazyPage(detail, ['/test-preview/:id']);
  lazyPage(preview, ['/test-preview/preview']);
  preloadPage('/test-preview/preview');
  expect(preview).toHaveBeenCalledTimes(1);
  expect(detail).not.toHaveBeenCalled();
});

it('allows retry after a failed speculative load and ignores unknown routes', async () => {
  const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ default: () => null });
  lazyPage(loader, ['/test-retry']);
  preloadPage('/test-retry');
  await Promise.resolve();
  await Promise.resolve();
  preloadPage('/test-retry');
  preloadPage(null);
  preloadPage('/unknown');
  expect(loader).toHaveBeenCalledTimes(2);
});

// Transfer a frozen document to its own tab; session storage also supports reload.
export function openDocumentPreview({ prefix, path, snapshot, fallbackToCurrentTab = true }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const key = `${prefix}${id}`;
  const value = JSON.stringify({ ...snapshot, version: 1 });
  try { window.sessionStorage.setItem(key, value); }
  catch { throw new Error("Không thể lưu bản xem trước. Vui lòng cho phép trình duyệt lưu dữ liệu phiên và thử lại."); }
  const url = `${path}?${new URLSearchParams({ preview: id })}`;
  const tab = window.open("about:blank", "_blank");
  if (tab) {
    try {
      tab.sessionStorage.setItem(key, value);
      tab.opener = null;
      tab.location.replace(url);
    } catch {
      tab.close();
      throw new Error("Không thể mở bản xem trước. Vui lòng thử lại.");
    }
  } else if (fallbackToCurrentTab) {
    window.location.assign(url);
  } else {
    throw new Error("Trình duyệt đã chặn tab xem trước. Vui lòng cho phép mở tab mới và chọn Xuất PDF lại.");
  }
}

export function downloadDocumentFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

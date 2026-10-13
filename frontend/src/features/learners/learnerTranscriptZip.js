async function bytesOf(blob) {
  if (typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result)); reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function packTranscriptZip(documents, format) {
  if (!["word", "pdf"].includes(format) || !documents.length) throw new Error("Không có bảng điểm hợp lệ để đóng gói.");
  const extension = format === "pdf" ? "pdf" : "docx";
  const used = new Set();
  for (const { filename, blob } of documents) {
    if (!filename || filename.length > 240 || /[\p{Cc}<>:"/\\|?*]/u.test(filename) || filename.includes("..")
      || filename.startsWith(".") || !filename.endsWith(`.${extension}`) || !blob?.size) {
      throw new Error("Tên file hoặc nội dung bảng điểm không hợp lệ.");
    }
    const key = filename.normalize("NFC").toLocaleLowerCase("vi");
    if (used.has(key)) throw new Error("Tên file bảng điểm trùng lặp.");
    used.add(key);
  }
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const { filename, blob } of documents) zip.file(filename, await bytesOf(blob));
  // Only requested documents are included; no debug payloads or hidden manifest.
  return zip.generateAsync({ type: "blob", mimeType: "application/zip", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

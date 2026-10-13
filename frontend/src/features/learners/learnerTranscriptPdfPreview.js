import { createLearnerTranscriptPdf } from "./learnerTranscriptPdf";

// The caller reserves the window synchronously in the click handler.
export async function openLearnerTranscriptPdfPreview(transcript, tab, { isCancelled = () => false } = {}) {
  const blob = await createLearnerTranscriptPdf(transcript);
  if (isCancelled() || tab.closed) return;
  if (blob.type !== "application/pdf") throw new Error("Không tạo được bản PDF để xem trước.");
  const url = URL.createObjectURL(blob);
  let timer;
  const release = () => {
    window.clearInterval(timer);
    window.removeEventListener("pagehide", release);
    URL.revokeObjectURL(url);
  };
  try {
    tab.location.replace(url);
    // Keep the Blob available while the native PDF viewer uses it. Release on
    // window closure or when the originating document is unloaded.
    timer = window.setInterval(() => { if (tab.closed) release(); }, 1000);
    window.addEventListener("pagehide", release, { once: true });
  } catch (error) {
    release();
    throw error;
  }
}

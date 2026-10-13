import JSZip from "jszip";
import { packTranscriptZip } from "../../features/learners/learnerTranscriptZip";
const bufferOf = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
it.each([1, 3])("packs exactly %s nonempty Unicode entries without extra files", async count => {
  const documents = Array.from({ length: count }, (_, index) => ({ filename: `Bang-diem-Nguyễn An-student-${index}.pdf`, blob: new Blob([`%PDF-${index}`]) }));
  const blob = await packTranscriptZip(documents, "pdf");
  expect(blob.type).toBe("application/zip");
  const zip = await JSZip.loadAsync(await bufferOf(blob));
  expect(Object.keys(zip.files)).toEqual(documents.map(document => document.filename));
  for (const [index, document] of documents.entries()) expect(await zip.file(document.filename).async("string")).toBe(`%PDF-${index}`);
});
it.each(["../x.pdf", "/x.pdf", "C:\\x.pdf", "x?.pdf", "x\n.pdf", ".hidden.pdf", "x.docx"])("rejects unsafe or mixed-format entry %s", async filename => {
  await expect(packTranscriptZip([{ filename, blob: new Blob(["pdf"]) }], "pdf")).rejects.toThrow("không hợp lệ");
});
it("rejects empty data and case/Unicode-normalized collisions rather than overwriting files", async () => {
  await expect(packTranscriptZip([], "pdf")).rejects.toThrow();
  await expect(packTranscriptZip([{ filename: "x.pdf", blob: new Blob([]) }], "pdf")).rejects.toThrow();
  const entries = ["Nguyễn.pdf", "NGUYỄN.pdf".normalize("NFD")].map(filename => ({ filename, blob: new Blob(["pdf"]) }));
  await expect(packTranscriptZip(entries, "pdf")).rejects.toThrow("trùng lặp");
});

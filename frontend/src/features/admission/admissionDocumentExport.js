import { downloadDocumentFile, openDocumentPreview } from "../../utils/documentFiles";

const PREVIEW_PREFIX = "admission-preview:";
export function openAdmissionPreview(document) {
  openDocumentPreview({ prefix: PREVIEW_PREFIX, path: "/plan/admission-records/preview", snapshot: document, fallbackToCurrentTab: false });
}

export function readAdmissionPreview(id) {
  if (!id) return null;
  try {
    const data = JSON.parse(window.sessionStorage.getItem(`${PREVIEW_PREFIX}${id}`));
    const strings = (values) => values.every((value) => typeof value === "string");
    const field = (value) => value && strings([value.label, value.value]);
    return data?.version === 1 && strings([data.title, data.subtitle, data.displayCode, data.dateLine, data.fullName, data.photo, data.checklistTitle, data.filename])
      && Array.isArray(data.masthead) && data.masthead.length === 3 && strings(data.masthead)
      && Array.isArray(data.nationalHeading) && data.nationalHeading.length === 2 && strings(data.nationalHeading)
      && Array.isArray(data.sections) && data.sections.length === 3 && field(data.sections[0].extra) && data.sections.every((section) => typeof section.title === "string"
        && Array.isArray(section.fields) && section.fields.every(field) && (!section.extra || field(section.extra)))
      && Array.isArray(data.documents) && data.documents.every((item) => strings([item.key, item.label]) && typeof item.checked === "boolean")
      && Array.isArray(data.signatures) && data.signatures.length === 3 && data.signatures.every((item) => strings([item.date, item.title, item.instruction, item.name])) ? data : null;
  } catch { return null; }
}

async function photoForWord(source) {
  const match = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(source);
  if (match) return { type: /^jpe?g$/i.test(match[1]) ? "jpg" : match[1].toLowerCase(),
    data: Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0)) };
  // Other browser-supported uploads (e.g. WebP) need a PNG for Word.
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 270; canvas.height = 360;
        const context = canvas.getContext("2d");
        const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
        context.drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale);
        resolve(photoForWord(canvas.toDataURL("image/png")));
      } catch { reject(new Error("Không thể đưa ảnh hồ sơ vào Word. Vui lòng kiểm tra ảnh và thử lại.")); }
    };
    image.onerror = () => reject(new Error("Không thể tải ảnh hồ sơ để xuất Word. Vui lòng kiểm tra ảnh và thử lại."));
    image.src = source;
  });
}

export async function createAdmissionWord(data) {
  const { AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } = await import("docx");
  const paragraph = (text, { bold = false, italic = false, center = false, size = 18, after = 25, before = 0, keepNext = false } = {}) => new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before, after, line: 230 }, keepNext,
    children: [new TextRun({ text: String(text), bold, italics: italic, size })],
  });
  const noBorders = Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, { style: BorderStyle.NIL }]));
  const table = (widths, rows) => new Table({
    width: { size: widths.reduce((sum, width) => sum + width, 0), type: WidthType.DXA },
    columnWidths: widths, layout: TableLayoutType.FIXED, borders: noBorders,
    margins: { top: 15, bottom: 15, left: 0, right: 60 },
    rows: rows.map((cells) => new TableRow({ cantSplit: true, children: cells.map((children, index) => new TableCell({
      width: { size: widths[index], type: WidthType.DXA }, children,
    })) })),
  });
  const width = 11906 - 2 * 737;
  const heading = (text) => paragraph(text, { bold: true, size: 19, before: 90, after: 45, keepNext: true });
  const field = (item) => new Paragraph({ spacing: { after: 20, line: 230 }, children: [
    new TextRun({ text: `${item.label} `, bold: true, size: 18 }),
    new TextRun({ text: item.uppercase ? item.value.toUpperCase() : item.value, bold: !!item.bold, size: 18 }),
  ] });
  const fieldsTable = (fields, availableWidth = width) => table([Math.round(availableWidth * 1.2 / 2.2), availableWidth - Math.round(availableWidth * 1.2 / 2.2)],
    Array.from({ length: Math.ceil(fields.length / 2) }, (_, index) => [fields[index * 2], fields[index * 2 + 1]].map((item) => item ? [field(item)] : [paragraph("")])));
  const photo = data.photo
    ? new Paragraph({ children: [new ImageRun({ ...await photoForWord(data.photo), transformation: { width: 90, height: 120 }, altText: { name: "Ảnh 3x4", title: "Ảnh hồ sơ", description: data.fullName } })] })
    : paragraph("Ảnh 3x4\n(Đóng dấu giáp lai)", { center: true, italic: true, size: 16 });
  const content = [
    table([Math.round(width * 1.1 / 2.1), width - Math.round(width * 1.1 / 2.1)], [[
      [...data.masthead.map((line, index) => paragraph(line, { bold: true, center: true, size: index === 1 ? 18 : 17 })), paragraph(`Số HS: ${data.displayCode}`, { center: true, italic: true, size: 16 })],
      [...data.nationalHeading.map((line) => paragraph(line, { bold: true, center: true, size: 17 })), paragraph(data.dateLine, { center: true, italic: true, size: 16 })],
    ]]),
    paragraph(data.title, { bold: true, center: true, size: 25, before: 140, after: 40, keepNext: true }),
    paragraph(data.subtitle, { italic: true, center: true, size: 18, after: 100, keepNext: true }),
    table([1530, width - 1530], [[[photo], [heading(data.sections[0].title), fieldsTable(data.sections[0].fields, width - 1530), field(data.sections[0].extra)]]]),
    ...data.sections.slice(1).flatMap((section) => [heading(section.title), fieldsTable(section.fields), ...(section.extra ? [field(section.extra)] : [])]),
    heading(data.checklistTitle),
    table([2608, 2608, 2608, width - 7824], Array.from({ length: Math.ceil(data.documents.length / 4) }, (_, index) =>
      data.documents.slice(index * 4, index * 4 + 4).map((item) => [paragraph(`${item.checked ? "☑" : "☐"} ${item.label}`, { size: 17 })]))),
    table([3365, 3702, width - 7067], [data.signatures.map((signature) => [
      paragraph(signature.date, { center: true, italic: true, size: 16, before: 100 }),
      paragraph(signature.title, { center: true, bold: true, size: 18 }),
      paragraph(signature.instruction, { center: true, italic: true, size: 16, after: 630 }),
      paragraph(signature.name.toUpperCase(), { center: true, bold: true, size: 18 }),
    ])]),
  ];
  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 18 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 567, bottom: 567, left: 737, right: 737 } } }, children: content }],
  });
  return Packer.toBlob(doc);
}

export async function downloadAdmissionWord(document) {
  downloadDocumentFile(await createAdmissionWord(document), document.filename);
}

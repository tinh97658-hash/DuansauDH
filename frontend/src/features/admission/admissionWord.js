// Editable Word form. Page/typography choices are shared with admissionPrint.css.
export async function createFormattedAdmissionWord(data, photoForWord) {
  const { AlignmentType, BorderStyle, Document, HeightRule, ImageRun, Packer, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType } = await import("docx");
  const width = 9354; // 165 mm between 30 mm left and 15 mm right margins.
  const nil = Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(side => [side, { style: BorderStyle.NIL }]));
  const blackBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const run = (text, options = {}) => new TextRun({ text, font: "Times New Roman", color: "000000", size: 21, ...options });
  const p = (text, { bold = false, italic = false, size = 21, center = false, before = 0, after = 60, keepNext = false, pageBreakBefore = false, characterSpacing } = {}) => new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before, after: text ? Math.max(60, after) : after, line: 240 }, keepNext, keepLines: true, pageBreakBefore,
    children: [run(text, { bold, italics: italic, size, characterSpacing })],
  });
  const blank = () => p("", { size: 2, after: 0 });
  // Word paragraph borders span their available width unless BOTH indents are set.
  const shortRule = columnWidth => new Paragraph({
    indent: { left: Math.floor((columnWidth - 1814) / 2), right: Math.ceil((columnWidth - 1814) / 2) },
    border: { bottom: { ...blackBorder, space: 0 } },
    spacing: { before: 0, after: 60, line: 20 },
    children: [run("", { size: 2 })],
  });
  const table = (widths, rows) => new Table({
    width: { size: widths.reduce((sum, n) => sum + n, 0), type: WidthType.DXA }, columnWidths: widths,
    layout: TableLayoutType.FIXED, borders: nil,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    rows: rows.map(cells => new TableRow({ cantSplit: true, children: cells.map((children, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA }, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children,
    })) })),
  });
  const field = item => new Paragraph({ spacing: { after: 60, line: 240 }, keepLines: true, children: [
    run(`${item.label} `, { bold: true }), run(item.uppercase ? item.value.toUpperCase() : item.value, { bold: !!item.bold }),
  ] });
  const fields = (items, available = width) => {
    const widths=[Math.floor(available/2),Math.ceil(available/2)], rows=[];
    for(let i=0;i<items.length;){
      const single=/^(Mã học viên|Email)/i.test(items[i].label);
      if(single){rows.push(new TableRow({cantSplit:true,children:[new TableCell({columnSpan:2,width:{size:available,type:WidthType.DXA},children:[field(items[i++])],margins:{top:0,bottom:0,left:0,right:0},noWrap:true})]}));continue;}
      const pair=[items[i++]];
      if(i<items.length&&!/^(Mã học viên|Email)/i.test(items[i].label))pair.push(items[i++]);
      rows.push(new TableRow({cantSplit:true,children:widths.map((w,j)=>new TableCell({width:{size:w,type:WidthType.DXA},children:pair[j]?[field(pair[j])]:[blank()]}))}));
    }
    return new Table({width:{size:available,type:WidthType.DXA},columnWidths:widths,layout:TableLayoutType.FIXED,borders:nil,margins:{top:0,bottom:0,left:0,right:45},rows});
  };
  const heading = text => p(text, { bold: true, size: 24, before: 120, after: 70, keepNext: true });
  const section = (item, pageBreakBefore = false) => [heading(item.title, pageBreakBefore), fields(item.fields), ...(item.extra ? [field(item.extra)] : [])];
  const photo = data.photo ? new Paragraph({ spacing: { before: 0, after: 0 }, children: [new ImageRun({
    ...await photoForWord(data.photo), transformation: { width: 112, height: 149.33 },
    altText: { name: "Ảnh 3x4", title: "Ảnh hồ sơ", description: data.fullName },
  })] }) : p("Ảnh 3 × 4", { center: true, size: 24, after: 0 });
  const photoBox = new Table({
    width: { size: 1701, type: WidthType.DXA }, columnWidths: [1701], layout: TableLayoutType.FIXED,
    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    rows: [new TableRow({ height: { value: 2268, rule: HeightRule.EXACT }, children: [new TableCell({
      width: { size: 1701, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, children: [photo],
    })] })],
  });
  const personalWidth = 7512; // 132.5 mm; 2.5 mm gap before the 30 mm photo.
  const checklist = table([Math.floor(width / 2), Math.ceil(width / 2)],
    Array.from({ length: Math.ceil(data.documents.length / 2) }, (_, i) => data.documents.slice(i * 2, i * 2 + 2).map(item => [new Paragraph({
      spacing: { after: 60, line: 240 }, keepLines: true,
      children: [run(item.checked ? "☑" : "☐", { font: "Segoe UI Symbol" }), run(` ${item.label}`)],
    })])));
  const content = [
    table([4620, 4734], [[
      [...data.masthead.map((line, i) => p(line, { center: true, bold: i !== 0, size: i>0?24:21, characterSpacing:i===1?-12:undefined })), shortRule(4620), p(`Số HS: ${data.displayCode}`, { center: true, size: 21 })],
      [...data.nationalHeading.map((line, i) => p(line, { center: true, bold: true, size: i===0?24:26, characterSpacing:i===0?-12:undefined })), shortRule(4734), p(data.dateLine, { center: true, italic: true, size: 21 })],
    ]]),
    p(data.title, { center: true, bold: true, size: 28, before: 160, after: 70, keepNext: true }),
    p(data.subtitle, { center: true, size: 21, after: 120, keepNext: true }),
    table([personalWidth, 141, 1701], [[
      [heading(data.sections[0].title), fields(data.sections[0].fields, personalWidth), field(data.sections[0].extra)],
      [blank()], [photoBox, blank()],
    ]]),
    ...section(data.sections[1]),
    ...section(data.sections[2]),
    heading(data.checklistTitle), checklist,
    table([3118, 3118, width - 6236], [data.signatures.map(signature => [
      p(signature.date, { center: true, size: 21, italic: true, before: 180 }),
      p(signature.title, { center: true, bold: true, size: 21 }),
      p(signature.instruction, { center: true, italic: true, size: 21, after: 1020 }),
      p(signature.name.toUpperCase(), { center: true, bold: true, size: 21 }),
    ])]),
    // Word requires a paragraph after the final table; keep it small to avoid a blank page.
    blank(),
  ];
  return Packer.toBlob(new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 21, color: "000000" }, paragraph: { spacing: { after: 60, line: 240 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } }, children: content }],
  }));
}

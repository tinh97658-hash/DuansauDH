import { inflateSync } from "zlib";

// Fixture inspector for pdfmake's Type0/CMap text output. Not a production PDF
// parser: verifies emitted Unicode text on each physical page without adding a
// parser package to the application.
export function readTranscriptPdf(buffer) {
  return readTranscriptPdfLayout(buffer).map(page => page.text);
}

export function readTranscriptPdfLayout(buffer) {
  const objects = new Map(Array.from(buffer.toString("latin1").matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g), match => [match[1], match[2]]));
  const stream = object => {
    const start = object.indexOf("stream\n"), end = object.lastIndexOf("\nendstream");
    const bytes = Buffer.from(object.slice(start + 7, end), "latin1");
    return object.includes("/FlateDecode") ? inflateSync(bytes).toString() : bytes.toString();
  };
  const maps = new Map();
  for (const [id, object] of objects) {
    const cmapRef = object.match(/\/ToUnicode (\d+) 0 R/);
    if (!cmapRef) continue;
    const cmap = stream(objects.get(cmapRef[1]));
    const mapping = new Map();
    for (const range of cmap.matchAll(/<([\da-f]+)>\s*<[\da-f]+>\s*\[([^\]]+)\]/gi)) {
      const start = parseInt(range[1], 16);
      Array.from(range[2].matchAll(/<([\da-f]+)>/gi)).forEach((entry, index) => mapping.set(start + index, String.fromCharCode(parseInt(entry[1], 16))));
    }
    maps.set(id, mapping);
  }
  return Array.from(objects.values()).filter(object => /\/Type \/Page\b/.test(object)).map(page => {
    const resources = objects.get(page.match(/\/Resources (\d+) 0 R/)[1]);
    const fonts = new Map(Array.from(resources.matchAll(/\/(F\d+) (\d+) 0 R/g), match => [match[1], maps.get(match[2])]));
    const content = stream(objects.get(page.match(/\/Contents (\d+) 0 R/)[1]));
    const runs = Array.from(content.matchAll(/BT([\s\S]*?)ET/g), block => {
      const font = fonts.get(block[1].match(/\/(F\d+) [\d.]+ Tf/)[1]);
      const position = block[1].match(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/);
      const size = Number(block[1].match(/\/(F\d+) ([\d.]+) Tf/)[2]);
      const pageHeight = Number(page.match(/\/MediaBox \[0 0 [\d.]+ ([\d.]+)\]/)[1]);
      const text = Array.from(block[1].matchAll(/<([\da-f]+)>/gi), text => text[1].match(/.{4}/g).map(code => font.get(parseInt(code, 16)) || "").join("")).join("");
      return { text, size, x: Number(position[1]), baseline: pageHeight - Number(position[2]) };
    });
    const lines = Array.from(content.matchAll(/([\d.-]+) ([\d.-]+) m\s+([\d.-]+) ([\d.-]+) l/g), match => ({
      x1: Number(match[1]), y1: Number(match[2]), x2: Number(match[3]), y2: Number(match[4]),
    }));
    return { text: runs.map(run => run.text).join(""), runs, lines };
  });
}

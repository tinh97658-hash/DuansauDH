import { inflateSync } from "node:zlib";

// Narrow inspector for Chrome's test PDFs: inline resources, Type0 fonts and
// Unicode CMaps. It checks text on physical pages without a runtime dependency.
export function readChromePdf(buffer) {
  const objects = new Map([...buffer.toString("latin1").matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)].map(match => [match[1], match[2]]));
  const stream = object => {
    const start = object.indexOf("stream\n"), end = object.lastIndexOf("\nendstream");
    const bytes = Buffer.from(object.slice(start + 7, end), "latin1");
    return object.includes("/FlateDecode") ? inflateSync(bytes).toString() : bytes.toString();
  };
  const decode = hex => String.fromCharCode(...hex.match(/.{4}/g).map(value => parseInt(value, 16)));
  const maps = new Map();
  for (const [id, object] of objects) {
    const ref = object.match(/\/ToUnicode (\d+) 0 R/);
    if (!ref) continue;
    const cmap = stream(objects.get(ref[1])), mapping = new Map();
    for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const pair of block[1].matchAll(/<([\da-f]+)>\s*<([\da-f]+)>/gi)) mapping.set(parseInt(pair[1], 16), decode(pair[2]));
    for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const range of block[1].matchAll(/<([\da-f]+)>\s*<([\da-f]+)>\s*<([\da-f]+)>/gi)) {
        const first = parseInt(range[1], 16), last = parseInt(range[2], 16), target = parseInt(range[3], 16);
        for (let code = first; code <= last; code++) mapping.set(code, String.fromCharCode(target + code - first));
      }
    }
    maps.set(id, mapping);
  }
  return [...objects.values()].filter(object => /\/Type \/Page\b/.test(object)).map(page => {
    const resourceRef = page.match(/\/Resources (\d+) 0 R/);
    const resources = resourceRef ? objects.get(resourceRef[1]) : page;
    const fonts = new Map([...resources.matchAll(/\/(F\d+) (\d+) 0 R/g)].map(match => [match[1], maps.get(match[2])]));
    const contents = page.match(/\/Contents\s*(\[[^\]]+\]|\d+ 0 R)/)[1];
    return [...contents.matchAll(/(\d+) 0 R/g)].map(ref => stream(objects.get(ref[1]))).join("\n").match(/BT[\s\S]*?ET/g).map(block => {
      const font = fonts.get(block.match(/\/(F\d+) [\d.]+ Tf/)[1]);
      return [...block.matchAll(/<([\da-f]+)>/gi)].map(match => match[1].match(/.{4}/g).map(code => font?.get(parseInt(code, 16)) || "").join("")).join("");
    }).join("");
  });
}

import fs from "fs";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";

const path = process.argv[2] ?? "samples/handbook-headings.docx";
const buf = fs.readFileSync(path);

JSZip.loadAsync(buf).then(async (zip) => {
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return;

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    isArray: (name) => ["p", "r", "t"].includes(name),
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const body = (doc.document as Record<string, unknown>)?.body;
  console.log("body keys", body && typeof body === "object" ? Object.keys(body as object) : body);
  console.log("body snippet", JSON.stringify(body, null, 2)?.slice(0, 2500));

  const paras = await extractDocxParagraphs(buf);
  console.log("\nextracted", paras.length);
  paras.slice(0, 5).forEach((p) => console.log(p.index, JSON.stringify(p.text.slice(0, 80))));
});

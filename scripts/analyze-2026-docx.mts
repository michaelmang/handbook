import fs from "fs";
import mammoth from "mammoth";
import { buildImportDraft } from "../src/lib/import/build-import-draft.ts";

const buf = fs.readFileSync(
  "/Users/michael.mangialardi/Downloads/2026_27_Student_Handbook.docx"
);
const { blocks, draft } = await buildImportDraft(buf);
console.log("Boundaries:", draft.boundaries.length, draft.boundaries);
for (const i of draft.boundaries) {
  const p = draft.paragraphs.find((x) => x.index === i);
  console.log(`  ¶${i}: ${p?.text?.slice(0, 70)}`);
}
console.log("\nBlocks:");
for (const b of blocks) {
  console.log(`  d${b.relativeDepth} ${b.title} (${b.content.length} chars)`);
}
const html = (await mammoth.convertToHtml({ buffer: buf })).value;
const headings = [...html.matchAll(/<h[1-3][^>]*>([^<]+)</gi)].map((m) =>
  m[1].replace(/<[^>]+>/g, "").trim()
);
console.log("\nMammoth headings:", headings.length);
headings.slice(0, 30).forEach((h) => console.log(" -", h));

const { extractDocxParagraphs } = await import("../src/lib/import/docx-xml.ts");
const paras = await extractDocxParagraphs(buf);
const texts = paras.map((p) => p.text.trim()).filter(Boolean);
const majors = [
  "Honor and Conduct",
  "Mission and Identity",
  "Admissions",
  "Academics",
  "Dress Code",
  "Communication",
  "Institutional Guidelines",
  "Parent Volunteer Organization",
];
console.log("\nMajor sections in DOCX XML:");
for (const m of majors) {
  const idx = texts.findIndex((t) => t === m || t.startsWith(m));
  console.log(`  ${m}: ${idx >= 0 ? `¶${idx}` : "MISSING"}`);
}
console.log("  Bullying:", texts.findIndex((t) => /bullying/i.test(t)));
console.log("  Total paragraphs:", paras.length);

for (const q of [
  "Honor and Conduct",
  "Honor & Conduct",
  "Academics",
  "Dress Code",
]) {
  const hits = paras
    .filter((p) => p.text.includes(q))
    .slice(0, 2)
    .map((p) => `¶${p.index}:${p.text.slice(0, 70)}`);
  console.log(`  contains "${q}":`, hits.length ? hits.join(" | ") : "none");
}

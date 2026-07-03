import fs from "fs";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";
import { buildFeatureList } from "../src/lib/import/paragraph-features";
import { parseDocxSmart } from "../src/lib/import/smart-docx";

const FCS =
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

async function main() {
  const buf = fs.readFileSync(FCS);
  const paragraphs = await extractDocxParagraphs(buf);
  const features = buildFeatureList(paragraphs);
  const smart = await parseDocxSmart(buf);
  const blocks = smart.blocks;

  console.log("ALL IMPORTED SECTIONS:\n");
  blocks.forEach((b, i) => {
    const flag = !b.content.trim() ? " [EMPTY]" : b.content.length < 100 ? " [THIN]" : "";
    console.log(
      `${String(i + 1).padStart(3)}. ${b.title.slice(0, 70)}${b.title.length > 70 ? "…" : ""} (${b.content.length} chars)${flag}`
    );
  });

  // Major part headings from TOC (¶3, 14, and top-level parts)
  const tocTopParts = [
    "Mission and Identity",
    "Honor and Conduct",
    "Admissions",
    "Academics",
    "Dress Code",
    "Activities in Student Life",
    "Institutional Guidelines",
    "Parent Volunteer Organization",
  ];

  console.log("\n\nTOP-LEVEL HANDBOOK PARTS (from TOC):\n");
  for (const part of tocTopParts) {
    const block = blocks.find((b) =>
      b.title.toLowerCase().includes(part.toLowerCase())
    );
    if (!block) {
      console.log(`  MISSING: ${part}`);
      continue;
    }
    const nestedInBody = [
      "Expectations",
      "Honor Code",
      "Dress Code",
      "Tuition",
      "Attendance",
      "Discipline",
    ].filter((sub) => block.content.toLowerCase().includes(sub.toLowerCase()));
    console.log(`  ✓ ${part} — ${block.content.length} chars`);
    if (nestedInBody.length)
      console.log(`      └ subsections trapped in body: ${nestedInBody.join(", ")}`);
  }

  // Paragraphs per imported section (avg span)
  const boundaries = blocks.map((_, i) => i); // proxy
  console.log(`\n\nGRANULARITY:`);
  console.log(`  Imported sections: ${blocks.length}`);
  console.log(`  Avg body length: ${Math.round(blocks.reduce((s, b) => s + b.content.length, 0) / blocks.length)} chars`);
  console.log(`  Largest section: "${blocks.reduce((a, b) => (b.content.length > a.content.length ? b : a)).title.slice(0, 40)}" (${Math.max(...blocks.map((b) => b.content.length))} chars)`);

  // Under-split: sections > 15000 chars
  const huge = blocks.filter((b) => b.content.length > 15000);
  console.log(`  Sections > 15k chars (under-split): ${huge.length}`);
  huge.forEach((b) => console.log(`    • ${b.title.slice(0, 50)} (${b.content.length})`));

  // Word numbered policy lines (2.7.1 style) as boundaries
  const numberedInImport = blocks.filter((b) => /^\d+\.\d+/.test(b.title));
  const numberedInDoc = features.filter((f) => /^\d+\.\d+/.test(f.text.trim()));
  console.log(`\n  Numbered sub-policies in doc (2.7.1…): ${numberedInDoc.length} paragraphs`);
  console.log(`  Numbered sub-policies as imported sections: ${numberedInImport.length}`);

  // TOC vs body boundary resolution
  console.log(`\n\nTOC DUPLICATION (sample):`);
  const samples = ["Honor Code", "Vision Statement", "Dress Code", "Attendance"];
  for (const s of samples) {
    const indices = features
      .filter((f) => f.text.trim() === s)
      .map((f) => f.index);
    const imported = blocks.filter((b) => b.title === s);
    console.log(`  "${s}": doc at ¶${indices.join(", ")} → import ${imported.length} block(s), ${imported[0]?.content.length ?? 0} chars`);
  }
}

main();

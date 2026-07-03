import fs from "fs";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";
import { buildFlatBlocksFromBoundaries } from "../src/lib/import/flat-section-builder";

async function main() {
  const paragraphs = await extractDocxParagraphs(
    fs.readFileSync(
      "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx"
    )
  );

  const blocks = buildFlatBlocksFromBoundaries(paragraphs, {
    boundaries: [221, 249, 257],
    confidence: "high",
  });
  for (const b of blocks) {
    console.log(`\n${b.title} — ${b.content.length} chars`);
    console.log(b.content.slice(0, 250) || "(empty)");
  }
}

main();

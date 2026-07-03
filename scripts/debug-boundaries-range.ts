import fs from "fs";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";
import { buildFeatureList } from "../src/lib/import/paragraph-features";
import { classifyFlatBoundariesPassA } from "../src/lib/import/llm-flat-sections";

const path =
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

async function main() {
  const paragraphs = await extractDocxParagraphs(fs.readFileSync(path));
  const features = buildFeatureList(paragraphs);
  const { boundaries } = await classifyFlatBoundariesPassA(features);

  const inRange = boundaries.filter((b) => b >= 200 && b <= 270);
  console.log("Boundaries 200–270:", inRange.join(", "));

  console.log("\n=== Paragraphs with boundary flag ===\n");
  for (const p of paragraphs.filter((x) => x.index >= 215 && x.index <= 265)) {
    const isB = boundaries.includes(p.index) ? " **BOUNDARY**" : "";
    console.log(`[${p.index}]${isB} ${p.text.slice(0, 90)}${p.text.length > 90 ? "…" : ""}`);
  }
}

main();

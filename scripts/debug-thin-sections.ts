import fs from "fs";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";
import { buildFeatureList } from "../src/lib/import/paragraph-features";
import { classifyFlatSectionsWithRetry } from "../src/lib/import/llm-flat-sections";
import { buildFlatBlocksFromBoundaries } from "../src/lib/import/flat-section-builder";

const path =
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";
const TARGETS = ["Honor Code", "Vision Statement", "3. Honor Code", "7. Vision Statement"];

async function main() {
  const buf = fs.readFileSync(path);
  const paragraphs = await extractDocxParagraphs(buf);
  const features = buildFeatureList(paragraphs);

  console.log("=== PARAGRAPH SEARCH ===\n");
  for (const target of TARGETS) {
    const hits = paragraphs.filter((p) =>
      p.text.toLowerCase().includes(target.toLowerCase())
    );
    if (hits.length === 0) continue;
    console.log(`"${target}" — ${hits.length} paragraph(s):`);
    for (const p of hits.slice(0, 5)) {
      const f = features.find((x) => x.index === p.index);
      console.log(`  [${p.index}] w=${f?.wordCount} bold=${f?.bold} fs=${f?.fontSizeRatio?.toFixed(2)}`);
      console.log(`       text: ${p.text.slice(0, 120)}${p.text.length > 120 ? "…" : ""}`);
    }
    console.log("");
  }

  console.log("=== RUNNING CLASSIFICATION (may take ~2 min) ===\n");
  const { classification } = await classifyFlatSectionsWithRetry(features);
  const blocks = buildFlatBlocksFromBoundaries(paragraphs, classification);

  console.log("=== IMPORTED BLOCKS FOR TARGETS ===\n");
  for (const target of ["Honor Code", "Vision Statement"]) {
    const matches = blocks.filter((b) =>
      b.title.toLowerCase().includes(target.toLowerCase())
    );
    for (const b of matches) {
      console.log(`TITLE: ${b.title}`);
      console.log(`BODY LENGTH: ${b.content.length} chars`);
      console.log(`BODY PREVIEW: ${b.content.slice(0, 300) || "(empty)"}`);
      console.log("");
    }
  }

  console.log("=== BOUNDARY CONTEXT ===\n");
  for (const target of ["Honor Code", "Vision Statement"]) {
    const para = paragraphs.find(
      (p) =>
        p.text.toLowerCase().includes(target.toLowerCase()) &&
        p.text.length < 80
    );
    if (!para) continue;

    const idx = para.index;
    const boundaries = [...classification.boundaries].sort((a, b) => a - b);
    const boundaryIdx = boundaries.indexOf(idx);
    const prev = boundaries[boundaryIdx - 1];
    const next = boundaries[boundaryIdx + 1];

    console.log(`--- ${para.text} @ index ${idx} ---`);
    console.log(`is boundary: ${boundaries.includes(idx)}`);
    console.log(`prev boundary: ${prev ?? "none"} | next boundary: ${next ?? "none"}`);

    const nearby = paragraphs.filter(
      (p) => p.index >= idx - 2 && p.index <= (next ?? idx + 15)
    );
    for (const p of nearby) {
      const isB = boundaries.includes(p.index) ? " [BOUNDARY]" : "";
      console.log(
        `  [${p.index}]${isB} ${p.text.slice(0, 100)}${p.text.length > 100 ? "…" : ""}`
      );
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

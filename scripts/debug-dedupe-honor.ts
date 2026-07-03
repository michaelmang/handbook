import fs from "fs";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";
import { buildFeatureList } from "../src/lib/import/paragraph-features";
import { classifyFlatBoundariesPassA } from "../src/lib/import/llm-flat-sections";
import { buildFlatBlocksFromBoundaries } from "../src/lib/import/flat-section-builder";
import { dedupeFlatBlocks } from "../src/lib/import/refine-blocks";

async function main() {
  const buf = fs.readFileSync(
    "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx"
  );
  const paragraphs = await extractDocxParagraphs(buf);
  const features = buildFeatureList(paragraphs);
  const c = await classifyFlatBoundariesPassA(features);

  const raw = buildFlatBlocksFromBoundaries(paragraphs, c);
  const targets = raw.filter((b) =>
    /vision statement|honor code/i.test(b.title)
  );

  console.log("=== BEFORE DEDUPE ===");
  for (const b of targets) {
    console.log(`"${b.title}" — ${b.content.length} chars`);
  }

  const near221 = c.boundaries.filter((b) => b >= 218 && b <= 225);
  const near249 = c.boundaries.filter((b) => b >= 246 && b <= 252);
  console.log("\nBoundaries near 221:", near221);
  console.log("\nBoundaries near 249:", near249);
  console.log("Next after 249:", c.boundaries[c.boundaries.indexOf(249) + 1]);
  console.log("Boundaries near 249:", near249);
  console.log("Next after 249:", c.boundaries[c.boundaries.indexOf(249) + 1]);

  const honorIdx = raw.findIndex((b) => b.title === "Honor Code");
  console.log("Honor Code block index in array:", honorIdx);
  if (honorIdx >= 0) {
    const prev = raw[honorIdx - 1];
    const next = raw[honorIdx + 1];
    console.log("  prev block:", prev?.title?.slice(0, 40), prev?.content.length);
    console.log("  next block:", next?.title?.slice(0, 40), next?.content.length);
  }

  const blocksNearVision = raw.filter((b, i) => i >= 0 && /vision|crest|affiliation/i.test(b.title));
  console.log("\nBlocks with vision/crest in title:");
  for (const b of blocksNearVision.slice(0, 6)) {
    console.log(`  "${b.title.slice(0, 50)}" — ${b.content.length} chars`);
  }

  const warnings: string[] = [];
  const deduped = dedupeFlatBlocks(raw, warnings);
  const after = deduped.filter((b) =>
    /vision statement|honor code/i.test(b.title)
  );
  console.log("\n=== AFTER DEDUPE ===");
  for (const b of after) {
    console.log(`"${b.title}" — ${b.content.length} chars`);
    console.log(b.content.slice(0, 120) || "(empty)");
  }
  console.log("\nDedupe warnings:", warnings.filter((w) => /honor|vision/i.test(w)));
}

main();

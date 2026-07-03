import fs from "fs";
import { parseDocxToBlocks } from "../src/lib/import/docx";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx scripts/inspect-docx.ts <file.docx>");
  process.exit(1);
}

const buf = fs.readFileSync(path);
parseDocxToBlocks(buf).then((r) => {
  console.log("blocks:", r.blocks.length);
  console.log("warnings:", r.warnings.length);
  console.log("\n--- mammoth / parser warnings ---");
  r.warnings
    .filter((w) => !w.startsWith("Low-confidence"))
    .forEach((w) => console.log(w));

  const low = r.warnings.filter((w) => w.startsWith("Low-confidence"));
  console.log("\n--- low-confidence boundaries:", low.length, "---");
  low.forEach((w) => console.log(w));

  console.log("\n--- depth distribution ---");
  const depths: Record<number, number> = {};
  for (const b of r.blocks) {
    depths[b.relativeDepth] = (depths[b.relativeDepth] ?? 0) + 1;
  }
  console.log(depths);

  console.log("\n--- first 15 sections ---");
  r.blocks.slice(0, 15).forEach((b) => {
    console.log(`d${b.relativeDepth} | ${b.title} | body ${b.content.length} chars`);
  });
});

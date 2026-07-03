import fs from "fs";
import path from "path";
import { parseDocxToBlocks } from "../src/lib/import/docx";
import mammoth from "mammoth";

async function analyze(label: string, filePath: string) {
  const buf = fs.readFileSync(filePath);
  const { blocks, warnings } = await parseDocxToBlocks(buf);
  const html = (await mammoth.convertToHtml({ buffer: buf })).value;
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const totalContentChars = blocks.reduce((n, b) => n + b.content.length, 0);
  const empty = blocks.filter((b) => !b.content.trim());

  return {
    label,
    filePath,
    bytes: buf.byteLength,
    blockCount: blocks.length,
    emptySections: empty.length,
    totalContentChars,
    plainTextChars: plain.length,
    warnings: warnings.length,
    depthCounts: blocks.reduce<Record<number, number>>((acc, b) => {
      acc[b.relativeDepth] = (acc[b.relativeDepth] ?? 0) + 1;
      return acc;
    }, {}),
    blocks,
  };
}

function compare(
  original: Awaited<ReturnType<typeof analyze>>,
  exported: Awaited<ReturnType<typeof analyze>>
) {
  const expTitles = new Set(exported.blocks.map((b) => b.title.toLowerCase().trim()));
  const origTitles = new Set(original.blocks.map((b) => b.title.toLowerCase().trim()));

  const missingInExport = original.blocks.filter(
    (b) => !expTitles.has(b.title.toLowerCase().trim())
  );
  const newInExport = exported.blocks.filter(
    (b) => !origTitles.has(b.title.toLowerCase().trim())
  );
  const titleMatches = original.blocks.filter((b) =>
    expTitles.has(b.title.toLowerCase().trim())
  );

  const contentShrink: { title: string; orig: number; exp: number }[] = [];
  for (const ob of original.blocks) {
    const eb = exported.blocks.find(
      (x) => x.title.toLowerCase().trim() === ob.title.toLowerCase().trim()
    );
    if (eb && ob.content.length > 0) {
      const ratio = eb.content.length / ob.content.length;
      if (ratio < 0.5) {
        contentShrink.push({
          title: ob.title,
          orig: ob.content.length,
          exp: eb.content.length,
        });
      }
    }
  }

  return { missingInExport, newInExport, titleMatches, contentShrink };
}

const originalPath =
  process.argv[2] ??
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";
const exportedPath =
  process.argv[3] ??
  "/Users/michael.mangialardi/Downloads/2026_27_Student_Handbook.docx";

Promise.all([
  analyze("ORIGINAL", originalPath),
  analyze("EXPORTED", exportedPath),
]).then(([original, exported]) => {
  console.log("=== FILE STATS ===");
  for (const a of [original, exported]) {
    console.log(`\n${a.label}: ${path.basename(a.filePath)}`);
    console.log(`  size: ${(a.bytes / 1024).toFixed(1)} KB`);
    console.log(`  sections: ${a.blockCount}`);
    console.log(`  empty sections: ${a.emptySections}`);
    console.log(`  body chars (import parse): ${a.totalContentChars}`);
    console.log(`  plain text chars (mammoth): ${a.plainTextChars}`);
    console.log(`  depth: ${JSON.stringify(a.depthCounts)}`);
    console.log(`  warnings: ${a.warnings}`);
  }

  const cmp = compare(original, exported);

  console.log("\n=== COMPARISON ===");
  console.log(`titles in original: ${original.blockCount}`);
  console.log(`titles in exported: ${exported.blockCount}`);
  console.log(`titles matched by name: ${cmp.titleMatches.length}`);
  console.log(`titles missing from export: ${cmp.missingInExport.length}`);
  console.log(`new titles only in export: ${cmp.newInExport.length}`);
  console.log(
    `content chars original->exported: ${original.totalContentChars} -> ${exported.totalContentChars}`
  );

  console.log("\n--- Missing from export (first 40) ---");
  cmp.missingInExport.slice(0, 40).forEach((b) => {
    console.log(`  d${b.relativeDepth} | ${b.title} | ${b.content.length} chars`);
  });

  console.log("\n--- New in export only (first 20) ---");
  cmp.newInExport.slice(0, 20).forEach((b) => {
    console.log(`  d${b.relativeDepth} | ${b.title} | ${b.content.length} chars`);
  });

  console.log("\n--- Major content shrink (>50% lost, same title) ---");
  cmp.contentShrink
    .sort((a, b) => b.orig - a.orig)
    .slice(0, 25)
    .forEach((x) => {
      const pct = ((x.exp / x.orig) * 100).toFixed(0);
      console.log(`  ${x.title}: ${x.orig} -> ${x.exp} (${pct}%)`);
    });

  console.log("\n--- Original top-level sections ---");
  original.blocks
    .filter((b) => b.relativeDepth === 0)
    .forEach((b) => console.log(`  ${b.title} (${b.content.length} chars)`));

  console.log("\n--- Exported top-level sections ---");
  exported.blocks
    .filter((b) => b.relativeDepth === 0)
    .forEach((b) => console.log(`  ${b.title} (${b.content.length} chars)`));
});

import fs from "fs";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";

const path =
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

async function main() {
  const paragraphs = await extractDocxParagraphs(fs.readFileSync(path));

  console.log("=== EARLY OUTLINE LIST (likely TOC) paragraphs 0–35 ===\n");
  for (const p of paragraphs.filter((x) => x.index <= 35)) {
    console.log(`[${p.index}] ${p.text}`);
  }

  console.log("\n=== REAL Honor Code body (index 249+) ===\n");
  for (const p of paragraphs.filter((x) => x.index >= 248 && x.index <= 257)) {
    console.log(`[${p.index}] ${p.text.slice(0, 100)}${p.text.length > 100 ? "…" : ""}`);
  }

  console.log("\n=== REAL Vision Statement (index 221+) ===\n");
  for (const p of paragraphs.filter((x) => x.index >= 220 && x.index <= 224)) {
    console.log(`[${p.index}] ${p.text}`);
  }

  const honorSnippet =
    "Faith Christian School promotes a biblical atmosphere of academic excellence";
  const visionSnippet =
    "A Mind for Truth, A Heart for Christ, A Will to Serve";

  console.log("\n=== WHERE DOES REAL TEXT LAND IN HEURISTIC IMPORT? ===\n");
  const { parseDocxToBlocks } = await import("../src/lib/import/docx");
  const heuristic = await parseDocxToBlocks(fs.readFileSync(path));
  for (const b of heuristic.blocks) {
    if (
      b.content.includes(honorSnippet) ||
      b.content.includes(visionSnippet) ||
      b.title.includes("Honor Code") ||
      b.title.includes("Vision Statement")
    ) {
      console.log(
        `HEURISTIC "${b.title}" (d${b.relativeDepth}) — ${b.content.length} chars`
      );
    }
  }
}

main();

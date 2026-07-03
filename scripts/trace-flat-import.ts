import fs from "fs";
import { parseDocxSmart } from "../src/lib/import/smart-docx";

const path =
  process.argv[2] ??
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

async function main() {
  const start = Date.now();
  const buf = fs.readFileSync(path);

  console.log("=== FLAT SMART IMPORT ===");
  console.log("file:", path);
  console.log("size:", `${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`);
  console.log("model:", process.env.OPENAI_MODEL ?? "gpt-4o-mini");
  console.log("");

  const result = await parseDocxSmart(buf, (e) => {
    const chunk =
      e.current != null && e.total != null
        ? ` (${e.current}/${e.total})`
        : "";
    const detail = e.detail ? ` — ${e.detail}` : "";
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[${elapsed}s] ${e.phase} ${e.status}: ${e.message}${chunk}${detail}`
    );
  });

  console.log("");
  console.log("=== RESULT ===");
  console.log("mode:", result.importMode, "flat:", result.flat);
  console.log("sections:", result.blocks.length);
  console.log("elapsed:", `${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log("");
  console.log("warnings:");
  for (const w of result.warnings) console.log(" -", w);
  console.log("");
  console.log("first 25 sections:");
  result.blocks
    .slice(0, 25)
    .forEach((b, i) =>
      console.log(` ${i + 1}. ${b.title} (${b.content.length} chars)`)
    );
  if (result.blocks.length > 25) {
    console.log(` ... +${result.blocks.length - 25} more`);
  }

  console.log("");
  console.log("=== TARGET SECTIONS ===");
  for (const needle of ["Vision Statement", "Honor Code", "Honor and Conduct"]) {
    const hits = result.blocks.filter((b) =>
      b.title.toLowerCase().includes(needle.toLowerCase())
    );
    console.log(`\n${needle} (${hits.length} block(s)):`);
    for (const b of hits) {
      console.log(`  - "${b.title}" — ${b.content.length} chars`);
      console.log(`    ${b.content.slice(0, 180).replace(/\n/g, " ") || "(empty)"}`);
    }
  }
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});

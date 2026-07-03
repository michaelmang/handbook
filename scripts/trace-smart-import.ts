import fs from "fs";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";
import { buildFeatureList } from "../src/lib/import/paragraph-features";
import {
  classifyStructureWithLlm,
  refineStructureWithLlm,
} from "../src/lib/import/llm-structure";
import { auditStructure } from "../src/lib/import/structure-audit";
import { buildBlocksFromStructure } from "../src/lib/import/structure-builder";
import { refineImportedBlocks } from "../src/lib/import/refine-blocks";

const path =
  process.argv[2] ??
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

function stamp(label: string, startMs: number) {
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`[${elapsed}s] ${label}`);
  return Date.now();
}

async function main() {
  const totalStart = Date.now();
  console.log("=== SMART IMPORT TRACE ===");
  console.log("file:", path);
  console.log("model:", process.env.OPENAI_MODEL ?? "gpt-4o-mini");
  console.log("skip refine:", process.env.OPENAI_SKIP_REFINE === "true");
  console.log("");

  let t = Date.now();
  const buf = fs.readFileSync(path);
  stamp(`read file (${(buf.byteLength / 1024 / 1024).toFixed(2)} MB)`, t);
  t = Date.now();

  const paragraphs = await extractDocxParagraphs(buf);
  t = stamp(`extract XML paragraphs: ${paragraphs.length}`, t);

  const features = buildFeatureList(paragraphs);
  t = stamp(`build typography features`, t);

  console.log("");
  console.log("--- PASS 1: classify structure (chunked LLM calls) ---");
  const pass1Start = Date.now();
  const draft = await classifyStructureWithLlm(features);
  stamp(
    `pass 1 done: ${draft.headings.length} headings, confidence=${draft.confidence}`,
    pass1Start
  );

  if (draft.notes) console.log("pass 1 notes:", draft.notes);
  console.log(
    "pass 1 top-level (level 1):",
    draft.headings
      .filter((h) => h.level === 1)
      .slice(0, 15)
      .map((h) => {
        const f = features.find((x) => x.index === h.index);
        return f?.text.slice(0, 50) ?? `i${h.index}`;
      })
  );
  if (draft.headings.filter((h) => h.level === 1).length > 15) {
    console.log(
      `  ... +${draft.headings.filter((h) => h.level === 1).length - 15} more`
    );
  }

  console.log("");
  console.log("--- AUDIT ---");
  t = Date.now();
  const issues = auditStructure(draft, features);
  t = stamp(`audit: ${issues.length} issues flagged`, t);
  for (const issue of issues.slice(0, 12)) {
    console.log(`  [${issue.severity}] i=${issue.index}: ${issue.reason}`);
  }
  if (issues.length > 12) console.log(`  ... +${issues.length - 12} more`);

  let structure = draft;
  if (process.env.OPENAI_SKIP_REFINE !== "true") {
    console.log("");
    console.log("--- PASS 2: refine structure (single LLM call) ---");
    const pass2Start = Date.now();
    structure = await refineStructureWithLlm(features, draft, issues);
    stamp(
      `pass 2 done: ${structure.headings.length} headings, confidence=${structure.confidence}`,
      pass2Start
    );
    if (structure.notes) console.log("pass 2 notes:", structure.notes);
  } else {
    console.log("");
    console.log("--- PASS 2: skipped (OPENAI_SKIP_REFINE=true) ---");
  }

  console.log("");
  console.log("--- BUILD BLOCKS ---");
  t = Date.now();
  const warnings: string[] = [];
  let blocks = buildBlocksFromStructure(paragraphs, structure);
  t = stamp(`buildBlocksFromStructure: ${blocks.length} sections`, t);

  blocks = refineImportedBlocks(blocks, warnings);
  t = stamp(`refineImportedBlocks (dedupe/split)`, t);

  console.log("");
  console.log("--- RESULT ---");
  stamp(`TOTAL`, totalStart);
  console.log("sections:", blocks.length);
  console.log(
    "depth counts:",
    blocks.reduce<Record<number, number>>((acc, b) => {
      acc[b.relativeDepth] = (acc[b.relativeDepth] ?? 0) + 1;
      return acc;
    }, {})
  );
  console.log("");
  console.log("top-level sections:");
  blocks
    .filter((b) => b.relativeDepth === 0)
    .forEach((b) =>
      console.log(`  - ${b.title} (${b.content.length} chars body)`)
    );
  console.log("");
  console.log("sample warnings:", warnings.slice(0, 8));
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});

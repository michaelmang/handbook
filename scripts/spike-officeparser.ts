/**
 * Spike: officeParser DOCX → Markdown quality + import mode assessment.
 *
 * Usage:
 *   npm run spike:officeparser
 *   npm run spike:officeparser -- /path/to/handbook.docx
 *   npm run spike:officeparser -- samples/handbook-messy.docx samples/handbook-headings.docx
 */
import fs from "fs";
import path from "path";
import { OfficeParser } from "officeparser";
import { parseDocxWithOfficeParser } from "../src/lib/import/office-parser";
import {
  assessOfficeImport,
  sliceOfficeSectionNodes,
  type OfficeSectionProposal,
} from "../src/lib/import/office-parser-analyze";

const OUTPUT_DIR = path.join(process.cwd(), "spike-output", "officeparser");

const DEFAULT_FILES = [
  "samples/handbook-outline-numbers.docx",
  "samples/handbook-headings.docx",
  "samples/handbook-messy.docx",
];

async function markdownForNodes(
  ast: Awaited<ReturnType<typeof parseDocxWithOfficeParser>>["ast"],
  nodes: import("officeparser").OfficeContentNode[]
): Promise<string> {
  const partial = { ...ast, content: nodes };
  const result = await partial.to("md");
  return result.value.trim();
}

async function spikeFile(filePath: string): Promise<void> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`\n✗ Not found: ${resolved}`);
    return;
  }

  const buffer = fs.readFileSync(resolved);
  const baseName = path.basename(resolved, ".docx");
  const outDir = path.join(OUTPUT_DIR, baseName);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n${"=".repeat(72)}`);
  console.log(`FILE: ${resolved}`);
  console.log(`SIZE: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
  console.log("=".repeat(72));

  const { ast, markdown, warnings } = await parseDocxWithOfficeParser(buffer);
  const assessment = assessOfficeImport(ast, markdown);

  fs.writeFileSync(path.join(outDir, "full.md"), `${markdown}\n`);
  fs.writeFileSync(
    path.join(outDir, "assessment.json"),
    JSON.stringify(assessment, null, 2)
  );

  console.log("\n--- AST stats ---");
  console.log(JSON.stringify(assessment.stats, null, 2));

  if (warnings.length > 0) {
    console.log(`\n--- Parser warnings (${warnings.length}) ---`);
    warnings.slice(0, 5).forEach((w) => console.log(`  • ${w}`));
  }

  console.log("\n--- Proposed sections (first 12) ---");
  for (const s of assessment.sections.slice(0, 12)) {
    const indent = "  ".repeat(s.level);
    console.log(
      `  ${indent}[${s.source} L${s.level}] ${s.title.slice(0, 70)}`
    );
  }
  if (assessment.sections.length > 12) {
    console.log(`  … +${assessment.sections.length - 12} more`);
  }

  console.log("\n--- Import mode recommendation ---");
  console.log(`  → ${assessment.recommendation.toUpperCase()}`);
  for (const r of assessment.recommendationReasons) {
    console.log(`    • ${r}`);
  }

  // Sample section markdown slices (first 3 level-0 sections)
  const topSections = assessment.sections.filter((s) => s.level === 0).slice(0, 3);
  for (let i = 0; i < topSections.length; i++) {
    const section = topSections[i];
    const nodes = sliceOfficeSectionNodes(
      ast,
      section,
      assessment.sections
    );
    const sectionMd = await markdownForNodes(ast, nodes);
    const file = path.join(outDir, `section-${i + 1}.md`);
    fs.writeFileSync(file, `# ${section.title}\n\n${sectionMd}\n`);
    console.log(`\n--- Section slice ${i + 1}: ${section.title.slice(0, 50)} ---`);
    console.log(sectionMd.slice(0, 400).replace(/\n/g, "\n  "));
    if (sectionMd.length > 400) console.log("  …");
  }

  // Chunking strategies for comparison
  for (const splitBy of ["heading", "paragraph"] as const) {
    try {
      const chunks = await ast.to("chunks", {
        splitBy,
        maxChunkSize: 6000,
      });
      const count = chunks.value?.length ?? 0;
      console.log(`\n--- Built-in chunks (splitBy=${splitBy}): ${count} ---`);
      if (chunks.value?.[0]) {
        console.log(
          `  first: ${chunks.value[0].text.slice(0, 80).replace(/\n/g, " ")}…`
        );
      }
      fs.writeFileSync(
        path.join(outDir, `chunks-${splitBy}.json`),
        JSON.stringify(chunks.value, null, 2)
      );
    } catch (err) {
      console.log(`\n--- chunks splitBy=${splitBy} failed: ${err} ---`);
    }
  }

  console.log(`\nWrote output → ${outDir}/`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : DEFAULT_FILES;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log("officeParser DOCX → Markdown spike");
  console.log(`Output directory: ${OUTPUT_DIR}`);

  for (const file of files) {
    await spikeFile(file);
  }

  await OfficeParser.terminateOcr?.();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

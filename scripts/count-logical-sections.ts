import fs from "fs";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";
import { buildFeatureList } from "../src/lib/import/paragraph-features";

const FCS =
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

async function main() {
  const paragraphs = await extractDocxParagraphs(fs.readFileSync(FCS));
  const features = buildFeatureList(paragraphs);

  // TOC block: from "Table of Contents" until first long prose
  const tocStart = paragraphs.findIndex((p) =>
    /^table of contents$/i.test(p.text.trim())
  );
  const tocLines: string[] = [];
  for (const p of paragraphs) {
    if (p.index <= tocStart) continue;
    const f = features.find((x) => x.index === p.index)!;
    if (f.wordCount > 15 || f.text.length > 120) break;
    if (f.wordCount >= 2 && f.wordCount <= 10) tocLines.push(p.text.trim());
  }

  const numberedPolicies = features.filter((f) =>
    /^\d+\.\d+/.test(f.text.trim())
  );
  const appendix = features.filter((f) => /^appendix/i.test(f.text.trim()));
  const majorBold = features.filter(
    (f) =>
      f.index > 180 &&
      f.bold &&
      f.wordCount <= 8 &&
      !f.endsWithPeriod &&
      !/^\d+\./.test(f.text)
  );

  console.log("ESTIMATED 'LOGICAL SECTION' COUNTS IN SOURCE DOC:\n");
  console.log(`  TOC outline entries:        ${tocLines.length}`);
  console.log(`  Numbered sub-policies:      ${numberedPolicies.length}  (e.g. 2.7.1, 4.2.1)`);
  console.log(`  Appendix headings:          ${appendix.length}`);
  console.log(`  Bold short lines (body):    ${majorBold.length}`);
  console.log(`  Total paragraphs:           ${paragraphs.length}`);
  console.log("");
  console.log("  If 1:1 with TOC outline:    ~" + tocLines.length + " sections");
  console.log("  If 1:1 with TOC + numbered: ~" + (tocLines.length + numberedPolicies.length) + " sections");
  console.log("  (Many overlap — TOC repeats numbered items as title-only lines)");

  // duplicate title count
  const byTitle = new Map<string, number[]>();
  for (const f of features) {
    if (f.wordCount > 12) continue;
    const k = f.text.toLowerCase().trim();
    if (!k) continue;
    const a = byTitle.get(k) ?? [];
    a.push(f.index);
    byTitle.set(k, a);
  }
  const dupes = [...byTitle.entries()].filter(([, v]) => v.length > 1);
  console.log(`\n  Unique short titles appearing 2+ times: ${dupes.length}`);
  console.log("  (Each duplicate = TOC copy + body copy minimum)\n");

  console.log("TOC sample (first 15):");
  tocLines.slice(0, 15).forEach((t, i) => console.log(`    ${i + 1}. ${t}`));
}

main();

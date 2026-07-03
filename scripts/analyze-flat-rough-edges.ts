import fs from "fs";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml";
import { buildFeatureList } from "../src/lib/import/paragraph-features";
import { parseDocxSmart } from "../src/lib/import/smart-docx";
import { parseDocxToBlocks } from "../src/lib/import/docx";
import type { MarkdownBlock } from "@/lib/markdown-split";
import { isLikelyTocLine, isTocCompositeLine } from "../src/lib/import/boundary-rules";

const FCS =
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

interface RoughEdge {
  category: string;
  count: number;
  examples: string[];
  why: string;
}

function isShortHeadingLike(
  text: string,
  f?: { wordCount: number; endsWithPeriod: boolean }
): boolean {
  const t = text.trim();
  if (!t || t.length > 100) return false;
  if (isLikelyTocLine(t) || isTocCompositeLine(t)) return false;
  const words = f?.wordCount ?? t.split(/\s+/).filter(Boolean).length;
  if (words > 12) return false;
  if (words > 8 && (f?.endsWithPeriod ?? t.endsWith("."))) return false;
  return true;
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

async function main() {
  const buf = fs.readFileSync(FCS);
  const paragraphs = await extractDocxParagraphs(buf);
  const features = buildFeatureList(paragraphs);

  console.log("Running smart flat import (this may take ~2 min)...\n");
  const smart = await parseDocxSmart(buf);
  const blocks = smart.blocks;

  const edges: RoughEdge[] = [];

  // --- 1. Empty sections ---
  const empty = blocks.filter((b) => !b.content.trim());
  edges.push({
    category: "Empty sections (boundary with no body)",
    count: empty.length,
    examples: empty.slice(0, 8).map((b) => `"${b.title.slice(0, 60)}"`),
    why: "Back-to-back LLM boundaries, or heading immediately followed by another heading with no prose between.",
  });

  // --- 2. Very thin sections (< 40 chars) ---
  const thin = blocks.filter(
    (b) => b.content.trim().length > 0 && b.content.trim().length < 40
  );
  edges.push({
    category: "Very thin sections (< 40 chars body)",
    count: thin.length,
    examples: thin.slice(0, 6).map((b) => `"${b.title}" (${b.content.length} chars)`),
    why: "Boundary placed on a label with only a fragment of text before the next boundary.",
  });

  // --- 3. Long prose used as title ---
  const longTitles = blocks.filter((b) => b.title.length > 80);
  edges.push({
    category: "Body prose used as section title",
    count: longTitles.length,
    examples: longTitles.slice(0, 4).map((b) => `"${b.title.slice(0, 70)}…"`),
    why: "Pass A marked a long paragraph as a boundary instead of a short heading line.",
  });

  // --- 4. Numbering artifacts ---
  const numberingArtifacts = blocks.filter((b) =>
    /^\d+\.\d+/.test(b.title.replace(/\s/g, "")) || /^2\.\d/.test(b.title)
  );
  edges.push({
    category: "Numbering glued to title (Word list artifacts)",
    count: numberingArtifacts.length,
    examples: numberingArtifacts.slice(0, 6).map((b) => `"${b.title}"`),
    why: "Word auto-numbering merged into paragraph text during XML extract; stripNumberingPrefix did not match.",
  });

  // --- 5. TOC block still present as section content ---
  const tocAsContent = blocks.filter((b) => {
    const lines = b.content.split(/\s{2,}|\n/).filter(Boolean);
    return (
      lines.length >= 4 &&
      lines.every((l) => l.length < 60 && !l.includes(".")) &&
      b.content.length < 800 &&
      /Honor Code|Discipline|Expectations/.test(b.content)
    );
  });
  edges.push({
    category: "TOC outline text living inside a section body",
    count: tocAsContent.length,
    examples: tocAsContent.slice(0, 3).map((b) => `"${b.title}" body preview: ${b.content.slice(0, 80)}…`),
    why: "Early Table of Contents (¶3–35) captured as one section; child titles listed as prose, not separate boundaries.",
  });

  // --- 6. Duplicate titles in output (after dedupe) ---
  const titleCounts = new Map<string, number>();
  for (const b of blocks) {
    const k = normalizeTitle(b.title);
    titleCounts.set(k, (titleCounts.get(k) ?? 0) + 1);
  }
  const dupes = [...titleCounts.entries()].filter(([, n]) => n > 1);
  edges.push({
    category: "Duplicate titles remaining after dedupe",
    count: dupes.length,
    examples: dupes.slice(0, 6).map(([t, n]) => `"${t}" ×${n}`),
    why: "Dedupe merges same-title blocks by content score; distinct boundaries with identical titles may survive if titles differ slightly.",
  });

  // --- 7. Candidate headings in doc NOT in import ---
  const importedTitles = new Set(blocks.map((b) => normalizeTitle(b.title)));
  const missed: string[] = [];
  for (const f of features) {
    if (!isShortHeadingLike(f.text, f)) continue;
    if (f.index < 40) continue;
    const key = normalizeTitle(f.text);
    if (importedTitles.has(key)) continue;
    if (missed.length < 200) missed.push(`[${f.index}] ${f.text.slice(0, 50)}`);
  }
  // dedupe missed by title
  const missedUnique = [...new Set(missed.map((m) => m.replace(/^\[\d+\]\s*/, "")))];
  edges.push({
    category: "Short heading-like lines in doc body NOT imported as sections",
    count: missedUnique.length,
    examples: missedUnique.slice(0, 10).map((t) => `"${t.slice(0, 55)}"`),
    why: "LLM recall gap — subsection labels in prose, bold inline headings, or typography too similar to body.",
  });

  // --- 8. TOC duplicate titles (doc has 2× same title) ---
  const titleToIndices = new Map<string, number[]>();
  for (const f of features) {
    if (!isShortHeadingLike(f.text, f)) continue;
    const k = normalizeTitle(f.text);
    const arr = titleToIndices.get(k) ?? [];
    arr.push(f.index);
    titleToIndices.set(k, arr);
  }
  const docDupes = [...titleToIndices.entries()].filter(([, idxs]) => idxs.length > 1);
  edges.push({
    category: "Duplicate heading text in source document",
    count: docDupes.length,
    examples: docDupes.slice(0, 8).map(([t, idxs]) => `"${t}" at ¶${idxs.join(", ")}`),
    why: "TOC outline repeats titles before real sections — flat import must pick one boundary per title (cleanup keeps the one with body).",
  });

  // --- 9. Content bleed (section includes next section's heading text) ---
  const bleed = blocks.filter((b) => {
    const otherTitles = blocks
      .filter((x) => x !== b && x.title.length < 60)
      .map((x) => x.title);
    return otherTitles.some(
      (t) => t !== b.title && b.content.includes(t) && t.length > 8
    );
  });
  edges.push({
    category: "Section body contains another section's title as text",
    count: bleed.length,
    examples: bleed.slice(0, 4).map((b) => `"${b.title}" includes nested heading names`),
    why: "Flat model attaches ALL paragraphs until next boundary — if next section wasn't a boundary, its heading stays in prior body.",
  });

  // --- 10. Compare to heuristic top-level count ---
  const heuristic = await parseDocxToBlocks(buf);
  edges.push({
    category: "Section count vs heuristic importer",
    count: blocks.length,
    examples: [
      `Smart flat: ${blocks.length} sections`,
      `Heuristic tree-flattened: ${heuristic.blocks.length} sections`,
      `Difference: ${blocks.length - heuristic.blocks.length}`,
    ],
    why: "Different detection strategies — neither is ground truth; Word has no explicit section model.",
  });

  // --- 11. Warnings from import ---
  const cleanupWarnings = smart.warnings.filter(
    (w) =>
      /duplicate|TOC|Removed|Merged|Skipped/i.test(w)
  );
  edges.push({
    category: "Cleanup/dedupe actions taken",
    count: cleanupWarnings.length,
    examples: cleanupWarnings.slice(0, 8),
    why: "Programmatic post-processing removed or merged boundaries/blocks.",
  });

  // --- Summary stats ---
  const tocCandidates = features.filter(
    (f) => f.index >= 3 && f.index <= 35 && isShortHeadingLike(f.text, f)
  );
  const bodyHeadings = features.filter(
    (f) => f.index > 35 && isShortHeadingLike(f.text, f)
  );

  console.log("=".repeat(72));
  console.log("FLAT IMPORT ROUGH EDGES — FCS Student Handbook");
  console.log("=".repeat(72));
  console.log(`\nSource: ${paragraphs.length} paragraphs`);
  console.log(`Import: ${blocks.length} flat sections`);
  console.log(`\nStructural reality:`);
  console.log(`  • TOC outline lines (¶3–35): ~${tocCandidates.length} short title-like paragraphs`);
  console.log(`  • Body short heading-like lines (¶36+): ~${bodyHeadings.length} candidates`);
  console.log(`  • Document duplicate titles: ${docDupes.length} titles appear 2+ times`);
  console.log(`\nWhy no one-to-one match:`);
  console.log(`  1. Word has no "section" schema — only paragraphs + visual styles`);
  console.log(`  2. TOC repeats the same titles before real content (2× for many sections)`);
  console.log(`  3. Flat import picks boundaries, not Word outline levels`);
  console.log(`  4. One boundary = one section; nesting is collapsed`);
  console.log(`  5. LLM + cleanup choose a subset of ~${bodyHeadings.length} candidates → ${blocks.length} sections`);

  console.log("\n" + "-".repeat(72));
  for (const e of edges) {
    console.log(`\n## ${e.category} (${e.count})`);
    console.log(`Why: ${e.why}`);
    if (e.examples.length) {
      console.log("Examples:");
      for (const ex of e.examples) console.log(`  • ${ex}`);
    }
  }

  // One-to-one math
  console.log("\n" + "=".repeat(72));
  console.log("ONE-TO-ONE MATCH ANALYSIS");
  console.log("=".repeat(72));
  const matched = bodyHeadings.filter((f) =>
    importedTitles.has(normalizeTitle(f.text))
  );
  console.log(`Body heading candidates (¶36+): ${bodyHeadings.length}`);
  console.log(`Imported titles matching a body candidate: ${matched.length}`);
  console.log(`Missed body candidates: ${bodyHeadings.length - matched.length}`);
  console.log(`Extra imported sections (no exact title match in body candidates): ${
    blocks.filter((b) => {
      const k = normalizeTitle(b.title);
      if (bodyHeadings.some((f) => normalizeTitle(f.text) === k)) return false;
      if (b.title.length > 80) return true; // prose boundary
      return !tocCandidates.some((f) => normalizeTitle(f.text) === k);
    }).length
  }`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

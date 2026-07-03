import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { buildImportDraft } from "../src/lib/import/build-import-draft.ts";
import { extractDocxParagraphs } from "../src/lib/import/docx-xml.ts";

const DOCX =
  process.argv[2] ??
  "/Users/michael.mangialardi/Downloads/2026_27_Student_Handbook.docx";
const PDF =
  process.argv[3] ??
  "/Users/michael.mangialardi/Downloads/2026_27_Student_Handbook.pdf";

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function collectTitles(
  blocks: { title: string; relativeDepth: number; content: string }[]
) {
  return blocks.map((b) => ({
    depth: b.relativeDepth,
    title: b.title.trim(),
    chars: b.content.length,
    words: wordCount(b.content),
  }));
}

async function extractPdfText(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  const result = await parser.getText();
  return result.text ?? "";
}

async function main() {
  if (!fs.existsSync(DOCX)) {
    console.error("Missing docx:", DOCX);
    process.exit(1);
  }
  if (!fs.existsSync(PDF)) {
    console.error("Missing pdf:", PDF);
    process.exit(1);
  }

  const docxBuf = fs.readFileSync(DOCX);
  const mammothHtml = (await mammoth.convertToHtml({ buffer: docxBuf })).value;
  const mammothPlain = mammothHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const paragraphs = await extractDocxParagraphs(docxBuf);
  const docxParagraphText = paragraphs
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ");

  const { blocks, draft, warnings, importMode } = await buildImportDraft(docxBuf);
  const importPlain = blocks
    .map((b) => `${b.title}\n${b.content}`)
    .join("\n\n");

  const pdfText = await extractPdfText(PDF);

  const normMammoth = normalizeText(mammothPlain);
  const normImport = normalizeText(importPlain);
  const normPdf = normalizeText(pdfText);
  const normDocxParas = normalizeText(docxParagraphText);

  function coverage(haystack: string, needle: string): number {
    if (!needle) return 0;
    const words = [...new Set(needle.split(" ").filter((w) => w.length > 4))];
    if (words.length === 0) return 0;
    let hit = 0;
    for (const w of words) {
      if (haystack.includes(w)) hit++;
    }
    return hit / words.length;
  }

  console.log("=== FILES ===");
  console.log("Original DOCX:", path.basename(DOCX), `${(docxBuf.byteLength / 1024).toFixed(1)} KB`);
  console.log("Exported PDF:", path.basename(PDF), `${(fs.statSync(PDF).size / 1024).toFixed(1)} KB`);

  console.log("\n=== TEXT VOLUME ===");
  console.log("DOCX paragraphs (xml):", wordCount(docxParagraphText), "words");
  console.log("DOCX mammoth plain:   ", wordCount(mammothPlain), "words");
  console.log("Import pipeline:      ", wordCount(importPlain), "words");
  console.log("Exported PDF text:    ", wordCount(pdfText), "words");

  console.log("\n=== IMPORT PIPELINE ===");
  console.log("Mode:", importMode);
  console.log("Top-level sections:", draft.boundaries.length);
  console.log("Total blocks (incl. children):", blocks.length);
  console.log("Warnings:", warnings.length);
  warnings.slice(0, 8).forEach((w) => console.log(" -", w));

  console.log("\n=== TOP-LEVEL STRUCTURE (import) ===");
  blocks
    .filter((b) => b.relativeDepth === 0)
    .forEach((b) => {
      const kids = blocks.filter(
        (k) => k.relativeDepth === 1 && blocks.indexOf(k) > blocks.indexOf(b)
      );
      console.log(`• ${b.title} (${wordCount(b.content)} words in parent body)`);
    });

  const topBlocks = blocks.filter((b) => b.relativeDepth === 0);
  for (const b of topBlocks) {
    const idx = blocks.indexOf(b);
    const children: typeof blocks = [];
    for (let i = idx + 1; i < blocks.length && blocks[i].relativeDepth > 0; i++) {
      if (blocks[i].relativeDepth === 1) children.push(blocks[i]);
      else break;
    }
    if (children.length > 0) {
      console.log(`  └─ ${children.length} subsections: ${children.map((c) => c.title).slice(0, 6).join(", ")}${children.length > 6 ? "…" : ""}`);
    }
  }

  console.log("\n=== PDF vs ORIGINAL CONTENT ===");
  console.log(
    "PDF word overlap with DOCX (mammoth):",
    `${(coverage(normPdf, normMammoth) * 100).toFixed(1)}%`
  );
  console.log(
    "PDF word overlap with import pipeline:",
    `${(coverage(normPdf, normImport) * 100).toFixed(1)}%`
  );
  console.log(
    "Import vs DOCX (mammoth) word overlap:",
    `${(coverage(normImport, normMammoth) * 100).toFixed(1)}%`
  );

  const mammothWords = new Set(
    normMammoth.split(" ").filter((w) => w.length > 5)
  );
  const pdfWords = new Set(normPdf.split(" ").filter((w) => w.length > 5));
  const missingFromPdf = [...mammothWords]
    .filter((w) => !pdfWords.has(w))
    .slice(0, 30);

  console.log("\n=== SAMPLE WORDS IN DOCX BUT NOT IN PDF (first 30) ===");
  console.log(missingFromPdf.join(", ") || "(none)");

  const titles = collectTitles(blocks);
  console.log("\n=== ALL IMPORTED SECTION TITLES ===");
  titles.forEach((t) => {
    console.log(
      `${"  ".repeat(t.depth)}[d${t.depth}] ${t.title} (${t.words} words)`
    );
  });

  const empty = titles.filter((t) => t.words === 0 && t.depth === 0);
  if (empty.length > 0) {
    console.log("\n=== EMPTY PARENT CONTAINERS ===");
    empty.forEach((t) => console.log(" -", t.title));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import mammoth from "mammoth";
import type { MarkdownBlock } from "@/lib/markdown-split";
import {
  resolveRelativeDepth,
  stripNumberingPrefix,
} from "./numbering";
import {
  extractSectionBoundaries,
  isLikelyTocLine,
  isTocCompositeLine,
  stripNumberingFromBoundaryTitle,
} from "./html-sections";
import { htmlToMarkdown, htmlToPlainText } from "./turndown";
import { refineImportedBlocks } from "./refine-blocks";
import type { DocxImportResult } from "./types";

const MAMMOTH_STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='heading 1'] => h1:fresh",
  "p[style-name='heading 2'] => h2:fresh",
  "p[style-name='heading 3'] => h3:fresh",
  "p[style-name='heading 4'] => h4:fresh",
  "p[style-name='heading 5'] => h5:fresh",
  "p[style-name='heading 6'] => h6:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function parseDocxToBlocks(
  buffer: Buffer
): Promise<DocxImportResult> {
  const warnings: string[] = [];

  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("File exceeds 10MB limit");
  }

  const result = await mammoth.convertToHtml(
    { buffer },
    { styleMap: MAMMOTH_STYLE_MAP }
  );

  if (result.messages.length > 0) {
    for (const msg of result.messages) {
      if (msg.type === "warning") {
        warnings.push(msg.message);
      }
    }
  }

  const html = result.value;
  const { boundaries } = extractSectionBoundaries(html);

  if (boundaries.length === 0) {
    const markdown = htmlToMarkdown(html);
    const plain = htmlToPlainText(html);
    const title =
      plain.split("\n")[0]?.slice(0, 80).trim() || "Imported Handbook";

    warnings.push(
      "No section headings detected. The document was imported as a single section — use the organizer to split it."
    );

    return {
      blocks: [
        {
          relativeDepth: 0,
          title,
          content: markdown || plain,
        },
      ],
      warnings,
    };
  }

  const blocks: MarkdownBlock[] = [];
  let baseLevel: number | null = null;
  let skippedToc = 0;

  for (const boundary of boundaries) {
    const plainTitle = boundary.title.trim();
    if (isLikelyTocLine(plainTitle) || isTocCompositeLine(plainTitle)) {
      skippedToc++;
      continue;
    }

    const numbering = stripNumberingFromBoundaryTitle(plainTitle);
    const numberingFull = stripNumberingPrefix(plainTitle);

    if (baseLevel === null) {
      baseLevel = boundary.headingLevel;
    }

    const relativeDepth = resolveRelativeDepth(
      numbering.depthHint,
      numberingFull.confidence,
      boundary.headingLevel,
      baseLevel
    );

    const content = htmlToMarkdown(boundary.html);

    if (boundary.confidence === "low") {
      warnings.push(
        `Low-confidence section boundary: "${numbering.cleanTitle}" (${boundary.source})`
      );
    }

    blocks.push({
      relativeDepth,
      title: numbering.cleanTitle,
      content,
    });
  }

  if (skippedToc > 0) {
    warnings.push(`Skipped ${skippedToc} table-of-contents line(s).`);
  }

  if (blocks.length === 0) {
    const markdown = htmlToMarkdown(html);
    warnings.push("All detected lines looked like TOC entries. Imported as single section.");
    return {
      blocks: [
        {
          relativeDepth: 0,
          title: "Imported Handbook",
          content: markdown,
        },
      ],
      warnings,
    };
  }

  // Normalize depths relative to first block (first block = 0)
  const minDepth = Math.min(...blocks.map((b) => b.relativeDepth));
  if (minDepth > 0) {
    for (const block of blocks) {
      block.relativeDepth -= minDepth;
    }
  }

  const refined = refineImportedBlocks(blocks, warnings);

  return { blocks: refined, warnings };
}

import type { MarkdownBlock } from "@/lib/markdown-split";
import type { DocxParagraphRaw } from "./docx-xml";
import { stripNumberingPrefix } from "./numbering";
import type { FlatSectionClassification } from "./llm-flat-sections";
import { isLikelyTocLine, isTocCompositeLine } from "./boundary-rules";

/** Build flat sections (all depth 0) from boundary indices. */
export function buildFlatBlocksFromBoundaries(
  paragraphs: DocxParagraphRaw[],
  classification: FlatSectionClassification
): MarkdownBlock[] {
  const boundaries = [...classification.boundaries].sort((a, b) => a - b);

  if (boundaries.length === 0) {
    const content = paragraphs
      .map((p) => p.markdown || p.text)
      .join("\n\n")
      .trim();
    const first =
      paragraphs.find((p) => p.text.trim())?.text ?? "Imported Handbook";
    return [
      {
        relativeDepth: 0,
        title: first.slice(0, 80),
        content,
      },
    ];
  }

  const boundarySet = new Set(boundaries);
  const blocks: MarkdownBlock[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const index = boundaries[i];
    const para = paragraphs.find((p) => p.index === index);
    if (!para) continue;

    const numbering = stripNumberingPrefix(para.text);
    const nextIndex = boundaries[i + 1] ?? Number.MAX_SAFE_INTEGER;

    const bodyParts: string[] = [];
    for (const p of paragraphs) {
      if (p.index <= index) continue;
      if (p.index >= nextIndex) break;
      if (boundarySet.has(p.index)) continue;
      const line = (p.markdown || p.text).trim();
      if (!line) continue;
      if (isLikelyTocLine(line) || isTocCompositeLine(line)) continue;
      bodyParts.push(line);
    }

    blocks.push({
      relativeDepth: 0,
      title: numbering.cleanTitle || para.text.slice(0, 80),
      content: bodyParts.join("\n\n").trim(),
    });
  }

  return blocks;
}

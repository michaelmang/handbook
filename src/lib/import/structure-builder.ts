import type { MarkdownBlock } from "@/lib/markdown-split";
import type { DocxParagraphRaw } from "./docx-xml";
import { stripNumberingPrefix } from "./numbering";
import type { StructureClassification } from "./llm-structure";

export function buildBlocksFromStructure(
  paragraphs: DocxParagraphRaw[],
  structure: StructureClassification
): MarkdownBlock[] {
  const skipSet = new Set(structure.skip);
  const headingIndices = new Set(structure.headings.map((h) => h.index));
  const headings = [...structure.headings]
    .filter((h) => !skipSet.has(h.index))
    .sort((a, b) => a.index - b.index);

  if (headings.length === 0) {
    const content = paragraphs
      .filter((p) => !skipSet.has(p.index))
      .map((p) => p.markdown || p.text)
      .join("\n\n")
      .trim();
    const firstLine =
      paragraphs.find((p) => p.text.trim())?.text ?? "Imported Handbook";
    return [
      {
        relativeDepth: 0,
        title: firstLine.slice(0, 80),
        content,
      },
    ];
  }

  const minLevel = Math.min(...headings.map((h) => h.level));
  const blocks: MarkdownBlock[] = [];

  for (let h = 0; h < headings.length; h++) {
    const { index, level } = headings[h];
    const para = paragraphs.find((p) => p.index === index);
    if (!para) continue;

    const numbering = stripNumberingPrefix(para.text);
    const nextIndex = headings[h + 1]?.index ?? Number.MAX_SAFE_INTEGER;

    const bodyParts: string[] = [];
    for (const p of paragraphs) {
      if (p.index <= index) continue;
      if (p.index >= nextIndex) break;
      if (skipSet.has(p.index)) continue;
      if (headingIndices.has(p.index)) continue;
      const line = (p.markdown || p.text).trim();
      if (line) bodyParts.push(line);
    }

    blocks.push({
      relativeDepth: Math.max(0, level - minLevel),
      title: numbering.cleanTitle || para.text.slice(0, 80),
      content: bodyParts.join("\n\n").trim(),
    });
  }

  return blocks;
}

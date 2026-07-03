import type { MarkdownBlock } from "@/lib/markdown-split";
import {
  isLikelyTocLine,
  isTocCompositeLine,
  scoreBlockContent,
  stripTocLinesFromMarkdown,
} from "./boundary-rules";

/**
 * Post-process imported blocks: strip TOC noise, split Word outline lists,
 * deduplicate titles, normalize depths.
 */
export function refineImportedBlocks(
  blocks: MarkdownBlock[],
  warnings: string[]
): MarkdownBlock[] {
  if (blocks.length === 0) return blocks;

  let result = blocks.map((b) => ({
    ...b,
    content: stripTocLinesFromMarkdown(b.content),
  }));

  result = expandOutlineListBodies(result, warnings);
  result = dedupeBlocksByTitle(result, warnings);
  result = normalizeBlockDepths(result);

  return result;
}

/** Split bodies that begin with Word-style numbered bold outline items. */
function expandOutlineListBodies(
  blocks: MarkdownBlock[],
  warnings: string[]
): MarkdownBlock[] {
  const expanded: MarkdownBlock[] = [];

  for (const block of blocks) {
    const split = splitNestedOutlineInBody(block);
    if (split.length > 1) {
      warnings.push(
        `Split nested outline list under "${block.title}" into ${split.length - 1} subsection(s).`
      );
    }
    expanded.push(...split);
  }

  return expanded;
}

export function splitNestedOutlineInBody(block: MarkdownBlock): MarkdownBlock[] {
  const lines = block.content.split("\n");
  const sections: { title: string; startIdx: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*\d+\.\s+\*\*([^*]+)\*\*/);
    if (!match) continue;
    const title = match[1].trim();
    if (!title || title.length > 80) continue;
    if (isLikelyTocLine(title) || isTocCompositeLine(title)) continue;
    sections.push({ title, startIdx: i });
  }

  if (sections.length < 2 || sections[0].startIdx > 4) {
    return [block];
  }

  const preamble = lines.slice(0, sections[0].startIdx).join("\n").trim();
  const children: MarkdownBlock[] = [];

  for (let s = 0; s < sections.length; s++) {
    const end =
      s + 1 < sections.length ? sections[s + 1].startIdx : lines.length;
    const content = lines.slice(sections[s].startIdx + 1, end).join("\n").trim();
    children.push({
      relativeDepth: block.relativeDepth + 1,
      title: sections[s].title,
      content,
    });
  }

  if (preamble) {
    return [{ ...block, content: preamble }, ...children];
  }

  if (block.title.trim()) {
    return [{ ...block, content: "" }, ...children];
  }

  return children;
}

function dedupeBlocksByTitle(
  blocks: MarkdownBlock[],
  warnings: string[]
): MarkdownBlock[] {
  const result: MarkdownBlock[] = [];

  for (const block of blocks) {
    const key = block.title.toLowerCase().trim();
    const existingIdx = result.findIndex(
      (b) => b.title.toLowerCase().trim() === key
    );

    if (existingIdx === -1) {
      result.push({ ...block });
      continue;
    }

    const existing = result[existingIdx];
    const existingScore = scoreBlockContent(existing.content);
    const newScore = scoreBlockContent(block.content);

    if (newScore > existingScore) {
      warnings.push(
        `Merged duplicate "${block.title}" (kept copy with more substantive content).`
      );
      if (existing.content.trim() && block.content.trim()) {
        existing.content = `${block.content}\n\n${existing.content}`.trim();
      } else {
        existing.content = block.content || existing.content;
      }
      existing.relativeDepth = Math.min(
        existing.relativeDepth,
        block.relativeDepth
      );
    } else {
      warnings.push(
        `Skipped duplicate "${block.title}" (${newScore === 0 ? "empty" : "shorter"} copy).`
      );
      if (!existing.content.trim() && block.content.trim()) {
        existing.content = block.content;
      }
    }
  }

  return result;
}

/** Flat import: strip TOC noise and dedupe titles without outline splitting. */
export function dedupeFlatBlocks(
  blocks: MarkdownBlock[],
  warnings: string[]
): MarkdownBlock[] {
  if (blocks.length === 0) return blocks;

  const result = blocks.map((b) => ({
    ...b,
    relativeDepth: 0,
    content: stripTocLinesFromMarkdown(b.content),
  }));

  return dedupeBlocksByTitle(result, warnings);
}

export function normalizeBlockDepths(blocks: MarkdownBlock[]): MarkdownBlock[] {
  if (blocks.length === 0) return blocks;

  const minDepth = Math.min(...blocks.map((b) => b.relativeDepth));
  if (minDepth > 0) {
    for (const block of blocks) {
      block.relativeDepth -= minDepth;
    }
  }

  return blocks;
}

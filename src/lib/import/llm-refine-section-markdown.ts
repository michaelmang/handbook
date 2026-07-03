import { nanoid } from "nanoid";
import type { MarkdownBlock } from "@/lib/markdown-split";
import type { SectionDraft } from "./import-draft-types";
import type { ImportProgressReporter } from "./import-progress";
import { noopProgress } from "./import-progress";
import { isLikelyTocLine, isTocCompositeLine } from "./boundary-rules";
import { formatSectionMarkdown } from "./format-import-markdown";

export interface LlmSubsection {
  title: string;
  content: string;
}

export interface LlmSectionMarkdownResult {
  preamble?: string;
  subsections: LlmSubsection[];
  removedHeadings?: string[];
  notes?: string;
}

const MAX_SECTION_CHARS = 18_000;
const MIN_CHARS_FOR_LLM = 400;

const SYSTEM_PROMPT = `You improve imported handbook markdown for ONE top-level section from a Word document.

The coarse import often leaves many subsection titles as plain lines in the body. Your job is to reorganize markdown — NOT to rewrite policy text.

Input JSON:
- parentTitle: known top-level section name
- content: body markdown (prose, bold lines, occasional list items)

Goals:
1. Split into logical subsections where the source clearly has distinct policy topics
2. Each subsection has a concise title and body markdown (no title line repeated at the start of body)
3. Remove stale heading lines: repeats of parentTitle, table-of-contents artifacts, or titles that belong to a different major part of the handbook
4. Preserve original wording — only delete redundant title lines and add structure
5. Standalone short lines before paragraphs are usually subsection titles (e.g. "Bullying", "Honor Code", "Discipline")
6. Format numbers and lists as proper markdown:
   - Consecutive numbered lines → ordered list ("1. ", "2. ", …)
   - Nested outline numbers (2.1, 2.2) → indent 2 spaces per level, keep numeric label
   - Consecutive short requirement lines → bullet list ("- ")
   - Lettered rows (a. b. c.) → bullets or ordered list matching the source
   - Keep **bold** inside list items; do not drop list content
7. Do not convert a single standalone short line between prose paragraphs into a list (likely a subheading)

Output JSON only:
{
  "preamble": "optional short intro kept under parent (omit if none)",
  "subsections": [
    { "title": "Expectations", "content": "markdown body without the title line" }
  ],
  "removedHeadings": ["exact lines removed"],
  "notes": "optional brief note"
}

Rules:
- If there are no real subsections, return one subsection with title=parentTitle and cleaned content
- Do not invent subsections from a single continuous policy paragraph
- Subsection content must not begin with the title as plain text or **bold**
- Prefer 3–15 subsections for long parts; merge tiny fragments into neighbors
- Keep markdown formatting (**bold**, lists) from the source
- Use markdown lists for policy enumerations instead of plain line-per-item text`;

function parseResultJson(raw: string): LlmSectionMarkdownResult {
  const parsed = JSON.parse(raw) as LlmSectionMarkdownResult;
  if (!Array.isArray(parsed.subsections)) {
    throw new Error("Invalid LLM response: missing subsections");
  }
  return {
    preamble: typeof parsed.preamble === "string" ? parsed.preamble.trim() : "",
    subsections: parsed.subsections
      .filter((s) => s && typeof s.title === "string")
      .map((s) => ({
        title: s.title.trim(),
        content: typeof s.content === "string" ? s.content.trim() : "",
      }))
      .filter((s) => s.title.length > 0),
    removedHeadings: Array.isArray(parsed.removedHeadings)
      ? parsed.removedHeadings.filter((h) => typeof h === "string")
      : [],
    notes: parsed.notes,
  };
}

async function callOpenAi(
  parentTitle: string,
  content: string
): Promise<LlmSectionMarkdownResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ parentTitle, content }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI API error (${response.status}): ${errText.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Empty LLM response");
  return parseResultJson(raw);
}

/** Remove lines that likely repeat the section title or look like TOC noise. */
export function trimStaleHeadingLines(
  parentTitle: string,
  content: string,
  siblingTitles: string[] = []
): { content: string; removed: string[] } {
  const parentKey = normalizeHeadingKey(parentTitle);
  const siblingKeys = new Set(siblingTitles.map(normalizeHeadingKey));
  const removed: string[] = [];
  const kept: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push(line);
      continue;
    }

    const plain = trimmed.replace(/^\*\*|\*\*$/g, "").trim();
    const key = normalizeHeadingKey(plain);

    if (
      key === parentKey ||
      siblingKeys.has(key) ||
      isLikelyTocLine(plain) ||
      isTocCompositeLine(plain)
    ) {
      if (plain.length <= 120 && !plain.endsWith(".")) {
        removed.push(trimmed);
        continue;
      }
    }

    kept.push(line);
  }

  return {
    content: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    removed,
  };
}

function normalizeHeadingKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/^\d+(?:\.\d+)*\s*/, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTitleFromContentStart(title: string, content: string): string {
  const lines = content.split("\n");
  const titleKey = normalizeHeadingKey(title);
  while (lines.length > 0) {
    const first = lines[0].trim();
    if (!first) {
      lines.shift();
      continue;
    }
    const plain = first.replace(/^\*\*|\*\*$/g, "").trim();
    if (normalizeHeadingKey(plain) === titleKey) {
      lines.shift();
      continue;
    }
    break;
  }
  return lines.join("\n").trim();
}

export function subsectionsToBlocks(
  parentTitle: string,
  parentDepth: number,
  result: LlmSectionMarkdownResult
): MarkdownBlock[] {
  const subs = result.subsections.filter((s) => s.title && s.content.trim());
  if (subs.length === 0) {
    const body =
      result.preamble?.trim() ||
      result.subsections[0]?.content.trim() ||
      "";
    return [{ relativeDepth: parentDepth, title: parentTitle, content: formatSectionMarkdown(body) }];
  }

  if (
    subs.length === 1 &&
    normalizeHeadingKey(subs[0].title) === normalizeHeadingKey(parentTitle)
  ) {
    const preamble = result.preamble?.trim();
    const content = [preamble, subs[0].content].filter(Boolean).join("\n\n");
    return [
      {
        relativeDepth: parentDepth,
        title: parentTitle,
        content: formatSectionMarkdown(
          stripTitleFromContentStart(parentTitle, content)
        ),
      },
    ];
  }

  const blocks: MarkdownBlock[] = [];
  const preamble = result.preamble?.trim() ?? "";
  blocks.push({
    relativeDepth: parentDepth,
    title: parentTitle,
    content: preamble ? formatSectionMarkdown(preamble) : "",
  });

  for (const sub of subs) {
    blocks.push({
      relativeDepth: parentDepth + 1,
      title: sub.title,
      content: formatSectionMarkdown(
        stripTitleFromContentStart(sub.title, sub.content)
      ),
    });
  }

  return blocks;
}

export function sectionDraftsFromBlocks(blocks: MarkdownBlock[]): SectionDraft[] {
  return blocks.map((b, index) => ({
    id: nanoid(10),
    boundaryIndex: index,
    title: b.title,
    content: b.content,
    charCount: b.content.length,
    relativeDepth: b.relativeDepth,
    issueIds: [],
    carryOver: true,
  }));
}

function shouldRefineWithLlm(block: MarkdownBlock): boolean {
  if (block.relativeDepth !== 0) return false;
  return block.content.trim().length >= MIN_CHARS_FOR_LLM;
}

export async function refineSectionMarkdownWithLlm(
  block: MarkdownBlock,
  siblingTitles: string[]
): Promise<MarkdownBlock[]> {
  const trimmed = trimStaleHeadingLines(
    block.title,
    block.content,
    siblingTitles
  );
  let content = formatSectionMarkdown(trimmed.content);

  if (content.length > MAX_SECTION_CHARS) {
    content = `${content.slice(0, MAX_SECTION_CHARS)}\n\n[…section truncated for processing…]`;
  }

  if (!shouldRefineWithLlm({ ...block, content })) {
    return [
      {
        relativeDepth: block.relativeDepth,
        title: block.title,
        content: formatSectionMarkdown(content),
      },
    ];
  }

  const result = await callOpenAi(block.title, content);
  return subsectionsToBlocks(block.title, block.relativeDepth, {
    ...result,
    removedHeadings: [...(result.removedHeadings ?? []), ...trimmed.removed],
  });
}

export interface RefineMarkdownSectionsOutcome {
  blocks: MarkdownBlock[];
  refinedSectionCount: number;
  changelog: string[];
  warnings: string[];
}

export async function refineMarkdownSectionsWithLlm(
  blocks: MarkdownBlock[],
  onProgress: ImportProgressReporter = noopProgress
): Promise<RefineMarkdownSectionsOutcome> {
  const changelog: string[] = [];
  const warnings: string[] = [];
  const topLevel = blocks.filter((b) => b.relativeDepth === 0);
  const topTitles = topLevel.map((b) => b.title);

  if (topLevel.length === 0) {
    return { blocks, refinedSectionCount: 0, changelog, warnings };
  }

  if (!process.env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY not set — skipped AI section structuring.");
    return { blocks, refinedSectionCount: 0, changelog, warnings };
  }

  if (process.env.OPENAI_SKIP_MARKDOWN_REFINE === "true") {
    return { blocks, refinedSectionCount: 0, changelog, warnings };
  }

  const refined: MarkdownBlock[] = [];
  let refinedCount = 0;
  let topIndex = 0;

  for (const block of blocks) {
    if (block.relativeDepth !== 0) {
      refined.push(block);
      continue;
    }

    topIndex++;
    onProgress({
      phase: "pass_b",
      status: "progress",
      message: "Structuring section content",
      detail: block.title,
      current: topIndex,
      total: topLevel.length,
    });

    try {
      const siblings = topTitles.filter((t) => t !== block.title);
      const expanded = await refineSectionMarkdownWithLlm(block, siblings);
      if (expanded.length > 1 || expanded[0].content !== block.content) {
        refinedCount++;
        changelog.push(
          `AI structured "${block.title}" → ${expanded.length} block(s)`
        );
      }
      refined.push(...expanded);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "LLM section refine failed";
      warnings.push(`Could not structure "${block.title}": ${message}`);
      refined.push(block);
    }
  }

  onProgress({
    phase: "pass_b",
    status: "complete",
    message: "Section content structured",
    detail:
      refinedCount > 0
        ? `${refinedCount} part(s) expanded with subsections`
        : "No changes needed",
  });

  return {
    blocks: refined,
    refinedSectionCount: refinedCount,
    changelog,
    warnings,
  };
}

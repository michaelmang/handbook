export interface MarkdownBlock {
  /** Depth relative to the first heading in the file (0 = top of imported subtree) */
  relativeDepth: number;
  title: string;
  /** Body content only — heading line is excluded */
  content: string;
}

function cleanHeadingTitle(raw: string): string {
  return raw.replace(/\*\*|__/g, "").trim();
}

/**
 * Split a Markdown file into a nested outline from its headings.
 * The first heading sets the baseline; deeper headings become children.
 * A file with no headings becomes a single section.
 */
export function splitMarkdownByHeadings(markdown: string): MarkdownBlock[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];

  const lines = trimmed.split("\n");
  const blocks: MarkdownBlock[] = [];
  let baseLevel: number | null = null;
  let current: MarkdownBlock | null = null;
  const preamble: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = cleanHeadingTitle(match[2]);

      if (baseLevel === null) {
        baseLevel = level;
      }

      if (current) {
        blocks.push({ ...current, content: current.content.trim() });
      }

      const relativeDepth = level - baseLevel;
      const leadingContent =
        blocks.length === 0 && preamble.length > 0
          ? preamble.join("\n").trim()
          : "";

      current = {
        relativeDepth,
        title,
        content: leadingContent,
      };
      preamble.length = 0;
    } else if (current) {
      current.content += (current.content ? "\n" : "") + line;
    } else {
      preamble.push(line);
    }
  }

  if (current) {
    blocks.push({ ...current, content: current.content.trim() });
  }

  if (blocks.length === 0) {
    return [
      {
        relativeDepth: 0,
        title: extractTitleFromMarkdown(trimmed),
        content: trimmed,
      },
    ];
  }

  return blocks;
}

export function extractTitleFromMarkdown(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return "Untitled Section";

  const match = trimmed.match(/^#{1,6}\s+(.+)$/m);
  if (match) {
    return cleanHeadingTitle(match[1]);
  }

  const firstLine = trimmed.split("\n")[0].trim();
  if (firstLine) return firstLine.slice(0, 80);
  return "Untitled Section";
}

export function stripLeadingHeading(markdown: string): string {
  const trimmed = markdown.trim();
  const withoutHeading = trimmed.replace(/^#{1,6}\s+.+\n?/, "");
  return withoutHeading.trim() || trimmed;
}

// Re-export heading extraction for diagnostics
export { extractHeadings } from "./markdown-headings";

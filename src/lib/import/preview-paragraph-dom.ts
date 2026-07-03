import { htmlToMarkdown } from "./turndown";

const UNORDERED_LIST_TYPES = new Set(["disc", "circle", "square"]);

/** Word list level from docx-preview numbering class (`docx-num-{id}-{level}`). */
export function parseDocxNumberingClass(el: HTMLElement): number | null {
  for (const cls of el.classList) {
    const match = cls.match(/^docx-num-\d+-(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/** Visible prefix from docx-preview ::before counters / bullets. */
export function getPseudoBeforeText(el: HTMLElement): string {
  try {
    const content = window.getComputedStyle(el, "::before").content;
    if (!content || content === "none" || content === "normal") return "";
    return content
      .replace(/^["']|["']$/g, "")
      .replace(/\\9/g, "\t")
      .replace(/\\a0/g, " ")
      .trim();
  } catch {
    return "";
  }
}

/** Paragraph text including Word list / outline numbers when rendered by docx-preview. */
export function getParagraphDisplayText(el: HTMLElement): string {
  const before = getPseudoBeforeText(el);
  const body = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (before && body) {
    return `${before}${body}`.replace(/\s+/g, " ").trim();
  }
  return before || body;
}

export function inferPreviewListLevel(el: HTMLElement): number | null {
  const fromClass = parseDocxNumberingClass(el);
  if (fromClass != null) return fromClass;

  const style = window.getComputedStyle(el);
  if (style.display === "list-item" || style.listStyleType !== "none") {
    const indent =
      parseFloat(style.marginLeft) +
      parseFloat(style.paddingLeft) +
      parseFloat(style.textIndent);
    if (indent >= 14) {
      return Math.min(4, Math.round(indent / 28));
    }
    return 0;
  }

  const indent =
    parseFloat(style.marginLeft) +
    parseFloat(style.paddingLeft) +
    parseFloat(style.textIndent);
  if (indent < 14) return null;
  return Math.min(4, Math.round(indent / 28));
}

export function isPreviewListParagraph(el: HTMLElement): boolean {
  if (parseDocxNumberingClass(el) != null) return true;
  if (getPseudoBeforeText(el)) return true;

  const style = window.getComputedStyle(el);
  return style.display === "list-item" && style.listStyleType !== "none";
}

export function isOrderedListParagraph(el: HTMLElement): boolean {
  if (parseDocxNumberingClass(el) != null) return true;

  const style = window.getComputedStyle(el);
  const type = style.listStyleType;
  if (type && type !== "none" && !UNORDERED_LIST_TYPES.has(type)) {
    return true;
  }

  const text = getParagraphDisplayText(el);
  return /^\d+(?:\.\d+)*[.)]?\s/.test(text);
}

function paragraphBodyMarkdown(p: HTMLElement): string {
  const inner = htmlToMarkdown(p.innerHTML).trim();
  if (inner) {
    return inner
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return (p.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function paragraphToMarkdownBlock(p: HTMLElement): string {
  if (!isPreviewListParagraph(p)) {
    return paragraphBodyMarkdown(p);
  }

  const level = inferPreviewListLevel(p) ?? 0;
  const indent = "  ".repeat(level);
  const before = getPseudoBeforeText(p);
  let body = paragraphBodyMarkdown(p);

  if (before) {
    const prefix = before.trimEnd();
    if (prefix && !body.startsWith(prefix)) {
      body = `${prefix} ${body}`.replace(/\s+/g, " ").trim();
    }
  }

  const marker = isOrderedListParagraph(p) ? "1." : "-";
  return `${indent}${marker} ${body}`;
}

/** Markdown for docx-preview paragraphs (lists, numbers, inline formatting). */
export function previewParagraphsToMarkdown(paragraphs: HTMLElement[]): string {
  const chunks: string[] = [];
  let listRun: string[] = [];

  const flushList = () => {
    if (listRun.length === 0) return;
    chunks.push(listRun.join("\n"));
    listRun = [];
  };

  for (const p of paragraphs) {
    const block = paragraphToMarkdownBlock(p);
    if (!block) continue;

    if (isPreviewListParagraph(p)) {
      listRun.push(block);
    } else {
      flushList();
      chunks.push(block);
    }
  }

  flushList();
  return chunks.join("\n\n").trim();
}

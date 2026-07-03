import { previewParagraphsToMarkdown } from "./preview-paragraph-dom";
import { htmlToMarkdown } from "./turndown";

export interface SelectionSnapshot {
  html: string;
  text: string;
  paragraphs: HTMLElement[];
}

function rangeIntersectsNode(range: Range, node: Node): boolean {
  if (typeof range.intersectsNode === "function") {
    try {
      return range.intersectsNode(node);
    } catch {
      // Fall through to manual comparison.
    }
  }

  const nodeRange = document.createRange();
  nodeRange.selectNodeContents(node);
  return (
    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
  );
}

function collectParagraphsInRange(
  root: HTMLElement,
  range: Range
): HTMLElement[] {
  const selector = "section.docx p, article p";
  const candidates =
    root.querySelectorAll(selector).length > 0
      ? root.querySelectorAll(selector)
      : root.querySelectorAll("p");

  const paragraphs: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  candidates.forEach((node) => {
    if (!(node instanceof HTMLElement) || seen.has(node)) return;
    if (!rangeIntersectsNode(range, node)) return;
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    seen.add(node);
    paragraphs.push(node);
  });

  return paragraphs;
}

/** Read the current window selection if it lives inside `root`. */
export function getSelectionInElement(
  root: HTMLElement
): SelectionSnapshot | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const text = sel.toString().replace(/\u00a0/g, " ").trim();
  if (!text) return null;

  const fragment = range.cloneContents();
  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment);

  return {
    html: wrapper.innerHTML,
    text,
    paragraphs: collectParagraphsInRange(root, range),
  };
}

function stripLeadingListMarker(line: string): string {
  return line
    .replace(/^(\s*)[-*+]\s+/, "$1")
    .replace(/^(\s*)\d+\.\s+/, "$1")
    .trim();
}

/** Split markdown into handbook section title + body. */
export function splitMarkdownSection(markdown: string): {
  title: string;
  content: string;
} {
  const trimmed = markdown.trim();
  if (!trimmed) {
    throw new Error("Selection is empty — highlight some text first");
  }

  const lines = trimmed.split("\n");
  const first = lines[0]?.trim() ?? "";
  const firstContent = stripLeadingListMarker(first);

  const h1 = firstContent.match(/^#\s+(.+)$/);
  if (h1) {
    return {
      title: h1[1].trim(),
      content: lines.slice(1).join("\n").trim(),
    };
  }

  const h2 = firstContent.match(/^##\s+(.+)$/);
  if (h2) {
    return {
      title: h2[1].trim(),
      content: lines.slice(1).join("\n").trim(),
    };
  }

  const bold = firstContent.match(/^\*\*(.+)\*\*$/);
  if (bold) {
    return {
      title: bold[1].trim(),
      content: lines.slice(1).join("\n").trim(),
    };
  }

  if (
    firstContent &&
    firstContent.length <= 120 &&
    !firstContent.endsWith(".")
  ) {
    return {
      title: firstContent.replace(/\*\*/g, "").trim(),
      content: lines.slice(1).join("\n").trim(),
    };
  }

  const title =
    firstContent.length > 80
      ? `${firstContent.slice(0, 77).trim()}…`
      : firstContent || "Imported section";

  return {
    title,
    content: lines.length > 1 ? lines.slice(1).join("\n").trim() : "",
  };
}

export function sectionFromPreviewParagraphs(paragraphs: HTMLElement[]): {
  title: string;
  content: string;
} {
  const markdown = previewParagraphsToMarkdown(paragraphs);
  return splitMarkdownSection(markdown);
}

/** Turn selected HTML into a handbook section (title + markdown body). */
export function sectionFromSelectionHtml(html: string): {
  title: string;
  content: string;
} {
  const markdown = htmlToMarkdown(html).trim();
  return splitMarkdownSection(markdown);
}

export function sectionFromSelection(
  snapshot: SelectionSnapshot
): { title: string; content: string } {
  if (snapshot.paragraphs.length > 0) {
    return sectionFromPreviewParagraphs(snapshot.paragraphs);
  }
  return sectionFromSelectionHtml(snapshot.html);
}

export function sectionFromPastedText(text: string): {
  title: string;
  content: string;
} {
  const trimmed = text.replace(/\u00a0/g, " ").trim();
  if (!trimmed) {
    throw new Error("Nothing to paste — copy text from the document first");
  }

  const wrapper = document.createElement("div");
  wrapper.innerText = trimmed;
  return sectionFromSelectionHtml(wrapper.innerHTML);
}

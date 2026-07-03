import {
  looksLikeCapsTitle,
  looksLikeOutlineTitle,
  stripNumberingPrefix,
} from "./numbering";
import { isPlausibleSectionTitle } from "./boundary-rules";
import type { ParsedSectionBoundary } from "./types";
import { htmlToPlainText } from "./turndown";

const HEADING_TAG = /^h([1-6])$/i;

interface HtmlNode {
  tag: string;
  html: string;
  text: string;
}

/** Split mammoth HTML into sequential block-level nodes. */
export function parseHtmlNodes(html: string): HtmlNode[] {
  const nodes: HtmlNode[] = [];
  const blockRegex =
    /<(h[1-6]|p|ul|ol|table|blockquote|div)[^>]*>([\s\S]*?)<\/\1>/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    const fullHtml = match[0];
    const text = htmlToPlainText(inner);

    if (tag === "div" && !text.trim()) continue;

    nodes.push({ tag, html: fullHtml, text });
  }

  if (nodes.length === 0 && html.trim()) {
    nodes.push({ tag: "p", html, text: htmlToPlainText(html) });
  }

  return nodes;
}

function isBoldShortParagraph(html: string, text: string): boolean {
  if (!text || text.length > 120 || text.endsWith(".")) return false;
  return /^(?:<p[^>]*>)?\s*<strong>([^<]+)<\/strong>\s*(?:<\/p>)?$/i.test(
    html.trim()
  );
}

function classifyNode(node: HtmlNode): ParsedSectionBoundary | null {
  const headingMatch = node.tag.match(HEADING_TAG);
  if (headingMatch) {
    const level = parseInt(headingMatch[1], 10);
    const title = node.text.trim();
    if (!title) return null;
    return {
      title,
      html: "",
      headingLevel: level,
      confidence: "high",
      source: "heading-style",
    };
  }

  if (node.tag !== "p") return null;

  const text = node.text.trim();
  if (!text) return null;

  if (isBoldShortParagraph(node.html, text)) {
    return {
      title: text,
      html: "",
      headingLevel: 2,
      confidence: "medium",
      source: "bold-short",
    };
  }

  if (looksLikeOutlineTitle(text)) {
    return {
      title: text,
      html: "",
      headingLevel: 2,
      confidence: "medium",
      source: "outline-number",
    };
  }

  if (looksLikeCapsTitle(text)) {
    return {
      title: text,
      html: "",
      headingLevel: 2,
      confidence: "low",
      source: "all-caps",
    };
  }

  return null;
}

export function extractSectionBoundaries(html: string): {
  boundaries: ParsedSectionBoundary[];
  orphanHtml: string;
} {
  const nodes = parseHtmlNodes(html);
  const boundaries: ParsedSectionBoundary[] = [];
  let currentBody: string[] = [];
  let preamble: string[] = [];

  const attachBodyToPrevious = () => {
    if (boundaries.length === 0 || currentBody.length === 0) return;
    const prev = boundaries[boundaries.length - 1];
    prev.html = [prev.html, currentBody.join("\n")].filter(Boolean).join("\n").trim();
    currentBody = [];
  };

  for (const node of nodes) {
    const boundary = classifyNode(node);

    if (boundary && isPlausibleSectionTitle(boundary.title, boundary.source)) {
      attachBodyToPrevious();
      if (boundaries.length === 0 && preamble.length > 0) {
        boundary.html = preamble.join("\n");
        preamble = [];
      }
      boundaries.push(boundary);
    } else if (boundaries.length === 0) {
      preamble.push(node.html);
    } else {
      currentBody.push(node.html);
    }
  }

  attachBodyToPrevious();

  const orphanHtml =
    boundaries.length === 0 ? preamble.concat(currentBody).join("\n") : "";

  return { boundaries, orphanHtml };
}

export { isLikelyTocLine, isTocCompositeLine } from "./boundary-rules";

export function stripNumberingFromBoundaryTitle(title: string): {
  cleanTitle: string;
  depthHint: number | null;
  confidence: import("./numbering").NumberingParseResult["confidence"];
} {
  const parsed = stripNumberingPrefix(title);
  return {
    cleanTitle: parsed.cleanTitle,
    depthHint: parsed.depthHint,
    confidence: parsed.confidence,
  };
}

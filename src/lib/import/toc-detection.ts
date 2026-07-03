import type { DocxParagraphRaw } from "./docx-xml";
import type { ParagraphFeatures } from "./paragraph-features";
import { isLikelyTocLine, isTocCompositeLine } from "./boundary-rules";
import { isNumberedPolicyLine } from "./boundary-candidates";

export interface TocRange {
  start: number;
  end: number;
}

const GLUED_NUMBERED = /^\d+(?:\.\d+)+[A-Za-z]/;

function isTypedTocOutlineLine(f: ParagraphFeatures): boolean {
  const t = f.text.trim();
  if (!t) return false;
  if (isLikelyTocLine(t) || isTocCompositeLine(t)) return true;
  if (GLUED_NUMBERED.test(t) && f.wordCount <= 6) return true;
  if (isNumberedPolicyLine(t) && f.wordCount <= 6) return true;

  return (
    f.wordCount <= 14 &&
    !f.endsWithPeriod &&
    (f.listLevel != null || f.bold || f.fontSizeRatio >= 1.05)
  );
}

/** TOC from Word field codes in paragraph XML. */
export function detectStructuralTocRange(
  paragraphs: DocxParagraphRaw[]
): TocRange | null {
  const fieldIndices = paragraphs
    .filter((p) => p.inTocField)
    .map((p) => p.index);
  if (fieldIndices.length === 0) return null;

  const start = Math.min(...fieldIndices);
  let end = Math.max(...fieldIndices);

  for (const p of paragraphs) {
    if (p.index <= end) continue;
    if (p.inTocField || p.hasInternalHyperlink) {
      end = p.index;
      continue;
    }
    if (p.text.split(/\s+/).filter(Boolean).length <= 12 && !p.text.endsWith(".")) {
      end = p.index;
      continue;
    }
    break;
  }

  return end > start ? { start, end } : null;
}

/** Typed TOC after a "Table of Contents" heading (no Word field). */
export function detectHeuristicTocRange(
  features: ParagraphFeatures[]
): TocRange | null {
  const tocHeader = features.find((f) =>
    /^table of contents$/i.test(f.text.trim())
  );
  if (!tocHeader) return null;

  const start = tocHeader.index;
  let end = start;
  let consecutiveShort = 0;

  for (const f of features) {
    if (f.index <= start) continue;
    const t = f.text.trim();
    if (!t) continue;

    if (isTypedTocOutlineLine(f)) {
      end = f.index;
      consecutiveShort = 0;
      continue;
    }

    if (f.wordCount >= 22 || (f.wordCount >= 14 && f.endsWithPeriod)) {
      break;
    }

    if (f.wordCount <= 10) {
      end = f.index;
      consecutiveShort++;
      if (consecutiveShort > 120) break;
      continue;
    }

    break;
  }

  if (end <= start) return null;
  return { start, end };
}

function mergeRanges(a: TocRange, b: TocRange): TocRange {
  return {
    start: Math.min(a.start, b.start),
    end: Math.max(a.end, b.end),
  };
}

/** Detect table-of-contents paragraph span (exclusive of real body sections). */
export function detectTocRange(
  features: ParagraphFeatures[],
  paragraphs?: DocxParagraphRaw[]
): TocRange | null {
  const structural = paragraphs ? detectStructuralTocRange(paragraphs) : null;
  const heuristic = detectHeuristicTocRange(features);

  if (structural && heuristic) return mergeRanges(structural, heuristic);
  return structural ?? heuristic;
}

export function isInTocRange(index: number, range: TocRange | null): boolean {
  if (!range) return false;
  return index >= range.start && index <= range.end;
}

/** Cover pages and TOC — never treat as section boundaries. */
export function isExcludedFromBoundaries(
  index: number,
  range: TocRange | null
): boolean {
  if (!range) return false;
  if (index < range.start) return true;
  return isInTocRange(index, range);
}

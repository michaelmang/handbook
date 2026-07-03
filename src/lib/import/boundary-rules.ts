import type { ParsedSectionBoundary } from "./types";

/** Dot-leader TOC entry: "Attendance Policy .............. 12" */
export function isLikelyTocLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/\.{3,}\s*\d+\s*$/.test(trimmed)) return true;
  if (trimmed.length < 120 && /\.{5,}/.test(trimmed)) return true;
  if (/\t{2,}/.test(trimmed) && /\d+\s*$/.test(trimmed)) return true;
  return false;
}

/** Multiple numbered entries on one line (pasted TOC). */
export function isTocCompositeLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 220) return false;
  const segments = trimmed.match(/\d+\.\s+[A-Za-z]/g);
  return (segments?.length ?? 0) >= 2;
}

/** Short acronym labels that are not handbook chapters (PSAT, ACT, FACTS). */
export function isAcronymOnly(text: string): boolean {
  const t = text.trim().replace(/[:.]$/, "");
  if (/^APPENDIX\s/i.test(t)) return false;
  if (/\b(POLICY|HANDBOOK|GUIDELINES|PROCEDURES|CHART)\b/i.test(t)) return false;
  if (/^[A-Z]{2,6}(\s+\d+)?$/.test(t)) return true;
  if (/^[A-Z]{2,}\s+\d+$/.test(t)) return true;
  return false;
}

const SENTENCE_LIKE =
  /\b(?:may|will|shall|must|should|students?|parents?|families|teachers?)\b/i;

/** Title reads like body prose, not a heading. */
export function isSentenceLikeTitle(text: string): boolean {
  const t = text.trim();
  if (t.length < 40) return false;
  if (SENTENCE_LIKE.test(t)) return true;
  if (t.includes(": On ") || t.includes(", all ")) return true;
  if (/^["']/.test(t) && t.length > 40) return true;
  if (t.endsWith(":") && t.split(/\s+/).length >= 6) return true;
  const words = t.split(/\s+/);
  return words.length > 12;
}

/** "Skate Parties: On skate party days, all students may..." */
export function isLongColonProse(text: string): boolean {
  const colonIdx = text.indexOf(":");
  if (colonIdx <= 0 || colonIdx > 50) return false;
  const after = text.slice(colonIdx + 1).trim();
  return after.split(/\s+/).length > 8;
}

export function isPlausibleSectionTitle(
  title: string,
  source: ParsedSectionBoundary["source"]
): boolean {
  const t = title.trim();
  if (!t) return false;
  if (isLikelyTocLine(t) || isTocCompositeLine(t)) return false;

  if (t.length > 100) return false;

  if (source === "heading-style") {
    if (isSentenceLikeTitle(t) || isLongColonProse(t)) return false;
    return true;
  }

  if (source === "all-caps") {
    if (isAcronymOnly(t)) return false;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length === 1 && t.length < 24 && !/^APPENDIX/i.test(t)) {
      return false;
    }
  }

  if (source === "bold-short" && t.length > 80) return false;

  if (isSentenceLikeTitle(t) || isLongColonProse(t)) return false;

  return true;
}

export function stripTocLinesFromMarkdown(content: string): string {
  if (!content.trim()) return content;
  return content
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      return !isLikelyTocLine(t) && !isTocCompositeLine(t);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Score body content when deduplicating same-title sections. */
export function scoreBlockContent(content: string): number {
  const t = content.trim();
  if (!t) return 0;
  let score = t.length;
  const outlineItems = t.match(/^\d+\.\s+\*\*/gm);
  if (outlineItems && outlineItems.length >= 3 && t.length < 2000) {
    score *= 0.25;
  }
  return score;
}

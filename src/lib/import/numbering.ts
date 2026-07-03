export interface NumberingParseResult {
  cleanTitle: string;
  /** 0-based depth from outline numbering (e.g. 4.1.3 → 2) */
  depthHint: number | null;
  rawPrefix: string | null;
  confidence: "high" | "medium" | "low" | "none";
}

/** Roman labels after Part/Chapter/etc. may omit punctuation (e.g. "Part I Title"). */
const ROMAN_WITH_LABEL =
  /^(Part|Chapter|Section|Article)\s+([IVXLCDM]+)\s*(?:[:.\-]|[\u2013\u2014])?\s+/i;

/** Standalone roman numerals must be followed by punctuation (e.g. "II. Overview"). */
const ROMAN_STANDALONE =
  /^([IVXLCDM]+)\s*(?:[:.\-]|[\u2013\u2014])\s+/i;

const LETTER_SECTION = /^(?:Section|Article)\s+([A-Z])\s*(?:[:.\-]|[\u2013\u2014])?\s*/i;

const DECIMAL_OUTLINE = /^(\d+(?:\.\d+)*)\s*(?:(?:[:.\-]|[\u2013\u2014])\s+|\s+)/;

const LETTER_OUTLINE = /^([A-Za-z])\s*(?:[:.\-]|[\u2013\u2014])\s+/;

/**
 * Strip legacy handbook numbering from a section title and infer nesting depth.
 */
export function stripNumberingPrefix(title: string): NumberingParseResult {
  const trimmed = title.trim();
  if (!trimmed) {
    return {
      cleanTitle: "Untitled Section",
      depthHint: null,
      rawPrefix: null,
      confidence: "none",
    };
  }

  const decimal = tryDecimalOutline(trimmed);
  if (decimal) return decimal;

  const roman = tryRomanOrPart(trimmed);
  if (roman) return roman;

  const letterSection = tryLetterSection(trimmed);
  if (letterSection) return letterSection;

  const letterOutline = tryLetterOutline(trimmed);
  if (letterOutline) return letterOutline;

  return {
    cleanTitle: trimmed,
    depthHint: null,
    rawPrefix: null,
    confidence: "none",
  };
}

function tryGluedDecimalOutline(text: string): NumberingParseResult | null {
  const match = text.match(/^(\d+(?:\.\d+)+)([A-Za-z].*)$/);
  if (!match) return null;
  const segments = match[1].split(".");
  const cleanTitle = match[2].trim();
  if (!cleanTitle) return null;
  return {
    cleanTitle,
    depthHint: Math.max(0, segments.length - 1),
    rawPrefix: match[1],
    confidence: "high",
  };
}

function tryDecimalOutline(text: string): NumberingParseResult | null {
  const glued = tryGluedDecimalOutline(text);
  if (glued) return glued;
  const match = text.match(DECIMAL_OUTLINE);
  if (!match) return null;

  const segments = match[1].split(".");
  const depthHint = Math.max(0, segments.length - 1);
  const cleanTitle = text.slice(match[0].length).trim();

  if (!cleanTitle) return null;

  return {
    cleanTitle,
    depthHint,
    rawPrefix: match[1],
    confidence: segments.length > 1 ? "high" : "medium",
  };
}

function tryRomanOrPart(text: string): NumberingParseResult | null {
  const withLabel = text.match(ROMAN_WITH_LABEL);
  if (withLabel) {
    const cleanTitle = text.slice(withLabel[0].length).trim();
    if (!cleanTitle) return null;
    return {
      cleanTitle,
      depthHint: 0,
      rawPrefix: withLabel[0].trim(),
      confidence: "high",
    };
  }

  const standalone = text.match(ROMAN_STANDALONE);
  if (!standalone) return null;

  const cleanTitle = text.slice(standalone[0].length).trim();
  if (!cleanTitle) return null;

  return {
    cleanTitle,
    depthHint: 0,
    rawPrefix: standalone[1],
    confidence: "medium",
  };
}

function tryLetterSection(text: string): NumberingParseResult | null {
  const match = text.match(LETTER_SECTION);
  if (!match) return null;

  const cleanTitle = text.slice(match[0].length).trim();
  if (!cleanTitle) return null;

  return {
    cleanTitle,
    depthHint: 0,
    rawPrefix: match[0].trim(),
    confidence: "medium",
  };
}

function tryLetterOutline(text: string): NumberingParseResult | null {
  const match = text.match(LETTER_OUTLINE);
  if (!match) return null;

  const cleanTitle = text.slice(match[0].length).trim();
  if (!cleanTitle) return null;

  return {
    cleanTitle,
    depthHint: 0,
    rawPrefix: match[1],
    confidence: "low",
  };
}

/**
 * Resolve relative depth from numbering hint vs Word heading level.
 * Prefers numbering when confidence is high/medium.
 */
export function resolveRelativeDepth(
  depthHint: number | null,
  numberingConfidence: NumberingParseResult["confidence"],
  headingLevel: number,
  baseLevel: number
): number {
  const styleDepth = Math.max(0, headingLevel - baseLevel);

  if (
    depthHint !== null &&
    (numberingConfidence === "high" || numberingConfidence === "medium")
  ) {
    return depthHint;
  }

  if (depthHint !== null && numberingConfidence === "low") {
    return Math.max(styleDepth, depthHint);
  }

  return styleDepth;
}

/** Detect outline-numbered lines in plain text (heuristic section boundaries). */
export function looksLikeOutlineTitle(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return false;
  return (
    DECIMAL_OUTLINE.test(trimmed) ||
    ROMAN_WITH_LABEL.test(trimmed) ||
    ROMAN_STANDALONE.test(trimmed) ||
    LETTER_SECTION.test(trimmed)
  );
}

/** Detect ALL CAPS structural lines (short, standalone). */
export function looksLikeCapsTitle(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120 || trimmed.length < 3) return false;
  if (trimmed.endsWith(".")) return false;

  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 3) return false;
  if (letters !== letters.toUpperCase()) return false;

  // Defer acronym filtering to boundary-rules.isPlausibleSectionTitle
  return true;
}

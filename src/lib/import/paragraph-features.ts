import type { DocxParagraphRaw } from "./docx-xml";

export interface ParagraphFeatures {
  index: number;
  text: string;
  wordCount: number;
  charCount: number;
  endsWithPeriod: boolean;
  fontSizeRatio: number;
  bold: boolean;
  allCaps: boolean;
  indentLevel: number;
  listLevel: number | null;
  outlineLevel: number | null;
  spaceBeforeRatio: number;
  styleHint: string | null;
}

export interface DocumentBaselines {
  bodyFontHalfPts: number;
  bodyIndentTwips: number;
  bodySpaceBeforeTwips: number;
}

export function computeBaselines(
  paragraphs: DocxParagraphRaw[]
): DocumentBaselines {
  const proseSizes: number[] = [];
  const proseIndents: number[] = [];
  const proseSpacing: number[] = [];

  for (const p of paragraphs) {
    const words = p.text.split(/\s+/).filter(Boolean).length;
    if (words < 6) continue;
    if (p.dominantFontSizeHalfPts != null) {
      proseSizes.push(p.dominantFontSizeHalfPts);
    }
    proseIndents.push(p.leftIndentTwips);
    if (p.spaceBeforeTwips > 0) proseSpacing.push(p.spaceBeforeTwips);
  }

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  return {
    bodyFontHalfPts: median(proseSizes) || 24,
    bodyIndentTwips: median(proseIndents),
    bodySpaceBeforeTwips: median(proseSpacing) || 0,
  };
}

function indentStep(twips: number, baseline: number): number {
  if (twips <= baseline + 120) return 0;
  return Math.round((twips - baseline) / 360);
}

export function toParagraphFeatures(
  paragraph: DocxParagraphRaw,
  baselines: DocumentBaselines
): ParagraphFeatures {
  const text =
    paragraph.text.length > 160
      ? `${paragraph.text.slice(0, 157)}…`
      : paragraph.text;

  const fontSizeRatio =
    paragraph.dominantFontSizeHalfPts != null
      ? paragraph.dominantFontSizeHalfPts / baselines.bodyFontHalfPts
      : 1;

  const spaceBeforeRatio =
    baselines.bodySpaceBeforeTwips > 0
      ? paragraph.spaceBeforeTwips / baselines.bodySpaceBeforeTwips
      : paragraph.spaceBeforeTwips > 0
        ? 2
        : 1;

  return {
    index: paragraph.index,
    text,
    wordCount: paragraph.text.split(/\s+/).filter(Boolean).length,
    charCount: paragraph.text.length,
    endsWithPeriod: paragraph.text.endsWith("."),
    fontSizeRatio: Math.round(fontSizeRatio * 100) / 100,
    bold: paragraph.isBoldDominant,
    allCaps: paragraph.isAllCaps,
    indentLevel: indentStep(paragraph.leftIndentTwips, baselines.bodyIndentTwips),
    listLevel: paragraph.listLevel,
    outlineLevel: paragraph.outlineLevel,
    spaceBeforeRatio: Math.round(spaceBeforeRatio * 100) / 100,
    styleHint: paragraph.styleId,
  };
}

export function buildFeatureList(
  paragraphs: DocxParagraphRaw[]
): ParagraphFeatures[] {
  const baselines = computeBaselines(paragraphs);
  return paragraphs.map((p) => toParagraphFeatures(p, baselines));
}

export function compactForLlm(features: ParagraphFeatures[]): string {
  const rows = features.map((f) => ({
    i: f.index,
    t: f.text,
    w: f.wordCount,
    fs: f.fontSizeRatio,
    b: f.bold ? 1 : 0,
    cap: f.allCaps ? 1 : 0,
    ind: f.indentLevel,
    lst: f.listLevel,
    ol: f.outlineLevel,
    sb: f.spaceBeforeRatio,
    dot: f.endsWithPeriod ? 1 : 0,
  }));
  return JSON.stringify(rows);
}

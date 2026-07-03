import type { ParagraphFeatures } from "./paragraph-features";
import type { BoundaryCandidate, BoundarySource } from "./import-draft-types";
import {
  isNumberedPolicyLine,
  isPlausibleBoundaryParagraph,
} from "./boundary-candidates";
import { stripNumberingPrefix } from "./numbering";
import { isInTocRange, isExcludedFromBoundaries, type TocRange } from "./toc-detection";

/** Minimum weighted score to consider a paragraph as a boundary candidate. */
export const BOUNDARY_SCORE_THRESHOLD = 2.2;

/** Score at or above this is auto-selected on initial import. */
export const BOUNDARY_AUTO_SELECT_SCORE = 3.0;

export interface BoundaryScoreResult {
  score: number;
  relativeDepth: number;
  source: BoundarySource;
  confidence: BoundaryCandidate["confidence"];
  reason: string;
}

export function scoreBoundaryFeature(
  f: ParagraphFeatures,
  tocRange: TocRange | null
): BoundaryScoreResult | null {
  if (!isPlausibleBoundaryParagraph(f, tocRange)) return null;

  let score = 0;
  const reasons: string[] = [];

  const fontDev = Math.max(0, f.fontSizeRatio - 1);
  if (fontDev > 0) {
    score += fontDev * 2.5;
    reasons.push("larger than body");
  }

  if (f.bold) {
    score += 1.1;
    reasons.push("bold");
  }

  if (f.allCaps && f.wordCount <= 10) {
    score += 0.9;
    reasons.push("all caps");
  }

  if (f.wordCount <= 8 && !f.endsWithPeriod) {
    score += 0.7;
    reasons.push("short title line");
  } else if (f.wordCount <= 12 && !f.endsWithPeriod) {
    score += 0.35;
  }

  if (isNumberedPolicyLine(f.text)) {
    score += 1.8;
    reasons.push("numbered policy");
  }

  if (f.listLevel === 0 && f.bold && f.wordCount <= 12) {
    score += 1.2;
    reasons.push("top-level list heading");
  } else if (f.listLevel != null && f.listLevel > 0) {
    score -= 0.35 * f.listLevel;
  }

  if (f.spaceBeforeRatio >= 1.8) {
    score += 0.4;
    reasons.push("extra space before");
  }

  if (score < BOUNDARY_SCORE_THRESHOLD) return null;

  const relativeDepth = inferBoundaryDepth(f, score);
  const source = pickSource(f, score);
  const confidence: BoundaryCandidate["confidence"] =
    score >= BOUNDARY_AUTO_SELECT_SCORE
      ? "high"
      : score >= BOUNDARY_SCORE_THRESHOLD + 0.6
        ? "medium"
        : "low";

  return {
    score: Math.round(score * 100) / 100,
    relativeDepth,
    source,
    confidence,
    reason: reasons.join(", ") || "structural deviation",
  };
}

function pickSource(f: ParagraphFeatures, score: number): BoundarySource {
  if (isNumberedPolicyLine(f.text)) return "numbered";
  if (f.bold || f.fontSizeRatio >= 1.1) return "typography";
  return "heuristic";
}

export function inferBoundaryDepth(
  f: ParagraphFeatures,
  score: number
): number {
  const numbering = stripNumberingPrefix(f.text);
  if (
    numbering.depthHint !== null &&
    (numbering.confidence === "high" || numbering.confidence === "medium")
  ) {
    return numbering.depthHint;
  }

  if (f.outlineLevel != null) return Math.max(0, f.outlineLevel);

  if (
    f.listLevel != null &&
    (isNumberedPolicyLine(f.text) || (f.bold && f.wordCount <= 10))
  ) {
    return f.listLevel;
  }

  if (f.fontSizeRatio >= 1.14 || (f.bold && f.allCaps)) return 0;
  if (f.fontSizeRatio >= 1.06 || f.bold) return 1;
  if (score >= BOUNDARY_AUTO_SELECT_SCORE + 0.5) return 0;
  return 2;
}

export function collectScoredBoundaryCandidates(
  features: ParagraphFeatures[],
  tocRange: TocRange | null
): BoundaryCandidate[] {
  const candidates: BoundaryCandidate[] = [];

  for (const f of features) {
    if (isExcludedFromBoundaries(f.index, tocRange)) continue;

    const scored = scoreBoundaryFeature(f, tocRange);
    if (!scored) continue;

    const autoSelect =
      scored.score >= BOUNDARY_AUTO_SELECT_SCORE &&
      scored.relativeDepth === 0 &&
      scored.confidence !== "low";

    candidates.push({
      index: f.index,
      source: scored.source,
      confidence: scored.confidence,
      reason: scored.reason,
      score: scored.score,
      relativeDepth: scored.relativeDepth,
      selected: autoSelect,
    });
  }

  return candidates;
}

export function boundarySpecsFromCandidates(
  candidates: BoundaryCandidate[],
  boundaryIndices: number[]
): Array<{ index: number; relativeDepth: number }> {
  const depthByIndex = new Map(
    candidates.map((c) => [c.index, c.relativeDepth ?? 0])
  );
  return boundaryIndices
    .map((index) => ({
      index,
      relativeDepth: depthByIndex.get(index) ?? 0,
    }))
    .sort((a, b) => a.index - b.index);
}

export function nextBoundaryIndex(
  startIndex: number,
  depth: number,
  boundaries: Array<{ index: number; relativeDepth: number }>
): number {
  for (const b of boundaries) {
    if (b.index <= startIndex) continue;
    if (b.relativeDepth <= depth) return b.index;
  }
  return Number.MAX_SAFE_INTEGER;
}

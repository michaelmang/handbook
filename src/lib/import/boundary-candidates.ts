import type { ParagraphFeatures } from "./paragraph-features";
import type { BoundaryCandidate, BoundarySource } from "./import-draft-types";
import { isLikelyTocLine, isTocCompositeLine } from "./boundary-rules";
import { looksLikeOutlineTitle } from "./numbering";
import { isExcludedFromBoundaries, isInTocRange, type TocRange } from "./toc-detection";
import { collectScoredBoundaryCandidates } from "./boundary-scoring";

export { collectScoredBoundaryCandidates };

const GLUED_NUMBERED = /^(\d+(?:\.\d+)+)([A-Za-z])/;

export function isNumberedPolicyLine(text: string): boolean {
  const t = text.trim();
  if (GLUED_NUMBERED.test(t)) return true;
  return looksLikeOutlineTitle(t) && /^\d+\./.test(t);
}

export function isPlausibleBoundaryParagraph(
  f: ParagraphFeatures,
  tocRange: TocRange | null
): boolean {
  if (isExcludedFromBoundaries(f.index, tocRange)) return false;
  if (isLikelyTocLine(f.text) || isTocCompositeLine(f.text)) return false;
  if (f.wordCount > 18) return false;
  if (f.wordCount > 10 && f.endsWithPeriod) return false;
  if (f.text.length > 100) return false;
  return true;
}

export function collectDeterministicCandidates(
  features: ParagraphFeatures[],
  tocRange: TocRange | null
): BoundaryCandidate[] {
  return collectScoredBoundaryCandidates(features, tocRange);
}

export function mergeBoundarySets(
  deterministic: BoundaryCandidate[],
  llmBoundaries: number[],
  tocRange: TocRange | null
): BoundaryCandidate[] {
  const byIndex = new Map<number, BoundaryCandidate>();
  for (const c of deterministic) {
    byIndex.set(c.index, { ...c });
  }

  for (const index of llmBoundaries) {
    if (isInTocRange(index, tocRange)) continue;
    const existing = byIndex.get(index);
    if (existing) {
      if (existing.source !== "numbered") {
        existing.source = "llm";
        existing.reason = `${existing.reason}; LLM suggested`;
      }
    } else {
      byIndex.set(index, {
        index,
        source: "llm",
        confidence: "medium",
        reason: "LLM section start",
        selected: false,
      });
    }
  }

  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

export function selectedBoundaries(candidates: BoundaryCandidate[]): number[] {
  return candidates
    .filter((c) => c.selected)
    .map((c) => c.index)
    .sort((a, b) => a - b);
}

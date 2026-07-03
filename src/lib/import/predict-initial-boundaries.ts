import type { BoundaryCandidate } from "./import-draft-types";
import { isInTocRange, type TocRange } from "./toc-detection";

/**
 * Select initial section boundaries from scored candidates.
 * Prefers candidates already marked selected (high weighted score).
 */
export function predictInitialBoundaries(
  candidates: BoundaryCandidate[],
  tocRange: TocRange | null
): number[] {
  const selected = candidates
    .filter((c) => c.selected && !isInTocRange(c.index, tocRange))
    .map((c) => c.index)
    .sort((a, b) => a - b);

  if (selected.length > 0) return selected;

  return candidates
    .filter(
      (c) =>
        c.confidence === "high" &&
        !isInTocRange(c.index, tocRange) &&
        (c.relativeDepth ?? 0) <= 1
    )
    .map((c) => c.index)
    .sort((a, b) => a - b);
}

export function applyPredictedBoundaries(
  candidates: BoundaryCandidate[],
  tocRange: TocRange | null
): { candidates: BoundaryCandidate[]; boundaries: number[] } {
  const boundaries = predictInitialBoundaries(candidates, tocRange);
  const set = new Set(boundaries);
  return {
    boundaries,
    candidates: candidates.map((c) => ({
      ...c,
      selected: set.has(c.index),
    })),
  };
}

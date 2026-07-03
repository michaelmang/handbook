import { describe, expect, it } from "vitest";
import type { BoundaryCandidate } from "./import-draft-types";
import {
  applyPredictedBoundaries,
  predictInitialBoundaries,
} from "./predict-initial-boundaries";

function candidate(
  index: number,
  opts: Partial<BoundaryCandidate> = {}
): BoundaryCandidate {
  return {
    index,
    confidence: "medium",
    source: "typography",
    reason: "test",
    selected: false,
    ...opts,
  };
}

describe("predictInitialBoundaries", () => {
  it("prefers candidates already marked selected", () => {
    const candidates = [
      candidate(0, { selected: true, score: 3.5, relativeDepth: 0 }),
      candidate(5, { selected: false, confidence: "high" }),
      candidate(10, { selected: true, score: 3.2, relativeDepth: 1 }),
      candidate(15, { selected: false, confidence: "low" }),
    ];
    expect(predictInitialBoundaries(candidates, null)).toEqual([0, 10]);
  });

  it("falls back to high-confidence depth 0-1 when none selected", () => {
    const candidates = [
      candidate(2, { confidence: "high", relativeDepth: 0 }),
      candidate(8, { confidence: "high", relativeDepth: 2 }),
      candidate(12, { confidence: "medium", relativeDepth: 0 }),
    ];
    expect(predictInitialBoundaries(candidates, null)).toEqual([2]);
  });

  it("applyPredictedBoundaries marks candidates selected", () => {
    const { boundaries, candidates } = applyPredictedBoundaries(
      [candidate(3, { selected: true, confidence: "high", score: 3.1 })],
      null
    );
    expect(boundaries).toEqual([3]);
    expect(candidates[0].selected).toBe(true);
  });
});

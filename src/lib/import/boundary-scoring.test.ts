import { describe, expect, it } from "vitest";
import type { ParagraphFeatures } from "./paragraph-features";
import {
  BOUNDARY_AUTO_SELECT_SCORE,
  BOUNDARY_SCORE_THRESHOLD,
  collectScoredBoundaryCandidates,
  inferBoundaryDepth,
  scoreBoundaryFeature,
} from "./boundary-scoring";

function feature(
  index: number,
  overrides: Partial<ParagraphFeatures> = {}
): ParagraphFeatures {
  const text = overrides.text ?? "Section Title";
  return {
    index,
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    charCount: text.length,
    bold: true,
    allCaps: false,
    endsWithPeriod: false,
    fontSizeRatio: 1.15,
    spaceBeforeRatio: 1,
    indentLevel: 0,
    listLevel: null,
    outlineLevel: null,
    styleHint: null,
    ...overrides,
  };
}

describe("scoreBoundaryFeature", () => {
  it("rejects long body paragraphs below threshold", () => {
    const f = feature(1, {
      text: "This is a long body paragraph that should not become a boundary.",
      wordCount: 12,
      bold: false,
      fontSizeRatio: 1,
    });
    expect(scoreBoundaryFeature(f, null)).toBeNull();
  });

  it("scores numbered policy headings highly", () => {
    const f = feature(2, {
      text: "2.7 Conduct",
      wordCount: 2,
      bold: true,
      fontSizeRatio: 1.05,
    });
    const scored = scoreBoundaryFeature(f, null);
    expect(scored).not.toBeNull();
    expect(scored!.score).toBeGreaterThanOrEqual(BOUNDARY_SCORE_THRESHOLD);
    expect(scored!.source).toBe("numbered");
  });

  it("auto-selects strong top-level typography", () => {
    const f = feature(3, {
      text: "Academic Policies",
      bold: true,
      allCaps: true,
      fontSizeRatio: 1.25,
      spaceBeforeRatio: 2,
    });
    const scored = scoreBoundaryFeature(f, null);
    expect(scored!.score).toBeGreaterThanOrEqual(BOUNDARY_AUTO_SELECT_SCORE);
    expect(inferBoundaryDepth(f, scored!.score)).toBeLessThanOrEqual(1);
  });
});

describe("collectScoredBoundaryCandidates", () => {
  it("marks only high-scoring shallow candidates selected", () => {
    const features = [
      feature(0, {
        text: "Introduction",
        fontSizeRatio: 1.22,
        bold: true,
      }),
      feature(1, {
        text: "Body text here.",
        wordCount: 3,
        bold: false,
        fontSizeRatio: 1,
      }),
      feature(2, {
        text: "2.1 Subsection",
        wordCount: 2,
        bold: true,
        fontSizeRatio: 1.05,
        listLevel: 1,
      }),
    ];

    const candidates = collectScoredBoundaryCandidates(features, null);
    expect(candidates.length).toBeGreaterThan(0);
    const selected = candidates.filter((c) => c.selected);
    expect(selected.every((c) => (c.score ?? 0) >= BOUNDARY_AUTO_SELECT_SCORE)).toBe(
      true
    );
    expect(selected.every((c) => (c.relativeDepth ?? 0) === 0)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import type { ParagraphFeatures } from "./paragraph-features";
import { cleanupFlatBoundaries } from "./flat-boundary-cleanup";

function feature(
  index: number,
  text: string,
  overrides: Partial<ParagraphFeatures> = {}
): ParagraphFeatures {
  const words = text.split(/\s+/).filter(Boolean).length;
  return {
    index,
    text,
    wordCount: words,
    charCount: text.length,
    endsWithPeriod: text.endsWith("."),
    fontSizeRatio: 1,
    bold: false,
    allCaps: false,
    indentLevel: 0,
    listLevel: null,
    outlineLevel: null,
    spaceBeforeRatio: 1,
    styleHint: null,
    ...overrides,
  };
}

describe("cleanupFlatBoundaries", () => {
  it("keeps duplicate title boundary that has body content", () => {
    const features = [
      feature(11, "Honor Code", { listLevel: 1, wordCount: 2 }),
      feature(12, "Statement of Academic Integrity", { wordCount: 4 }),
      feature(249, "Honor Code", { listLevel: 1, wordCount: 2 }),
      feature(
        250,
        "Faith Christian School promotes a biblical atmosphere of academic excellence for all students daily."
      ),
      feature(251, "I will tell the truth in all circumstances.", { bold: true }),
    ];
    const warnings: string[] = [];
    const result = cleanupFlatBoundaries(
      { boundaries: [11, 249, 257], confidence: "high" },
      features,
      warnings
    );

    expect(result.boundaries).toContain(249);
    expect(result.boundaries).not.toContain(11);
    expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
  });

  it("removes dot-leader TOC boundaries", () => {
    const features = [feature(5, "Dress Code .............. 12")];
    const warnings: string[] = [];
    const result = cleanupFlatBoundaries(
      { boundaries: [5], confidence: "high" },
      features,
      warnings
    );
    expect(result.boundaries).toEqual([]);
  });
});

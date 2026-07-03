import { describe, expect, it } from "vitest";
import type { ParagraphFeatures } from "./paragraph-features";
import { detectTocRange, isInTocRange } from "./toc-detection";

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

describe("detectTocRange", () => {
  it("detects outline block after Table of Contents", () => {
    const features = [
      feature(2, "Table of Contents"),
      feature(3, "Mission and Identity", { listLevel: 1, wordCount: 3 }),
      feature(4, "Honor Code", { listLevel: 1, wordCount: 2 }),
      feature(5, "Admissions", { listLevel: 1, wordCount: 1 }),
      feature(
        6,
        "Faith Christian School is an independent school serving families in the region with excellence."
      ),
    ];
    const range = detectTocRange(features);
    expect(range).not.toBeNull();
    expect(range!.start).toBe(2);
    expect(isInTocRange(4, range)).toBe(true);
    expect(isInTocRange(6, range)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { ParagraphFeatures } from "./paragraph-features";
import type { StructureClassification } from "./llm-structure";
import { auditStructure } from "./structure-audit";

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

describe("auditStructure", () => {
  it("flags long sentence-like headings", () => {
    const longTitle =
      "Papers to research and/or write and books to read will only be assigned over the break if there is realistic time.";
    const draft: StructureClassification = {
      headings: [{ index: 5, level: 1 }],
      skip: [],
      confidence: "high",
    };
    const features = [feature(5, longTitle)];
    const issues = auditStructure(draft, features);
    expect(issues.some((i) => i.index === 5 && i.severity === "high")).toBe(
      true
    );
  });

  it("flags too many level-1 headings", () => {
    const headings = Array.from({ length: 25 }, (_, i) => ({
      index: i,
      level: 1,
    }));
    const draft: StructureClassification = {
      headings,
      skip: [],
      confidence: "medium",
    };
    const features = headings.map((h) =>
      feature(h.index, `Section ${h.index}`, { wordCount: 2 })
    );
    const issues = auditStructure(draft, features);
    expect(issues.some((i) => i.reason.includes("level-1"))).toBe(true);
  });
});

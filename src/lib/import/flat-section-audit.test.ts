import { describe, expect, it } from "vitest";
import type { ParagraphFeatures } from "./paragraph-features";
import type { FlatSectionClassification } from "./llm-flat-sections";
import { auditFlatBoundaries } from "./flat-section-audit";

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

describe("auditFlatBoundaries", () => {
  it("flags long sentence-like boundaries", () => {
    const longTitle =
      "Papers to research and/or write and books to read will only be assigned over the break if there is realistic time.";
    const draft: FlatSectionClassification = {
      boundaries: [5],
      confidence: "high",
    };
    const issues = auditFlatBoundaries(draft, [feature(5, longTitle)]);
    expect(issues.some((i) => i.index === 5 && i.severity === "high")).toBe(
      true
    );
  });

  it("flags too few boundaries for a long document", () => {
    const features = Array.from({ length: 120 }, (_, i) =>
      feature(
        i,
        i % 15 === 0
          ? "Attendance"
          : "Students must follow all school policies at all times during the school day."
      )
    );
    const draft: FlatSectionClassification = {
      boundaries: [0, 15],
      confidence: "medium",
    };
    const issues = auditFlatBoundaries(draft, features);
    expect(
      issues.some((i) => i.index === -1 && i.reason.includes("only"))
    ).toBe(true);
  });

  it("flags duplicate titles", () => {
    const draft: FlatSectionClassification = {
      boundaries: [0, 10, 20],
      confidence: "high",
    };
    const features = [
      feature(0, "Dress Code", { bold: true, wordCount: 2 }),
      feature(10, "Dress Code", { bold: true, wordCount: 2 }),
      feature(20, "Technology", { bold: true, wordCount: 1 }),
    ];
    const issues = auditFlatBoundaries(draft, features);
    expect(issues.some((i) => i.reason.includes("duplicate"))).toBe(true);
  });

  it("flags empty body between boundaries", () => {
    const draft: FlatSectionClassification = {
      boundaries: [0, 1],
      confidence: "high",
    };
    const features = [
      feature(0, "Honor Code", { wordCount: 2 }),
      feature(1, "Code of Conduct", { wordCount: 3 }),
    ];
    const issues = auditFlatBoundaries(draft, features);
    expect(
      issues.some((i) => i.index === 0 && i.reason.includes("no body"))
    ).toBe(true);
  });
});

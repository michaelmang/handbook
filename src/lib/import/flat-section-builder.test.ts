import { describe, expect, it } from "vitest";
import type { DocxParagraphRaw } from "./docx-xml";
import { buildFlatBlocksFromBoundaries } from "./flat-section-builder";

function para(
  index: number,
  text: string,
  markdown?: string
): DocxParagraphRaw {
  return {
    index,
    text,
    markdown: markdown ?? text,
    styleId: null,
    outlineLevel: null,
    listLevel: null,
    listNumId: null,
    leftIndentTwips: 0,
    firstLineIndentTwips: 0,
    spaceBeforeTwips: 0,
    spaceAfterTwips: 0,
    runs: [],
    dominantFontSizeHalfPts: null,
    isBoldDominant: false,
    isAllCaps: false,
  };
}

describe("buildFlatBlocksFromBoundaries", () => {
  it("builds flat sections with body content between boundaries", () => {
    const paragraphs = [
      para(0, "1. Attendance", "**Attendance**"),
      para(1, "Students must attend daily."),
      para(2, "2. Tardiness", "**Tardiness**"),
      para(3, "Late arrivals require a note."),
    ];

    const blocks = buildFlatBlocksFromBoundaries(paragraphs, {
      boundaries: [0, 2],
      confidence: "high",
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0].relativeDepth).toBe(0);
    expect(blocks[0].title).toBe("Attendance");
    expect(blocks[0].content).toContain("Students must attend");
    expect(blocks[1].title).toBe("Tardiness");
    expect(blocks[1].content).toContain("Late arrivals");
  });

  it("strips numbering from titles", () => {
    const paragraphs = [
      para(0, "4.1.3 Dress Code"),
      para(1, "Uniform policy applies."),
    ];

    const blocks = buildFlatBlocksFromBoundaries(paragraphs, {
      boundaries: [0],
      confidence: "high",
    });

    expect(blocks[0].title).toBe("Dress Code");
  });

  it("returns a single block when no boundaries", () => {
    const paragraphs = [para(0, "Handbook"), para(1, "Intro text.")];
    const blocks = buildFlatBlocksFromBoundaries(paragraphs, {
      boundaries: [],
      confidence: "low",
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].relativeDepth).toBe(0);
    expect(blocks[0].content).toContain("Intro text");
  });

  it("includes every paragraph between boundaries in section body", () => {
    const paragraphs = [
      para(0, "Honor Code"),
      para(1, "Intro paragraph with policy text."),
      para(2, "I will tell the truth.", "**I will tell the truth.**"),
      para(3, "Closing paragraph."),
      para(4, "Next Section"),
    ];

    const blocks = buildFlatBlocksFromBoundaries(paragraphs, {
      boundaries: [0, 4],
      confidence: "high",
    });

    expect(blocks[0].content).toContain("Intro paragraph");
    expect(blocks[0].content).toContain("I will tell the truth");
    expect(blocks[0].content).toContain("Closing paragraph");
  });
});

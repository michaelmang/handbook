import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { extractDocxParagraphs } from "./docx-xml";
import { buildFeatureList, computeBaselines } from "./paragraph-features";
import { buildBlocksFromStructure } from "./structure-builder";

const FCS_PATH =
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

describe("extractDocxParagraphs", () => {
  it.skipIf(!fs.existsSync(FCS_PATH))(
    "extracts paragraphs from FCS handbook",
    async () => {
      const buf = fs.readFileSync(FCS_PATH);
      const paragraphs = await extractDocxParagraphs(buf);
      expect(paragraphs.length).toBeGreaterThan(100);
      expect(paragraphs[0].text.length).toBeGreaterThan(0);
      expect(paragraphs.some((p) => p.isBoldDominant)).toBe(true);
    }
  );

  it("extracts from sample fixture", async () => {
    const samplePath = path.join(
      process.cwd(),
      "samples/handbook-headings.docx"
    );
    if (!fs.existsSync(samplePath)) return;
    const paragraphs = await extractDocxParagraphs(fs.readFileSync(samplePath));
    expect(paragraphs.length).toBeGreaterThan(0);
  });
});

describe("paragraph features", () => {
  it.skipIf(!fs.existsSync(FCS_PATH))(
    "computes relative font sizes",
    async () => {
      const paragraphs = await extractDocxParagraphs(fs.readFileSync(FCS_PATH));
      const baselines = computeBaselines(paragraphs);
      expect(baselines.bodyFontHalfPts).toBeGreaterThan(0);
      const features = buildFeatureList(paragraphs);
      const varied = features.filter((f) => f.fontSizeRatio > 1.05);
      expect(varied.length).toBeGreaterThan(0);
    }
  );
});

describe("buildBlocksFromStructure", () => {
  it("builds sections from heading indices", () => {
    const paragraphs = [
      {
        index: 0,
        text: "Academic Policies",
        markdown: "Academic Policies",
        styleId: null,
        outlineLevel: null,
        listLevel: null,
        listNumId: null,
        leftIndentTwips: 0,
        firstLineIndentTwips: 0,
        spaceBeforeTwips: 0,
        spaceAfterTwips: 0,
        runs: [],
        dominantFontSizeHalfPts: 28,
        isBoldDominant: true,
        isAllCaps: false,
      },
      {
        index: 1,
        text: "Students must attend daily.",
        markdown: "Students must attend daily.",
        styleId: null,
        outlineLevel: null,
        listLevel: null,
        listNumId: null,
        leftIndentTwips: 0,
        firstLineIndentTwips: 0,
        spaceBeforeTwips: 0,
        spaceAfterTwips: 0,
        runs: [],
        dominantFontSizeHalfPts: 24,
        isBoldDominant: false,
        isAllCaps: false,
      },
      {
        index: 2,
        text: "Attendance",
        markdown: "Attendance",
        styleId: null,
        outlineLevel: null,
        listLevel: null,
        listNumId: null,
        leftIndentTwips: 360,
        firstLineIndentTwips: 0,
        spaceBeforeTwips: 0,
        spaceAfterTwips: 0,
        runs: [],
        dominantFontSizeHalfPts: 24,
        isBoldDominant: true,
        isAllCaps: false,
      },
      {
        index: 3,
        text: "Tardiness is not permitted.",
        markdown: "Tardiness is not permitted.",
        styleId: null,
        outlineLevel: null,
        listLevel: null,
        listNumId: null,
        leftIndentTwips: 360,
        firstLineIndentTwips: 0,
        spaceBeforeTwips: 0,
        spaceAfterTwips: 0,
        runs: [],
        dominantFontSizeHalfPts: 24,
        isBoldDominant: false,
        isAllCaps: false,
      },
    ];

    const blocks = buildBlocksFromStructure(paragraphs, {
      headings: [
        { index: 0, level: 1 },
        { index: 2, level: 2 },
      ],
      skip: [],
      confidence: "high",
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0].title).toBe("Academic Policies");
    expect(blocks[0].content).toContain("Students must attend");
    expect(blocks[1].title).toBe("Attendance");
    expect(blocks[1].content).toContain("Tardiness");
    expect(blocks[1].relativeDepth).toBe(1);
  });
});

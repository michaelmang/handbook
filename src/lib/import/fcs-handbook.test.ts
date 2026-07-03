import { describe, expect, it } from "vitest";
import fs from "fs";
import { buildImportDraft } from "./build-import-draft";

const FCS_HANDBOOK =
  "/Users/michael.mangialardi/Downloads/FCS Student Handbook  25-26 FINAL at 11.14.25.docx";

describe("FCS handbook import quality", () => {
  it.skipIf(!fs.existsSync(FCS_HANDBOOK))(
    "predicts top-level handbook sections without TOC noise",
    async () => {
      const buffer = fs.readFileSync(FCS_HANDBOOK);
      const { blocks, warnings, draft } = await buildImportDraft(buffer);

      const titles = blocks.map((b) => b.title.toLowerCase());
      expect(new Set(titles).size).toBe(titles.length);

      const topLevel = blocks.filter((b) => b.relativeDepth === 0);
      const topLevelNames = topLevel.map((b) => b.title);
      expect(topLevelNames).not.toContain("PSAT");
      expect(topLevelNames).not.toContain("ACT");
      expect(topLevelNames).not.toContain("CTP 5");
      expect(topLevelNames).not.toContain("HANDBOOK");

      const honor = blocks.find((b) => b.title === "Honor and Conduct");
      expect(honor?.content).toContain("Bullying occurs");

      expect(blocks.length).toBeGreaterThanOrEqual(6);
      expect(blocks.length).toBeLessThan(20);
      expect(draft.boundaries.length).toBe(blocks.length);
      expect(warnings.some((w) => w.includes("table of contents"))).toBe(true);
    }
  );
});

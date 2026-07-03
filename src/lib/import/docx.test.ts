import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseDocxToBlocks } from "./docx";
import { stripNumberingPrefix } from "./numbering";

const samplesDir = path.join(process.cwd(), "samples");

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(samplesDir, name));
}

describe("parseDocxToBlocks", () => {
  it("parses Word heading styles into nested blocks", async () => {
    const buffer = readFixture("handbook-headings.docx");
    const { blocks, warnings } = await parseDocxToBlocks(buffer);

    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(blocks[0].title).toBe("Academic Policies");
    expect(blocks.some((b) => b.title === "Attendance")).toBe(true);
    expect(blocks.some((b) => b.title === "Tardiness")).toBe(true);
    expect(warnings.length).toBeLessThan(5);
  });

  it("strips outline numbering from messy handbook", async () => {
    const buffer = readFixture("handbook-outline-numbers.docx");
    const { blocks } = await parseDocxToBlocks(buffer);

    expect(blocks.length).toBeGreaterThanOrEqual(3);
    const titles = blocks.map((b) => b.title);
    expect(titles).toContain("Academic Policies");
    expect(titles).toContain("Attendance Policy");
    expect(titles).toContain("Tardiness");
    expect(titles.some((t) => /^\d/.test(t))).toBe(false);
  });

  it("parses messy bold/caps documents", async () => {
    const buffer = readFixture("handbook-messy.docx");
    const { blocks } = await parseDocxToBlocks(buffer);

    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks.map((b) => b.title)).toContain("DRESS CODE");
  });

  it("does not double-store numbering in titles", async () => {
    const buffer = readFixture("handbook-outline-numbers.docx");
    const { blocks } = await parseDocxToBlocks(buffer);

    for (const block of blocks) {
      const parsed = stripNumberingPrefix(block.title);
      expect(parsed.confidence).toBe("none");
    }
  });
});

import { describe, expect, it } from "vitest";
import type { MarkdownBlock } from "@/lib/markdown-split";
import {
  refineImportedBlocks,
  splitNestedOutlineInBody,
} from "./refine-blocks";

// expose dedupe for direct testing
function dedupe(blocks: MarkdownBlock[], warnings: string[] = []) {
  return refineImportedBlocks(blocks, warnings);
}

describe("splitNestedOutlineInBody", () => {
  it("splits numbered bold outline items into children", () => {
    const block: MarkdownBlock = {
      relativeDepth: 1,
      title: "Bullying",
      content: [
        "1.  **Admissions**",
        "    1.  Philosophy",
        "    2.  Re-Enrollment",
        "2.  **Financial**",
        "    Tuition details.",
      ].join("\n"),
    };

    const split = splitNestedOutlineInBody(block);
    expect(split.length).toBeGreaterThanOrEqual(3);
    expect(split.some((b) => b.title === "Admissions")).toBe(true);
    expect(split.some((b) => b.title === "Financial")).toBe(true);
  });

  it("leaves normal prose unchanged", () => {
    const block: MarkdownBlock = {
      relativeDepth: 0,
      title: "Policy",
      content: "Students must attend school daily unless ill.",
    };
    expect(splitNestedOutlineInBody(block)).toHaveLength(1);
  });
});

describe("refineImportedBlocks", () => {
  it("deduplicates sections keeping substantive content", () => {
    const blocks: MarkdownBlock[] = [
      {
        relativeDepth: 2,
        title: "Bullying",
        content: "1.  **Admissions**\n    1.  Philosophy",
      },
      {
        relativeDepth: 2,
        title: "Bullying",
        content:
          "Bullying occurs when an individual is exposed repeatedly and over time to negative actions.",
      },
    ];
    const warnings: string[] = [];
    const result = dedupe(blocks, warnings);
    const bullying = result.filter((b) => b.title === "Bullying");
    expect(bullying).toHaveLength(1);
    expect(bullying[0].content).toContain("Bullying occurs");
    expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
  });
});

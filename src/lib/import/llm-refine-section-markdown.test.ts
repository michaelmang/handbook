import { describe, expect, it } from "vitest";
import {
  subsectionsToBlocks,
  trimStaleHeadingLines,
} from "./llm-refine-section-markdown";

describe("trimStaleHeadingLines", () => {
  it("removes duplicate parent title and sibling title lines", () => {
    const content = [
      "Honor and Conduct",
      "",
      "Expectations",
      "",
      "Students should behave well.",
      "",
      "Admissions",
      "",
      "More policy here.",
    ].join("\n");

    const { content: cleaned, removed } = trimStaleHeadingLines(
      "Honor and Conduct",
      content,
      ["Admissions", "Academics"]
    );

    expect(removed).toContain("Honor and Conduct");
    expect(removed).toContain("Admissions");
    expect(cleaned).toContain("Expectations");
    expect(cleaned).toContain("Students should behave well.");
    expect(cleaned).not.toContain("Admissions");
  });
});

describe("subsectionsToBlocks", () => {
  it("expands into parent container plus children", () => {
    const blocks = subsectionsToBlocks("Honor and Conduct", 0, {
      subsections: [
        { title: "Expectations", content: "Policy one." },
        { title: "Bullying", content: "Bullying occurs when…" },
      ],
    });

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({
      relativeDepth: 0,
      title: "Honor and Conduct",
      content: "",
    });
    expect(blocks[1]).toMatchObject({
      relativeDepth: 1,
      title: "Expectations",
    });
    expect(blocks[2].title).toBe("Bullying");
  });

  it("keeps single-topic sections flat", () => {
    const blocks = subsectionsToBlocks("Admissions", 0, {
      subsections: [
        { title: "Admissions", content: "Enrollment policy text." },
      ],
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      relativeDepth: 0,
      title: "Admissions",
      content: "Enrollment policy text.",
    });
  });
});

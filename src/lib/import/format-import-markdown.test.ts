import { describe, expect, it } from "vitest";
import {
  formatAsListItem,
  formatLikelyListsInMarkdown,
  isExplicitListLine,
  isLikelyListItemLine,
} from "./format-import-markdown";

describe("isExplicitListLine", () => {
  it("detects decimal and lettered markers", () => {
    expect(isExplicitListLine("1. First policy")).toBe(true);
    expect(isExplicitListLine("2.1 Subsection")).toBe(true);
    expect(isExplicitListLine("a. Option one")).toBe(true);
    expect(isExplicitListLine("- Bullet")).toBe(true);
  });
});

describe("formatLikelyListsInMarkdown", () => {
  it("formats consecutive numbered lines", () => {
    const input = [
      "Students must:",
      "",
      "1. Be honest",
      "",
      "2. Be respectful",
      "",
      "3. Report violations",
    ].join("\n");

    const out = formatLikelyListsInMarkdown(input);
    expect(out).toContain("1. Be honest");
    expect(out).toContain("2. Be respectful");
    expect(out).toContain("3. Report violations");
  });

  it("formats short phrase runs as bullets", () => {
    const input = [
      "Students will exhibit:",
      "",
      "Proper response to authority",
      "",
      "Respect",
      "",
      "Honesty",
    ].join("\n");

    const out = formatLikelyListsInMarkdown(input);
    expect(out).toContain("- Proper response to authority");
    expect(out).toContain("- Respect");
    expect(out).toContain("- Honesty");
  });

  it("leaves long prose paragraphs unchanged", () => {
    const prose =
      "Faith Christian School is a community of Christians who are committed to the moral and intellectual integrity of the community.";
    expect(formatLikelyListsInMarkdown(prose)).toBe(prose);
  });

  it("indents outline-style numbers", () => {
    const out = formatLikelyListsInMarkdown("2.1 Attendance\n\n2.2 Tardiness");
    expect(out).toContain("1. Attendance");
    expect(out).toMatch(/2\. Tardiness/);
  });
});

describe("formatAsListItem", () => {
  it("preserves bold list bodies", () => {
    expect(formatAsListItem("**I will tell the truth**")).toBe(
      "- **I will tell the truth**"
    );
  });
});

describe("isLikelyListItemLine", () => {
  it("rejects long sentences", () => {
    expect(
      isLikelyListItemLine(
        "Students must refrain from physical interference such as tripping, poking, hitting, and other disruptive contact at all times."
      )
    ).toBe(false);
  });
});

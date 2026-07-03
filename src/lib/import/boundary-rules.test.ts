import { describe, expect, it } from "vitest";
import {
  isAcronymOnly,
  isLikelyTocLine,
  isPlausibleSectionTitle,
  isTocCompositeLine,
  stripTocLinesFromMarkdown,
} from "./boundary-rules";

describe("isLikelyTocLine", () => {
  it("detects dot leaders", () => {
    expect(isLikelyTocLine("Attendance Policy .............. 12")).toBe(true);
  });
});

describe("isTocCompositeLine", () => {
  it("detects multi-entry TOC lines", () => {
    expect(
      isTocCompositeLine(
        "Mission Statement     2.  General Philosophy     3.  Academic Philosophy"
      )
    ).toBe(true);
  });

  it("rejects normal section titles", () => {
    expect(isTocCompositeLine("4.1 Attendance Policy")).toBe(false);
  });
});

describe("isAcronymOnly", () => {
  it("flags test acronyms", () => {
    expect(isAcronymOnly("PSAT")).toBe(true);
    expect(isAcronymOnly("ACT")).toBe(true);
    expect(isAcronymOnly("CTP 5")).toBe(true);
    expect(isAcronymOnly("FACTS")).toBe(true);
  });

  it("allows appendix headings", () => {
    expect(isAcronymOnly("APPENDIX B – ORG CHART")).toBe(false);
  });
});

describe("isPlausibleSectionTitle", () => {
  it("rejects sentence-like titles", () => {
    expect(
      isPlausibleSectionTitle(
        "Skate Parties: On skate party days, all students may wear solid colored jeans or jean shorts and polo",
        "all-caps"
      )
    ).toBe(false);
  });

  it("rejects acronyms as all-caps sections", () => {
    expect(isPlausibleSectionTitle("PSAT", "all-caps")).toBe(false);
  });

  it("allows real all-caps headings", () => {
    expect(isPlausibleSectionTitle("ATTENDANCE POLICY", "all-caps")).toBe(true);
  });

  it("rejects composite TOC titles", () => {
    expect(
      isPlausibleSectionTitle(
        "Dress Code     2.  Attendance     3.  Safety",
        "heading-style"
      )
    ).toBe(false);
  });
});

describe("stripTocLinesFromMarkdown", () => {
  it("removes TOC lines from body", () => {
    const input = [
      "Cover year 2025-2026",
      "Mission Statement     2.  General Philosophy     3.  Academic Philosophy",
      "Real policy paragraph here.",
    ].join("\n");
    const out = stripTocLinesFromMarkdown(input);
    expect(out).toContain("Real policy paragraph");
    expect(out).not.toContain("General Philosophy     3.");
  });
});

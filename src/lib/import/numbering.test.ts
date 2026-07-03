import { describe, expect, it } from "vitest";
import {
  looksLikeCapsTitle,
  looksLikeOutlineTitle,
  resolveRelativeDepth,
  stripNumberingPrefix,
} from "./numbering";

describe("stripNumberingPrefix", () => {
  it("strips decimal outline and infers depth", () => {
    const result = stripNumberingPrefix("4.1.3 Attendance Policy");
    expect(result.cleanTitle).toBe("Attendance Policy");
    expect(result.depthHint).toBe(2);
    expect(result.confidence).toBe("high");
    expect(result.rawPrefix).toBe("4.1.3");
  });

  it("strips single-level decimal", () => {
    const result = stripNumberingPrefix("4 Academic Policies");
    expect(result.cleanTitle).toBe("Academic Policies");
    expect(result.depthHint).toBe(0);
    expect(result.confidence).toBe("medium");
  });

  it("strips Part roman prefix", () => {
    const result = stripNumberingPrefix("Part I: Academic Policies");
    expect(result.cleanTitle).toBe("Academic Policies");
    expect(result.depthHint).toBe(0);
    expect(result.confidence).toBe("high");
  });

  it("strips Section letter prefix", () => {
    const result = stripNumberingPrefix("Section A: General Provisions");
    expect(result.cleanTitle).toBe("General Provisions");
    expect(result.depthHint).toBe(0);
  });

  it("returns unchanged title when no prefix", () => {
    const result = stripNumberingPrefix("Dress Code");
    expect(result.cleanTitle).toBe("Dress Code");
    expect(result.depthHint).toBeNull();
    expect(result.confidence).toBe("none");
  });

  it("handles deep outline 4.1.3.4", () => {
    const result = stripNumberingPrefix("4.1.3.4 Tardiness");
    expect(result.cleanTitle).toBe("Tardiness");
    expect(result.depthHint).toBe(3);
  });

  it("strips glued decimal prefixes", () => {
    const result = stripNumberingPrefix("2.6.6Dismissal");
    expect(result.cleanTitle).toBe("Dismissal");
    expect(result.confidence).toBe("high");
  });
});

describe("resolveRelativeDepth", () => {
  it("prefers high-confidence numbering over heading level", () => {
    expect(resolveRelativeDepth(2, "high", 2, 1)).toBe(2);
  });

  it("falls back to heading style when no numbering", () => {
    expect(resolveRelativeDepth(null, "none", 3, 1)).toBe(2);
  });
});

describe("looksLikeOutlineTitle", () => {
  it("detects outline numbered lines", () => {
    expect(looksLikeOutlineTitle("4.1.3 Attendance")).toBe(true);
    expect(looksLikeOutlineTitle("Part II: Policies")).toBe(true);
  });

  it("rejects long body paragraphs", () => {
    expect(looksLikeOutlineTitle("a".repeat(201))).toBe(false);
  });

  it("rejects regular prose that starts with I or D", () => {
    expect(looksLikeOutlineTitle("Intro text.")).toBe(false);
    expect(looksLikeOutlineTitle("Dress Code")).toBe(false);
  });
});

describe("looksLikeCapsTitle", () => {
  it("detects short all-caps titles", () => {
    expect(looksLikeCapsTitle("DRESS CODE")).toBe(true);
  });

  it("rejects sentences ending with period", () => {
    expect(looksLikeCapsTitle("THIS IS A SENTENCE.")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  normalizeImageData,
  parseVisionResponse,
  resolveVisionModel,
  splitTitleFromMarkdown,
} from "./llm-vision-section";

describe("llm-vision-section", () => {
  it("normalizeImageData strips data URL prefix", () => {
    expect(normalizeImageData("data:image/png;base64,abc123")).toBe("abc123");
    expect(normalizeImageData("raw")).toBe("raw");
  });

  it("resolveVisionModel prefers OPENAI_VISION_MODEL", () => {
    const prev = process.env.OPENAI_VISION_MODEL;
    const prevModel = process.env.OPENAI_MODEL;
    process.env.OPENAI_VISION_MODEL = "gpt-4o";
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    expect(resolveVisionModel()).toBe("gpt-4o");
    process.env.OPENAI_VISION_MODEL = prev;
    process.env.OPENAI_MODEL = prevModel;
  });

  it("parseVisionResponse accepts alternate field names", () => {
    const result = parseVisionResponse(
      JSON.stringify({
        section_title: "Honor Code",
        markdown: "Students must be honest.",
      })
    );
    expect(result.title).toBe("Honor Code");
    expect(result.content).toContain("honest");
  });

  it("parseVisionResponse allows empty content with title", () => {
    const result = parseVisionResponse(
      JSON.stringify({ title: "Discipline", content: "" })
    );
    expect(result.title).toBe("Discipline");
    expect(result.content).toBe("");
  });

  it("parseVisionResponse falls back to markdown body", () => {
    const result = parseVisionResponse("# Honor Code\n\nBe truthful.");
    expect(result.title).toBe("Honor Code");
    expect(result.content).toContain("truthful");
  });

  it("splitTitleFromMarkdown handles bold title line", () => {
    const { title, content } = splitTitleFromMarkdown(
      "**Honor Code**\n\nBody text."
    );
    expect(title).toBe("Honor Code");
    expect(content).toBe("Body text.");
  });
});

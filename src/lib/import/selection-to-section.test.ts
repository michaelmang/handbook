// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  sectionFromPreviewParagraphs,
  sectionFromSelectionHtml,
  splitMarkdownSection,
} from "./selection-to-section";

describe("sectionFromSelectionHtml", () => {
  it("uses h1 as title", () => {
    const result = sectionFromSelectionHtml(
      "<h1>Honor Code</h1><p>Students must be honest.</p>"
    );
    expect(result.title).toBe("Honor Code");
    expect(result.content).toContain("honest");
  });

  it("uses first short line as title", () => {
    const result = sectionFromSelectionHtml(
      "<p><strong>Discipline</strong></p><p>Rules apply.</p>"
    );
    expect(result.title).toBe("Discipline");
    expect(result.content).toContain("Rules");
  });

  it("throws on empty html", () => {
    expect(() => sectionFromSelectionHtml("<br>")).toThrow(/empty/i);
  });
});

describe("sectionFromPreviewParagraphs", () => {
  it("preserves numbered list lines in section body", () => {
    const title = document.createElement("p");
    title.textContent = "Policies";

    const item0 = document.createElement("p");
    item0.className = "docx-num-3-0";
    item0.textContent = "First policy";

    const item1 = document.createElement("p");
    item1.className = "docx-num-3-0";
    item1.textContent = "Second policy";

    const result = sectionFromPreviewParagraphs([title, item0, item1]);
    expect(result.title).toBe("Policies");
    expect(result.content).toContain("1. First policy");
    expect(result.content).toContain("1. Second policy");
  });
});

describe("splitMarkdownSection", () => {
  it("strips list marker before title detection", () => {
    const result = splitMarkdownSection(
      "1. Honor Code\n\n1. Be honest.\n1. Be kind."
    );
    expect(result.title).toBe("Honor Code");
    expect(result.content).toContain("1. Be honest.");
  });
});

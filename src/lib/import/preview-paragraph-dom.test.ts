// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  isPreviewListParagraph,
  parseDocxNumberingClass,
  paragraphToMarkdownBlock,
  previewParagraphsToMarkdown,
} from "./preview-paragraph-dom";

describe("preview-paragraph-dom", () => {
  it("reads docx numbering class level", () => {
    const p = document.createElement("p");
    p.className = "docx-num-2-1";
    expect(parseDocxNumberingClass(p)).toBe(1);
  });

  it("builds markdown with nested list indent", () => {
    const p0 = document.createElement("p");
    p0.className = "docx-num-1-0";
    p0.textContent = "Top item";

    const p1 = document.createElement("p");
    p1.className = "docx-num-1-1";
    p1.textContent = "Nested item";

    const md = previewParagraphsToMarkdown([p0, p1]);
    expect(md).toContain("1. Top item");
    expect(md).toContain("  1. Nested item");
  });

  it("detects list-item paragraphs without docx-num class", () => {
    const p = document.createElement("p");
    p.textContent = "Bullet body";
    p.style.display = "list-item";
    p.style.listStyleType = "disc";
    document.body.appendChild(p);

    expect(isPreviewListParagraph(p)).toBe(true);
    expect(paragraphToMarkdownBlock(p)).toBe("- Bullet body");

    document.body.removeChild(p);
  });

  it("keeps consecutive list items in one block", () => {
    const p0 = document.createElement("p");
    p0.className = "docx-num-1-0";
    p0.textContent = "One";

    const p1 = document.createElement("p");
    p1.className = "docx-num-1-0";
    p1.textContent = "Two";

    const md = previewParagraphsToMarkdown([p0, p1]);
    expect(md).toBe("1. One\n1. Two");
  });
});

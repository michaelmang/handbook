// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  computeBodyFontSize,
  detectPreviewSections,
  getPreviewParagraphs,
  inferBoundaryLevel,
} from "./docx-preview-sections";
import type { ParagraphFeatures } from "./paragraph-features";

describe("docx-preview-sections", () => {
  it("getPreviewParagraphs collects article paragraphs", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <section class="docx">
        <article>
          <p>Honor Code</p>
          <p>Students must be honest.</p>
        </article>
      </section>
    `;
    const paras = getPreviewParagraphs(root);
    expect(paras).toHaveLength(2);
    expect(paras[0].textContent).toContain("Honor Code");
  });

  it("computeBodyFontSize uses median of body paragraphs", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p style="font-size: 20px">Title</p>
      <p style="font-size: 16px">Body one two three four five six seven</p>
      <p style="font-size: 16px">Body two three four five six seven eight</p>
    `;
    const paras = Array.from(root.querySelectorAll("p")) as HTMLElement[];
    document.body.appendChild(root);
    const size = computeBodyFontSize(paras);
    document.body.removeChild(root);
    expect(size).toBe(16);
  });

  it("detects numbered subsections with hierarchy levels", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <section class="docx">
        <article>
          <p>4 Academic Policies</p>
          <p>Overview of academic expectations.</p>
          <p>4.1 Attendance Policy</p>
          <p>Regular attendance is required.</p>
          <p>4.1.3 Tardiness</p>
          <p>Tardy students must check in at the office.</p>
        </article>
      </section>
    `;

    const sections = detectPreviewSections(root);
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(sections.map((s) => s.label)).toContain("4 Academic Policies");
    expect(sections.map((s) => s.label)).toContain("4.1 Attendance Policy");
    expect(sections.map((s) => s.label)).toContain("4.1.3 Tardiness");
    expect(sections.find((s) => s.label.includes("4.1.3"))?.level).toBe(2);
  });

  it("infers boundary level from decimal numbering", () => {
    const feature: ParagraphFeatures = {
      index: 0,
      text: "4.1.3 Tardiness",
      wordCount: 2,
      charCount: 14,
      endsWithPeriod: false,
      fontSizeRatio: 1,
      bold: false,
      allCaps: false,
      indentLevel: 0,
      listLevel: null,
      outlineLevel: null,
      spaceBeforeRatio: 1,
      styleHint: null,
    };
    expect(inferBoundaryLevel(feature)).toBe(2);
  });
});

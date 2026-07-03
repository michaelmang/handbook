import { describe, expect, it } from "vitest";
import { extractSectionBoundaries } from "./html-sections";

describe("extractSectionBoundaries", () => {
  it("splits on heading tags", () => {
    const html = `
      <h1>4 Academic Policies</h1>
      <p>Intro text.</p>
      <h2>4.1 Attendance</h2>
      <p>Attendance rules.</p>
      <h3>4.1.1 Tardiness</h3>
      <p>Tardy policy.</p>
    `;
    const { boundaries } = extractSectionBoundaries(html);
    expect(boundaries).toHaveLength(3);
    expect(boundaries[0].title).toBe("4 Academic Policies");
    expect(boundaries[1].title).toBe("4.1 Attendance");
    expect(boundaries[2].title).toBe("4.1.1 Tardiness");
    expect(boundaries[0].html).toContain("Intro text");
  });

  it("detects outline-numbered paragraphs as boundaries", () => {
    const html = `
      <p>4.1 Dress Code</p>
      <p>Students must wear uniforms.</p>
      <p>4.1.1 Uniform Standards</p>
      <p>Navy polo required.</p>
    `;
    const { boundaries } = extractSectionBoundaries(html);
    expect(boundaries.length).toBeGreaterThanOrEqual(2);
    expect(boundaries[0].source).toBe("outline-number");
  });

  it("detects bold short paragraphs", () => {
    const html = `
      <p><strong>Dress Code</strong></p>
      <p>Policy details here.</p>
    `;
    const { boundaries } = extractSectionBoundaries(html);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].source).toBe("bold-short");
    expect(boundaries[0].title).toBe("Dress Code");
  });

  it("detects ALL CAPS titles", () => {
    const html = `
      <p>ATTENDANCE POLICY</p>
      <p>Students are expected to attend.</p>
    `;
    const { boundaries } = extractSectionBoundaries(html);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].source).toBe("all-caps");
  });

  it("rejects acronym lines as section boundaries", () => {
    const html = `
      <p>PSAT</p>
      <p>All students in grades 9-11 are registered.</p>
    `;
    const { boundaries } = extractSectionBoundaries(html);
    expect(boundaries).toHaveLength(0);
  });
});

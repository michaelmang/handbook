import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseDocxWithOfficeParser } from "./office-parser";
import {
  analyzeOfficeAst,
  assessOfficeImport,
  proposeOfficeSections,
} from "./office-parser-analyze";

const samplesDir = path.join(process.cwd(), "samples");

describe("office-parser spike", () => {
  it("converts handbook-headings.docx to markdown with headings", async () => {
    const buffer = readFileSync(
      path.join(samplesDir, "handbook-headings.docx")
    );
    const { markdown, ast } = await parseDocxWithOfficeParser(buffer);

    expect(markdown.length).toBeGreaterThan(50);
    expect(markdown).toMatch(/Academic Policies/i);

    const stats = analyzeOfficeAst(ast);
    expect(stats.headings).toBeGreaterThan(0);
  });

  it("detects list structure in pandoc-generated nested list docx", async () => {
    const { execSync } = await import("child_process");
    const { mkdtempSync, writeFileSync, readFileSync: read, unlinkSync } =
      await import("fs");
    const { tmpdir } = await import("os");
    const dir = mkdtempSync(path.join(tmpdir(), "op-list-"));
    const mdPath = path.join(dir, "lists.md");
    const docxPath = path.join(dir, "lists.docx");

    writeFileSync(
      mdPath,
      "1. **Top**\n   1. Nested one\n   2. Nested two\n"
    );
    try {
      execSync(`pandoc "${mdPath}" -o "${docxPath}"`, { stdio: "pipe" });
    } catch {
      return; // skip if pandoc unavailable in CI
    }

    const { ast, markdown } = await parseDocxWithOfficeParser(read(docxPath));
    const stats = analyzeOfficeAst(ast);
    expect(stats.listItems).toBeGreaterThan(0);
    expect(markdown).toMatch(/Top/);
    expect(markdown).toMatch(/Nested one/);

    unlinkSync(mdPath);
    unlinkSync(docxPath);
  });

  it("proposes sections for outline-numbers sample", async () => {
    const buffer = readFileSync(
      path.join(samplesDir, "handbook-outline-numbers.docx")
    );
    const { ast, markdown } = await parseDocxWithOfficeParser(buffer);
    const sections = proposeOfficeSections(ast);
    const assessment = assessOfficeImport(ast, markdown);

    expect(sections.length).toBeGreaterThan(0);
    expect(assessment.recommendation).toMatch(/auto|guided|manual/);
  });
});

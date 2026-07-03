import type { ParagraphFeatures } from "./paragraph-features";
import type { StructureClassification, StructureHeading } from "./llm-structure";

export interface StructureIssue {
  index: number;
  reason: string;
  severity: "high" | "medium";
}

/** Programmatic flags on likely first-pass mistakes. */
export function auditStructure(
  structure: StructureClassification,
  features: ParagraphFeatures[]
): StructureIssue[] {
  const byIndex = new Map(features.map((f) => [f.index, f]));
  const issues: StructureIssue[] = [];
  const seenTitles = new Map<string, number>();

  for (const h of structure.headings) {
    const f = byIndex.get(h.index);
    const title = f?.text ?? "";

    if (f && f.wordCount > 20) {
      issues.push({
        index: h.index,
        reason: `heading text has ${f.wordCount} words (likely body prose)`,
        severity: "high",
      });
    } else if (f && f.wordCount > 12 && f.endsWithPeriod) {
      issues.push({
        index: h.index,
        reason: "long sentence ending with period",
        severity: "high",
      });
    }

    if (title.length > 100) {
      issues.push({
        index: h.index,
        reason: "title exceeds 100 characters",
        severity: "high",
      });
    }

    if (f && h.level === 1 && f.wordCount <= 4 && f.allCaps && title.length < 20) {
      const key = title.toLowerCase();
      if (!/appendix|policy|handbook/i.test(title)) {
        issues.push({
          index: h.index,
          reason: "short all-caps acronym may be a sub-label, not level 1",
          severity: "medium",
        });
      }
    }

    const key = title.toLowerCase().trim();
    if (key) {
      seenTitles.set(key, (seenTitles.get(key) ?? 0) + 1);
    }
  }

  for (const [title, count] of seenTitles) {
    if (count > 1) {
      issues.push({
        index: -1,
        reason: `duplicate title "${title}" appears ${count} times`,
        severity: "medium",
      });
    }
  }

  const level1 = structure.headings.filter((h) => h.level === 1).length;
  if (level1 > 20) {
    issues.push({
      index: -1,
      reason: `${level1} level-1 headings (likely over-split)`,
      severity: "medium",
    });
  }

  if (structure.confidence === "low") {
    issues.push({
      index: -1,
      reason: "first pass reported low confidence",
      severity: "medium",
    });
  }

  return issues;
}

export function buildRefineContextParagraphs(
  features: ParagraphFeatures[],
  issues: StructureIssue[],
  radius = 2
): ParagraphFeatures[] {
  const indices = new Set<number>();
  for (const issue of issues) {
    if (issue.index < 0) continue;
    for (let i = issue.index - radius; i <= issue.index + radius; i++) {
      indices.add(i);
    }
  }

  if (indices.size === 0) {
    return features.slice(0, Math.min(40, features.length));
  }

  return features.filter((f) => indices.has(f.index));
}

export function summarizeDraftHeadings(
  headings: StructureHeading[],
  features: ParagraphFeatures[]
): Array<{ index: number; level: number; title: string; words: number }> {
  const byIndex = new Map(features.map((f) => [f.index, f]));
  return headings.map((h) => {
    const f = byIndex.get(h.index);
    return {
      index: h.index,
      level: h.level,
      title: f?.text ?? "",
      words: f?.wordCount ?? 0,
    };
  });
}

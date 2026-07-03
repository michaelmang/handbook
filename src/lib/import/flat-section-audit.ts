import type { ParagraphFeatures } from "./paragraph-features";
import type { FlatSectionClassification } from "./llm-flat-sections";

export interface FlatBoundaryIssue {
  index: number;
  reason: string;
  severity: "high" | "medium";
}

function bodyWordCountBetween(
  start: number,
  end: number,
  features: ParagraphFeatures[]
): number {
  return features
    .filter((f) => f.index > start && f.index < end)
    .reduce((sum, f) => sum + f.wordCount, 0);
}

export function auditFlatBoundaries(
  classification: FlatSectionClassification,
  features: ParagraphFeatures[]
): FlatBoundaryIssue[] {
  const byIndex = new Map(features.map((f) => [f.index, f]));
  const issues: FlatBoundaryIssue[] = [];
  const boundaries = [...classification.boundaries].sort((a, b) => a - b);

  if (boundaries.length === 0) {
    issues.push({
      index: -1,
      reason: "no section boundaries detected",
      severity: "high",
    });
    return issues;
  }

  const proseParagraphs = features.filter((f) => f.wordCount >= 8).length;
  if (proseParagraphs > 80 && boundaries.length < 8) {
    issues.push({
      index: -1,
      reason: `only ${boundaries.length} boundaries for ${proseParagraphs} prose paragraphs`,
      severity: "high",
    });
  }

  if (boundaries.length > 250) {
    issues.push({
      index: -1,
      reason: `${boundaries.length} boundaries (likely over-split)`,
      severity: "medium",
    });
  }

  const seenTitles = new Map<string, number>();

  for (let i = 0; i < boundaries.length; i++) {
    const idx = boundaries[i];
    const f = byIndex.get(idx);
    if (!f) continue;

    if (f.wordCount > 18) {
      issues.push({
        index: idx,
        reason: `boundary has ${f.wordCount} words (likely body prose)`,
        severity: "high",
      });
    } else if (f.wordCount > 10 && f.endsWithPeriod) {
      issues.push({
        index: idx,
        reason: "boundary looks like a sentence",
        severity: "high",
      });
    }

    if (f.text.length > 100) {
      issues.push({
        index: idx,
        reason: "boundary title exceeds 100 characters",
        severity: "high",
      });
    }

    const nextIdx = boundaries[i + 1] ?? Number.MAX_SAFE_INTEGER;
    const bodyWords = bodyWordCountBetween(idx, nextIdx, features);
    if (bodyWords === 0 && i < boundaries.length - 1) {
      issues.push({
        index: idx,
        reason: "boundary has no body paragraphs before next section",
        severity: "medium",
      });
    }

    const key = f.text.toLowerCase().trim();
    if (key) seenTitles.set(key, (seenTitles.get(key) ?? 0) + 1);
  }

  for (const [title, count] of seenTitles) {
    if (count > 1) {
      issues.push({
        index: -1,
        reason: `duplicate section title "${title}" (${count}×)`,
        severity: "medium",
      });
    }
  }

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (end - start <= 1) {
      issues.push({
        index: boundaries[i + 1],
        reason: "back-to-back boundaries with no body",
        severity: "medium",
      });
    }
  }

  for (const f of features) {
    if (classification.boundaries.includes(f.index)) continue;
    if (f.wordCount > 8 || f.wordCount < 2) continue;
    if (!f.bold && f.fontSizeRatio < 1.08) continue;
    if (f.endsWithPeriod) continue;

    const prevBoundary = [...boundaries].reverse().find((b) => b < f.index);
    const nextBoundary = boundaries.find((b) => b > f.index);
    if (prevBoundary == null || nextBoundary == null) continue;

    const gapFeatures = features.filter(
      (x) => x.index > prevBoundary && x.index < nextBoundary
    );
    const hasStrongCandidate = gapFeatures.some(
      (x) =>
        x.index !== f.index &&
        x.bold &&
        x.wordCount <= 8 &&
        !x.endsWithPeriod
    );
    if (!hasStrongCandidate && f.wordCount <= 6) {
      issues.push({
        index: f.index,
        reason: `possible missed section: "${f.text.slice(0, 40)}"`,
        severity: "medium",
      });
      break;
    }
  }

  if (classification.confidence === "low") {
    issues.push({
      index: -1,
      reason: "pass A reported low confidence",
      severity: "medium",
    });
  }

  return issues;
}

export function buildRefineBoundaryContext(
  features: ParagraphFeatures[],
  issues: FlatBoundaryIssue[],
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
    return features.slice(0, Math.min(50, features.length));
  }
  return features.filter((f) => indices.has(f.index));
}

export function summarizeBoundaries(
  boundaries: number[],
  features: ParagraphFeatures[]
): Array<{ index: number; title: string; words: number }> {
  const byIndex = new Map(features.map((f) => [f.index, f]));
  return boundaries.map((index) => {
    const f = byIndex.get(index);
    return {
      index,
      title: f?.text ?? "",
      words: f?.wordCount ?? 0,
    };
  });
}

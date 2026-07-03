import type { ParagraphFeatures } from "./paragraph-features";
import type { FlatSectionClassification } from "./llm-flat-sections";
import { isLikelyTocLine, isTocCompositeLine } from "./boundary-rules";

function bodyWordCount(
  boundaryIdx: number,
  nextBoundaryIdx: number,
  features: ParagraphFeatures[]
): number {
  const end =
    nextBoundaryIdx === Number.MAX_SAFE_INTEGER
      ? boundaryIdx + 500
      : nextBoundaryIdx;
  return features
    .filter((f) => f.index > boundaryIdx && f.index < end)
    .reduce((sum, f) => sum + f.wordCount, 0);
}

/** Deterministic post-pass: drop TOC noise and duplicate early outline entries. */
export function cleanupFlatBoundaries(
  classification: FlatSectionClassification,
  features: ParagraphFeatures[],
  warnings: string[]
): FlatSectionClassification {
  const byIndex = new Map(features.map((f) => [f.index, f]));
  let boundaries = [...classification.boundaries].sort((a, b) => a - b);

  boundaries = boundaries.filter((idx) => {
    const f = byIndex.get(idx);
    if (!f) return false;
    if (isLikelyTocLine(f.text) || isTocCompositeLine(f.text)) {
      warnings.push(`Removed TOC line boundary at paragraph ${idx}.`);
      return false;
    }
    if (/^table of contents$/i.test(f.text.trim())) {
      warnings.push("Removed Table of Contents boundary.");
      return false;
    }
    return true;
  });

  const titleGroups = new Map<string, number[]>();
  for (const idx of boundaries) {
    const f = byIndex.get(idx);
    if (!f) continue;
    const key = f.text.toLowerCase().trim();
    if (!key) continue;
    const group = titleGroups.get(key) ?? [];
    group.push(idx);
    titleGroups.set(key, group);
  }

  const drop = new Set<number>();
  for (const [title, indices] of titleGroups) {
    if (indices.length <= 1) continue;

    let best = indices[0];
    let bestScore = -1;
    for (const idx of indices) {
      const pos = boundaries.indexOf(idx);
      const next =
        pos + 1 < boundaries.length
          ? boundaries[pos + 1]
          : Number.MAX_SAFE_INTEGER;
      const score = bodyWordCount(idx, next, features);
      if (score > bestScore) {
        bestScore = score;
        best = idx;
      }
    }

    for (const idx of indices) {
      if (idx === best) continue;
      drop.add(idx);
      warnings.push(
        `Removed duplicate boundary "${title}" at paragraph ${idx} (kept paragraph ${best} with more body text).`
      );
    }
  }

  boundaries = boundaries.filter((b) => !drop.has(b));

  return { ...classification, boundaries };
}

import { nanoid } from "nanoid";
import type { ParagraphFeatures } from "./paragraph-features";
import type {
  AuditIssue,
  ImportParagraph,
  SectionDraft,
} from "./import-draft-types";
import { isInTocRange, type TocRange } from "./toc-detection";
import { isNumberedPolicyLine } from "./boundary-candidates";
import { stripNumberingPrefix } from "./numbering";

const HUGE_CHARS = 15_000;
const SPLIT_SUGGEST_CHARS = 4_000;

function bodyBetween(
  start: number,
  end: number,
  paragraphs: ImportParagraph[]
): ImportParagraph[] {
  return paragraphs.filter((p) => p.index > start && p.index < end);
}

export function auditImportDraft(
  sections: SectionDraft[],
  paragraphs: ImportParagraph[],
  boundaries: number[],
  features: ParagraphFeatures[],
  tocRange: TocRange | null
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const byIndex = new Map(features.map((f) => [f.index, f]));
  const sorted = [...boundaries].sort((a, b) => a - b);

  for (const b of sorted) {
    if (isInTocRange(b, tocRange)) {
      issues.push({
        id: nanoid(8),
        kind: "toc_boundary",
        severity: "safe",
        message: `Boundary at paragraph ${b} is inside the table of contents`,
        paragraphIndex: b,
        fix: { type: "remove_boundary", paragraphIndex: b },
      });
    }
  }

  const titleCounts = new Map<string, string[]>();
  for (const s of sections) {
    const key = s.title.toLowerCase().trim();
    const arr = titleCounts.get(key) ?? [];
    arr.push(s.id);
    titleCounts.set(key, arr);
  }

  for (const s of sections) {
    if (s.charCount === 0) {
      const idx = sections.findIndex((x) => x.id === s.id);
      const next = sections[idx + 1];
      issues.push({
        id: nanoid(8),
        kind: "empty_section",
        severity: "safe",
        message: `Empty section "${s.title}"`,
        sectionId: s.id,
        fix: next
          ? {
              type: "merge_sections",
              sectionIds: [s.id, next.id],
            }
          : { type: "remove_boundary", paragraphIndex: s.boundaryIndex },
      });
    } else if (s.charCount < 40) {
      issues.push({
        id: nanoid(8),
        kind: "thin_section",
        severity: "review",
        message: `Very short section "${s.title}" (${s.charCount} chars)`,
        sectionId: s.id,
      });
    } else if (s.charCount > HUGE_CHARS) {
      issues.push({
        id: nanoid(8),
        kind: "huge_section",
        severity: "review",
        message: `Large section "${s.title}" (${s.charCount.toLocaleString()} chars) — consider splitting`,
        sectionId: s.id,
      });
    }

    const f = byIndex.get(s.boundaryIndex);
    if (f && f.wordCount > 18) {
      issues.push({
        id: nanoid(8),
        kind: "prose_as_title",
        severity: "review",
        message: `Section title looks like body prose (${f.wordCount} words)`,
        sectionId: s.id,
        paragraphIndex: s.boundaryIndex,
      });
    }

    const numbering = stripNumberingPrefix(s.title);
    if (
      numbering.confidence === "none" &&
      /^\d+\.\d+/.test(s.title.replace(/\s/g, ""))
    ) {
      issues.push({
        id: nanoid(8),
        kind: "numbering_artifact",
        severity: "review",
        message: `Numbering may be glued to title: "${s.title.slice(0, 40)}"`,
        sectionId: s.id,
      });
    }
  }

  for (const [title, ids] of titleCounts) {
    if (ids.length <= 1 || !title) continue;
    for (const id of ids.slice(1)) {
      const s = sections.find((x) => x.id === id)!;
      issues.push({
        id: nanoid(8),
        kind: "duplicate_title",
        severity: "safe",
        message: `Duplicate section "${s.title}"`,
        sectionId: id,
        fix: { type: "remove_boundary", paragraphIndex: s.boundaryIndex },
      });
    }
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] <= 1) {
      issues.push({
        id: nanoid(8),
        kind: "back_to_back",
        severity: "safe",
        message: `Back-to-back boundaries at ¶${sorted[i]} and ¶${sorted[i + 1]}`,
        paragraphIndex: sorted[i + 1],
        fix: {
          type: "remove_boundary",
          paragraphIndex: sorted[i + 1],
        },
      });
    }
  }

  for (const s of sections) {
    if (s.charCount < SPLIT_SUGGEST_CHARS) continue;
    const pos = sorted.indexOf(s.boundaryIndex);
    const end =
      pos + 1 < sorted.length ? sorted[pos + 1] : Number.MAX_SAFE_INTEGER;
    const inner = bodyBetween(s.boundaryIndex, end, paragraphs);
    const splitAt = inner
      .filter(
        (p) =>
          !p.inToc &&
          (isNumberedPolicyLine(p.text) ||
            (p.bold && p.wordCount <= 8 && !p.text.endsWith(".")))
      )
      .map((p) => p.index);

    if (splitAt.length >= 2) {
      issues.push({
        id: nanoid(8),
        kind: "suggested_split",
        severity: "review",
        message: `Split "${s.title}" at ${splitAt.length} inner headings`,
        sectionId: s.id,
        fix: {
          type: "split_at_paragraphs",
          sectionId: s.id,
          paragraphIndices: splitAt,
        },
      });
    }
  }

  for (const f of features) {
    if (isInTocRange(f.index, tocRange)) continue;
    if (boundaries.includes(f.index)) continue;
    if (f.wordCount > 8 || f.wordCount < 2) continue;
    if (!f.bold && f.fontSizeRatio < 1.08) continue;
    if (f.endsWithPeriod) continue;
    if (!isNumberedPolicyLine(f.text) && f.wordCount > 6) continue;

    const prev = [...sorted].reverse().find((b) => b < f.index);
    const next = sorted.find((b) => b > f.index);
    if (prev == null || next == null) continue;

    const gap = features.filter((x) => x.index > prev && x.index < next);
    const hasBold = gap.some(
      (x) =>
        x.index !== f.index &&
        x.bold &&
        x.wordCount <= 8 &&
        !x.endsWithPeriod
    );
    if (!hasBold && f.wordCount <= 6) {
      issues.push({
        id: nanoid(8),
        kind: "suggested_boundary",
        severity: "review",
        message: `Possible missed section: "${f.text.slice(0, 45)}"`,
        paragraphIndex: f.index,
        fix: { type: "add_boundary", paragraphIndex: f.index },
      });
      break;
    }
  }

  return issues;
}

export function attachIssuesToSections(
  sections: SectionDraft[],
  issues: AuditIssue[]
): SectionDraft[] {
  return sections.map((s) => ({
    ...s,
    issueIds: issues.filter((i) => i.sectionId === s.id).map((i) => i.id),
  }));
}

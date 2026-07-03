import { nanoid } from "nanoid";
import type {
  AuditIssue,
  BoundaryCandidate,
  ImportDraft,
  ImportParagraph,
  SectionDraft,
} from "./import-draft-types";
import { isLikelyTocLine, isTocCompositeLine } from "./boundary-rules";
import { stripNumberingPrefix } from "./numbering";
import {
  attachIssuesToSections,
  auditImportDraft,
} from "./import-draft-audit";
import type { ParagraphFeatures } from "./paragraph-features";
import { applyPredictedBoundaries } from "./predict-initial-boundaries";

function buildSectionsFromParagraphs(
  paragraphs: ImportParagraph[],
  boundaries: number[],
  carryOverByBoundary: Map<number, boolean> = new Map()
): SectionDraft[] {
  const sorted = [...boundaries].sort((a, b) => a - b);
  const boundarySet = new Set(sorted);
  const byIndex = new Map(paragraphs.map((p) => [p.index, p]));
  const sections: SectionDraft[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const index = sorted[i];
    const para = byIndex.get(index);
    if (!para) continue;

    const numbering = stripNumberingPrefix(para.text);
    const nextIndex = sorted[i + 1] ?? Number.MAX_SAFE_INTEGER;
    const bodyParts: string[] = [];

    for (const p of paragraphs) {
      if (p.index <= index) continue;
      if (p.index >= nextIndex) break;
      if (boundarySet.has(p.index)) continue;
      if (p.inToc) continue;
      const line = (p.markdown || p.text).trim();
      if (!line) continue;
      if (isLikelyTocLine(line) || isTocCompositeLine(line)) continue;
      bodyParts.push(line);
    }

    const content = bodyParts.join("\n\n").trim();
    sections.push({
      id: nanoid(10),
      boundaryIndex: index,
      title: numbering.cleanTitle || para.text.slice(0, 80),
      content,
      charCount: content.length,
      relativeDepth: 0,
      issueIds: [],
      carryOver: carryOverByBoundary.get(index) ?? true,
    });
  }

  return sections;
}

function featuresFromImportParagraphs(
  paragraphs: ImportParagraph[]
): ParagraphFeatures[] {
  return paragraphs.map((p) => ({
    index: p.index,
    text: p.preview,
    wordCount: p.wordCount,
    charCount: p.text.length,
    endsWithPeriod: p.text.endsWith("."),
    fontSizeRatio: p.fontSizeRatio,
    bold: p.bold,
    allCaps: false,
    indentLevel: 0,
    listLevel: p.listLevel,
    outlineLevel: null,
    spaceBeforeRatio: 1,
    styleHint: null,
  }));
}

export function rebuildDraftClient(
  draft: ImportDraft,
  boundaries: number[],
  changelogEntry?: string
): ImportDraft {
  const importParagraphs = draft.paragraphs.map((p) => ({
    ...p,
    isBoundary: boundaries.includes(p.index),
  }));
  const carryOverByBoundary = new Map(
    draft.sections.map((s) => [s.boundaryIndex, s.carryOver])
  );
  const sections = buildSectionsFromParagraphs(
    importParagraphs,
    boundaries,
    carryOverByBoundary
  );
  const features = featuresFromImportParagraphs(importParagraphs);
  const issues = auditImportDraft(
    sections,
    importParagraphs,
    boundaries,
    features,
    draft.tocRange
  );

  const candidates = draft.candidates.map((c) => ({
    ...c,
    selected: boundaries.includes(c.index),
  }));

  return {
    ...draft,
    boundaries,
    paragraphs: importParagraphs,
    candidates,
    sections: attachIssuesToSections(sections, issues),
    issues,
    changelog: changelogEntry
      ? [...draft.changelog, changelogEntry]
      : draft.changelog,
  };
}

export function toggleBoundaryClient(
  draft: ImportDraft,
  paragraphIndex: number
): ImportDraft {
  const set = new Set(draft.boundaries);
  if (set.has(paragraphIndex)) set.delete(paragraphIndex);
  else set.add(paragraphIndex);
  const para = draft.paragraphs.find((p) => p.index === paragraphIndex);
  return rebuildDraftClient(
    draft,
    [...set].sort((a, b) => a - b),
    `${set.has(paragraphIndex) ? "Added" : "Removed"} boundary at ¶${paragraphIndex}${para ? `: "${para.preview.slice(0, 40)}"` : ""}`
  );
}

export function applyAuditFixClient(
  draft: ImportDraft,
  issue: AuditIssue
): ImportDraft {
  if (!issue.fix) return draft;

  let boundaries = [...draft.boundaries];

  switch (issue.fix.type) {
    case "remove_boundary":
      if (issue.fix.paragraphIndex != null) {
        boundaries = boundaries.filter((b) => b !== issue.fix!.paragraphIndex);
      }
      break;
    case "add_boundary":
      if (issue.fix.paragraphIndex != null) {
        boundaries = [...boundaries, issue.fix.paragraphIndex].sort(
          (a, b) => a - b
        );
      }
      break;
    case "merge_sections": {
      const ids = issue.fix.sectionIds ?? [];
      const remove = draft.sections
        .filter((s) => ids.includes(s.id))
        .slice(1)
        .map((s) => s.boundaryIndex);
      boundaries = boundaries.filter((b) => !remove.includes(b));
      break;
    }
    case "split_at_paragraphs": {
      const indices = issue.fix.paragraphIndices ?? [];
      boundaries = [...new Set([...boundaries, ...indices])].sort(
        (a, b) => a - b
      );
      break;
    }
  }

  return rebuildDraftClient(draft, boundaries, `Applied: ${issue.message}`);
}

export function applyAllSafeFixesClient(draft: ImportDraft): ImportDraft {
  let current = draft;
  for (const issue of draft.issues.filter(
    (i) => i.severity === "safe" && i.fix
  )) {
    current = applyAuditFixClient(current, issue);
  }
  return {
    ...current,
    changelog: [
      ...current.changelog,
      "Applied all safe audit fixes",
    ],
  };
}

export function mergeSectionsClient(
  draft: ImportDraft,
  sectionIds: string[]
): ImportDraft {
  if (sectionIds.length < 2) return draft;
  const remove = draft.sections
    .filter((s) => sectionIds.includes(s.id))
    .slice(1)
    .map((s) => s.boundaryIndex);
  const boundaries = draft.boundaries.filter((b) => !remove.includes(b));
  return rebuildDraftClient(
    draft,
    boundaries,
    `Merged ${sectionIds.length} sections`
  );
}

export function draftToBlocks(draft: ImportDraft) {
  return draft.sections
    .filter((s) => s.carryOver)
    .map((s) => ({
      relativeDepth: s.relativeDepth,
      title: s.title,
      content: s.content,
    }));
}

/** Markdown for live preview of sections marked carry-over. */
export function sectionsToPreviewMarkdown(
  sections: SectionDraft[],
  options?: { onlyCarryOver?: boolean }
): string {
  const onlyCarryOver = options?.onlyCarryOver ?? true;
  const list = onlyCarryOver
    ? sections.filter((s) => s.carryOver)
    : sections;
  return list
    .map((s) => {
      const body = s.content.trim();
      return body ? `# ${s.title}\n\n${body}` : `# ${s.title}`;
    })
    .join("\n\n");
}

export function toggleSectionCarryOverClient(
  draft: ImportDraft,
  sectionId: string
): ImportDraft {
  return {
    ...draft,
    sections: draft.sections.map((s) =>
      s.id === sectionId ? { ...s, carryOver: !s.carryOver } : s
    ),
    changelog: [
      ...draft.changelog,
      `Toggled carry-over for "${draft.sections.find((s) => s.id === sectionId)?.title ?? sectionId}"`,
    ],
  };
}

export function setAllSectionsCarryOverClient(
  draft: ImportDraft,
  carryOver: boolean
): ImportDraft {
  return {
    ...draft,
    sections: draft.sections.map((s) => ({ ...s, carryOver })),
    changelog: [
      ...draft.changelog,
      carryOver ? "Selected all sections" : "Deselected all sections",
    ],
  };
}

export function resetToPredictedBoundariesClient(
  draft: ImportDraft
): ImportDraft {
  const { boundaries } = applyPredictedBoundaries(
    draft.candidates.map((c) => ({ ...c, selected: false })),
    draft.tocRange
  );
  return rebuildDraftClient(
    draft,
    boundaries,
    `Reset to ${boundaries.length} predicted sections`
  );
}

/** Indices of AI/rule suggestions not yet accepted as boundaries. */
export function suggestionIndices(draft: ImportDraft): Set<number> {
  const boundarySet = new Set(draft.boundaries);
  return new Set(
    draft.candidates
      .filter((c) => !boundarySet.has(c.index))
      .map((c) => c.index)
  );
}

/** Marquee snap: create section from first selected paragraph through selection. */
export function snapSectionFromIndices(
  draft: ImportDraft,
  indices: number[]
): ImportDraft {
  if (indices.length === 0) return draft;
  const sorted = [...indices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const set = new Set(draft.boundaries);
  set.add(min);
  const after = draft.paragraphs.find(
    (p) => p.index > max && !p.inToc
  );
  if (after) set.add(after.index);
  return rebuildDraftClient(
    draft,
    [...set].sort((a, b) => a - b),
    `Snapped section ¶${min}–${max}`
  );
}

export function moveBoundaryClient(
  draft: ImportDraft,
  fromIndex: number,
  toIndex: number
): ImportDraft {
  if (fromIndex === toIndex) return draft;
  const set = new Set(draft.boundaries);
  if (!set.has(fromIndex)) return draft;
  set.delete(fromIndex);
  set.add(toIndex);
  return rebuildDraftClient(
    draft,
    [...set].sort((a, b) => a - b),
    `Moved boundary ¶${fromIndex} → ¶${toIndex}`
  );
}

export function acceptSuggestionClient(
  draft: ImportDraft,
  paragraphIndex: number
): ImportDraft {
  const set = new Set(draft.boundaries);
  set.add(paragraphIndex);
  return rebuildDraftClient(
    draft,
    [...set].sort((a, b) => a - b),
    `Accepted suggestion at ¶${paragraphIndex}`
  );
}

export function acceptAllSuggestionsClient(draft: ImportDraft): ImportDraft {
  const set = new Set(draft.boundaries);
  for (const c of draft.candidates) set.add(c.index);
  return rebuildDraftClient(
    draft,
    [...set].sort((a, b) => a - b),
    `Accepted all ${draft.candidates.length} suggestions`
  );
}

export function scrollToParagraph(index: number): void {
  document
    .querySelector(`[data-paragraph-index="${index}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

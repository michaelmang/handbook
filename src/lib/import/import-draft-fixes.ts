import type {
  AuditFix,
  AuditIssue,
  BoundaryCandidate,
  ImportDraft,
  SectionDraft,
} from "./import-draft-types";
import {
  buildSectionDrafts,
  syncCandidatesSelection,
  toImportParagraphs,
} from "./import-draft-builder";
import {
  attachIssuesToSections,
  auditImportDraft,
} from "./import-draft-audit";
import type { DocxParagraphRaw } from "./docx-xml";
import type { ParagraphFeatures } from "./paragraph-features";
import { selectedBoundaries } from "./boundary-candidates";
import type { TocRange } from "./toc-detection";

export function applyBoundaryToggle(
  draft: ImportDraft,
  paragraphIndex: number,
  paragraphs: DocxParagraphRaw[],
  features: ParagraphFeatures[],
  tocRange: TocRange | null
): ImportDraft {
  const set = new Set(draft.boundaries);
  if (set.has(paragraphIndex)) {
    set.delete(paragraphIndex);
  } else {
    set.add(paragraphIndex);
  }
  return rebuildDraft(
    draft,
    paragraphs,
    features,
    tocRange,
    [...set].sort((a, b) => a - b),
    draft.candidates
  );
}

export function applyAuditFix(
  draft: ImportDraft,
  issue: AuditIssue,
  paragraphs: DocxParagraphRaw[],
  features: ParagraphFeatures[],
  tocRange: TocRange | null
): ImportDraft {
  if (!issue.fix) return draft;

  let boundaries = [...draft.boundaries];
  const changelog = [...draft.changelog, `Applied: ${issue.message}`];

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
      if (ids.length < 2) break;
      const toRemove = draft.sections
        .filter((s) => ids.includes(s.id))
        .slice(1)
        .map((s) => s.boundaryIndex);
      boundaries = boundaries.filter((b) => !toRemove.includes(b));
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

  const candidates = syncCandidatesSelection(draft.candidates, boundaries);
  return rebuildDraft(
    { ...draft, changelog },
    paragraphs,
    features,
    tocRange,
    boundaries,
    candidates
  );
}

export function applyAllSafeFixes(
  draft: ImportDraft,
  paragraphs: DocxParagraphRaw[],
  features: ParagraphFeatures[],
  tocRange: TocRange | null
): ImportDraft {
  let current = draft;
  const safe = draft.issues.filter((i) => i.severity === "safe" && i.fix);
  for (const issue of safe) {
    current = applyAuditFix(
      current,
      issue,
      paragraphs,
      features,
      tocRange
    );
  }
  return {
    ...current,
    changelog: [
      ...current.changelog,
      `Applied ${safe.length} safe audit fix(es)`,
    ],
  };
}

function rebuildDraft(
  draft: ImportDraft,
  paragraphs: DocxParagraphRaw[],
  features: ParagraphFeatures[],
  tocRange: TocRange | null,
  boundaries: number[],
  candidates: BoundaryCandidate[]
): ImportDraft {
  const sections = buildSectionDrafts(
    paragraphs,
    boundaries,
    tocRange,
    candidates
  );
  const importParagraphs = toImportParagraphs(
    paragraphs,
    features,
    boundaries,
    tocRange
  );
  const issues = auditImportDraft(
    sections,
    importParagraphs,
    boundaries,
    features,
    tocRange
  );
  const sectionsWithIssues = attachIssuesToSections(sections, issues);

  return {
    ...draft,
    paragraphs: importParagraphs,
    boundaries,
    candidates: syncCandidatesSelection(candidates, boundaries),
    sections: sectionsWithIssues,
    issues,
  };
}

export function draftFromCandidates(
  candidates: BoundaryCandidate[],
  paragraphs: DocxParagraphRaw[],
  features: ParagraphFeatures[],
  tocRange: TocRange | null,
  warnings: string[],
  changelog: string[],
  importMode: "smart" | "heuristic"
): ImportDraft {
  const boundaries = selectedBoundaries(candidates);
  const sections = buildSectionDrafts(
    paragraphs,
    boundaries,
    tocRange,
    candidates
  );
  const importParagraphs = toImportParagraphs(
    paragraphs,
    features,
    boundaries,
    tocRange
  );
  const issues = auditImportDraft(
    sections,
    importParagraphs,
    boundaries,
    features,
    tocRange
  );

  return {
    paragraphs: importParagraphs,
    boundaries,
    candidates,
    sections: attachIssuesToSections(sections, issues),
    issues,
    tocRange,
    warnings,
    changelog,
    importMode,
  };
}

import { describe, expect, it } from "vitest";
import {
  acceptSuggestionClient,
  applyAuditFixClient,
  draftToBlocks,
  rebuildDraftClient,
  snapSectionFromIndices,
  suggestionIndices,
  toggleBoundaryClient,
  toggleSectionCarryOverClient,
} from "./import-draft-client";
import type { ImportDraft } from "./import-draft-types";

function minimalDraft(boundaries: number[]): ImportDraft {
  const paragraphs = [
    {
      index: 0,
      text: "Honor Code",
      markdown: "Honor Code",
      preview: "Honor Code",
      wordCount: 2,
      bold: false,
      listLevel: 1,
      fontSizeRatio: 1,
      inToc: false,
      isBoundary: boundaries.includes(0),
    },
    {
      index: 1,
      text: "Students must tell the truth at all times.",
      markdown: "Students must tell the truth at all times.",
      preview: "Students must tell the truth at all times.",
      wordCount: 8,
      bold: false,
      listLevel: null,
      fontSizeRatio: 1,
      inToc: false,
      isBoundary: false,
    },
    {
      index: 2,
      text: "Discipline",
      markdown: "Discipline",
      preview: "Discipline",
      wordCount: 1,
      bold: false,
      listLevel: 1,
      fontSizeRatio: 1,
      inToc: false,
      isBoundary: boundaries.includes(2),
    },
  ];

  const draft: ImportDraft = {
    paragraphs,
    boundaries,
    candidates: [],
    sections: [],
    issues: [],
    tocRange: null,
    warnings: [],
    changelog: [],
    importMode: "smart",
  };

  return rebuildDraftClient(draft, boundaries);
}

describe("import-draft-client", () => {
  it("toggleBoundary adds and removes sections", () => {
    let draft = minimalDraft([0]);
    expect(draft.sections).toHaveLength(1);
    expect(draft.sections[0].content).toContain("tell the truth");

    draft = toggleBoundaryClient(draft, 2);
    expect(draft.sections).toHaveLength(2);
    expect(draft.sections[0].content).not.toContain("Discipline");
  });

  it("applyAuditFix merges empty section", () => {
    let draft = minimalDraft([0, 2]);
    const emptyIssue = draft.issues.find((i) => i.kind === "empty_section");
    expect(emptyIssue).toBeDefined();
    draft = applyAuditFixClient(draft, emptyIssue!);
    expect(draft.sections.length).toBeLessThan(2);
  });

  it("snapSectionFromIndices creates boundaries at selection", () => {
    let draft = minimalDraft([]);
    draft = snapSectionFromIndices(draft, [0, 1]);
    expect(draft.boundaries).toContain(0);
    expect(draft.boundaries).toContain(2);
    expect(draft.sections).toHaveLength(2);
    expect(draft.sections[0].content).toContain("tell the truth");
  });

  it("draftToBlocks only includes carryOver sections", () => {
    let draft = minimalDraft([0, 2]);
    draft = toggleSectionCarryOverClient(draft, draft.sections[0].id);
    const blocks = draftToBlocks(draft);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe("Discipline");
  });

  it("suggestionIndices excludes accepted boundaries", () => {
    const draft = minimalDraft([]);
    const withCandidates: ImportDraft = {
      ...draft,
      candidates: [
        {
          index: 0,
          source: "numbered",
          confidence: "high",
          reason: "test",
          selected: false,
        },
        {
          index: 2,
          source: "llm",
          confidence: "medium",
          reason: "test",
          selected: false,
        },
      ],
    };
    expect(suggestionIndices(withCandidates).size).toBe(2);
    const accepted = acceptSuggestionClient(withCandidates, 0);
    expect(suggestionIndices(accepted).has(0)).toBe(false);
    expect(suggestionIndices(accepted).has(2)).toBe(true);
  });
});

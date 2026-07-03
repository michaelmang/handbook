"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuditIssue,
  DocxImportResult,
  ImportDraft,
  SectionDraft,
} from "@/lib/import/import-draft-types";
import {
  acceptAllSuggestionsClient,
  acceptSuggestionClient,
  applyAllSafeFixesClient,
  applyAuditFixClient,
  draftToBlocks,
  mergeSectionsClient,
  snapSectionFromIndices,
  suggestionIndices,
  toggleBoundaryClient,
  scrollToParagraph,
} from "@/lib/import/import-draft-client";
import {
  selectParagraph,
  visibleParagraphIndices,
} from "@/lib/import/paragraph-selection";
import { DocumentSnapPreview } from "@/components/DocumentSnapPreview";

interface ImportReviewPanelProps {
  result: DocxImportResult & { draft: ImportDraft };
  onConfirm: (blocks: ReturnType<typeof draftToBlocks>) => void;
  onCancel: () => void;
}

export function ImportReviewPanel({
  result,
  onConfirm,
  onCancel,
}: ImportReviewPanelProps) {
  const [draft, setDraft] = useState<ImportDraft>(result.draft);
  const [showToc, setShowToc] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const visibleIndices = useMemo(
    () => visibleParagraphIndices(draft.paragraphs, showToc),
    [draft.paragraphs, showToc]
  );

  const suggestionCount = useMemo(
    () => suggestionIndices(draft).size,
    [draft]
  );

  const safeIssueCount = draft.issues.filter(
    (i) => i.severity === "safe" && i.fix
  ).length;

  const clearParagraphSelection = useCallback(() => {
    setSelectedIndices(new Set());
    setSelectionAnchor(null);
  }, []);

  const handleSelectParagraph = useCallback(
    (index: number, modifiers: { shift: boolean; meta: boolean }) => {
      const result = selectParagraph(
        index,
        modifiers,
        visibleIndices,
        selectedIndices,
        selectionAnchor
      );
      setSelectedIndices(result.selected);
      setSelectionAnchor(result.anchor);
    },
    [visibleIndices, selectedIndices, selectionAnchor]
  );

  const handleCreateSection = useCallback(() => {
    const indices = [...selectedIndices];
    if (indices.length === 0) return;
    setDraft((d) => snapSectionFromIndices(d, indices));
    clearParagraphSelection();
  }, [selectedIndices, clearParagraphSelection]);

  const handleToggleBoundaryOnSelection = useCallback(() => {
    const sorted = [...selectedIndices].sort((a, b) => a - b);
    if (sorted.length === 0) return;
    setDraft((d) => toggleBoundaryClient(d, sorted[0]));
    clearParagraphSelection();
  }, [selectedIndices, clearParagraphSelection]);

  const handleToggleBoundary = useCallback((index: number) => {
    setDraft((d) => toggleBoundaryClient(d, index));
  }, []);

  const handleAcceptSuggestion = useCallback((index: number) => {
    setDraft((d) => acceptSuggestionClient(d, index));
  }, []);

  const handleAcceptAllSuggestions = useCallback(() => {
    setDraft((d) => acceptAllSuggestionsClient(d));
  }, []);

  const handleApplyFix = useCallback((issue: AuditIssue) => {
    setDraft((d) => applyAuditFixClient(d, issue));
  }, []);

  const handleApplyAllSafe = useCallback(() => {
    setDraft((d) => applyAllSafeFixesClient(d));
  }, []);

  const handleMergeSelected = useCallback(() => {
    const ids = Array.from(selectedSectionIds);
    if (ids.length < 2) return;
    setDraft((d) => mergeSectionsClient(d, ids));
    setSelectedSectionIds(new Set());
  }, [selectedSectionIds]);

  const toggleSectionSelected = (id: string) => {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Escape") {
        clearParagraphSelection();
      } else if (e.key === "Enter" && selectedIndices.size > 0) {
        e.preventDefault();
        handleCreateSection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearParagraphSelection, handleCreateSection, selectedIndices.size]);

  const canImport = draft.sections.length > 0;
  const selectionCount = selectedIndices.size;
  const firstSelectedIsBoundary = useMemo(() => {
    if (selectionCount !== 1) return false;
    const idx = [...selectedIndices][0];
    return draft.boundaries.includes(idx);
  }, [selectionCount, selectedIndices, draft.boundaries]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-100">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-stone-900">
            Define sections
          </h2>
          <p className="text-xs text-stone-500">
            {draft.sections.length} section{draft.sections.length !== 1 ? "s" : ""}{" "}
            · {draft.paragraphs.length} paragraphs
            {selectionCount > 0 && ` · ${selectionCount} selected`}
            {suggestionCount > 0 && ` · ${suggestionCount} AI suggestions`}
            {draft.tocRange && (
              <span>
                {" "}
                · TOC ¶{draft.tocRange.start}–{draft.tocRange.end} excluded
              </span>
            )}
          </p>
        </div>

        {selectionCount > 0 && (
          <>
            <button
              type="button"
              onClick={handleCreateSection}
              className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
            >
              Create section ({selectionCount})
            </button>
            {selectionCount === 1 && (
              <button
                type="button"
                onClick={handleToggleBoundaryOnSelection}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                {firstSelectedIsBoundary ? "Remove break" : "Add break"}
              </button>
            )}
            <button
              type="button"
              onClick={clearParagraphSelection}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
            >
              Clear
            </button>
          </>
        )}

        <label className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={showSuggestions}
            onChange={(e) => setShowSuggestions(e.target.checked)}
            className="rounded border-stone-300"
          />
          Suggestions
        </label>
        <label className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={showToc}
            onChange={(e) => setShowToc(e.target.checked)}
            className="rounded border-stone-300"
          />
          Show TOC
        </label>

        {suggestionCount > 0 && (
          <button
            type="button"
            onClick={handleAcceptAllSuggestions}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            Accept all {suggestionCount}
          </button>
        )}
        {safeIssueCount > 0 && (
          <button
            type="button"
            onClick={handleApplyAllSafe}
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-900 hover:bg-green-100"
          >
            Apply {safeIssueCount} safe fix{safeIssueCount !== 1 ? "es" : ""}
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canImport}
          onClick={() => onConfirm(draftToBlocks(draft))}
          className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Import {draft.sections.length} section{draft.sections.length !== 1 ? "s" : ""}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-stone-200 bg-stone-50">
          <p className="shrink-0 border-b border-stone-100 bg-white px-4 py-1.5 text-xs text-stone-400">
            Select paragraphs · Shift for range · ⌘/Ctrl to multi-select · Enter
            to create section
          </p>
          <DocumentSnapPreview
            draft={draft}
            showToc={showToc}
            showSuggestions={showSuggestions}
            selectedIndices={selectedIndices}
            onSelectParagraph={handleSelectParagraph}
            onAcceptSuggestion={handleAcceptSuggestion}
          />
        </div>

        <aside className="flex w-80 shrink-0 flex-col bg-white lg:w-96">
          <div className="flex min-h-0 flex-1 flex-col border-b border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Sections ({draft.sections.length})
              </span>
              {selectedSectionIds.size >= 2 && (
                <button
                  type="button"
                  onClick={handleMergeSelected}
                  className="text-xs font-medium text-stone-700 hover:text-stone-900"
                >
                  Merge {selectedSectionIds.size}
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {draft.sections.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-stone-400">
                  No sections yet. Select paragraphs and click Create section.
                </p>
              ) : (
                draft.sections.map((s) => (
                  <SectionRow
                    key={s.id}
                    section={s}
                    issues={draft.issues.filter((i) =>
                      s.issueIds.includes(i.id)
                    )}
                    selected={selectedSectionIds.has(s.id)}
                    expanded={expandedSection === s.id}
                    onSelect={() => toggleSectionSelected(s.id)}
                    onToggleExpand={() =>
                      setExpandedSection((id) => (id === s.id ? null : s.id))
                    }
                    onJump={() => scrollToParagraph(s.boundaryIndex)}
                    onRemoveBoundary={() =>
                      handleToggleBoundary(s.boundaryIndex)
                    }
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex max-h-[40%] min-h-0 flex-col">
            <div className="border-b border-stone-100 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Audit ({draft.issues.length})
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {draft.issues.length === 0 ? (
                <p className="px-2 py-4 text-sm text-stone-500">
                  No issues flagged.
                </p>
              ) : (
                <ul className="space-y-2">
                  {draft.issues.map((issue) => (
                    <AuditRow
                      key={issue.id}
                      issue={issue}
                      onApply={() => handleApplyFix(issue)}
                      onJump={
                        issue.paragraphIndex != null
                          ? () => scrollToParagraph(issue.paragraphIndex!)
                          : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionRow({
  section,
  issues,
  selected,
  expanded,
  onSelect,
  onToggleExpand,
  onJump,
  onRemoveBoundary,
}: {
  section: SectionDraft;
  issues: AuditIssue[];
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onJump: () => void;
  onRemoveBoundary: () => void;
}) {
  const hasIssue = issues.length > 0;
  return (
    <div
      className={`mb-2 rounded-lg border p-2 ${
        selected
          ? "border-stone-400 bg-stone-100"
          : hasIssue
            ? "border-amber-200 bg-amber-50/50"
            : "border-stone-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="mt-1 h-3.5 w-3.5 rounded border-stone-300"
          aria-label={`Select ${section.title}`}
        />
        <button
          type="button"
          onClick={onJump}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-stone-400">
              ¶{section.boundaryIndex}
            </span>
            <p className="truncate text-sm font-medium text-stone-900">
              {section.title}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            {section.charCount === 0
              ? "Empty"
              : `${section.charCount.toLocaleString()} chars`}
            {hasIssue &&
              ` · ${issues.length} issue${issues.length !== 1 ? "s" : ""}`}
          </p>
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-xs text-stone-500 hover:text-stone-800"
        >
          {expanded ? "Hide" : "Preview"}
        </button>
        <button
          type="button"
          onClick={onRemoveBoundary}
          className="text-xs text-stone-400 hover:text-red-600"
          title="Remove section break"
        >
          ×
        </button>
      </div>
      {expanded && section.content && (
        <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-stone-50 p-2 text-xs text-stone-600">
          {section.content.slice(0, 2000)}
          {section.content.length > 2000 ? "…" : ""}
        </pre>
      )}
    </div>
  );
}

function AuditRow({
  issue,
  onApply,
  onJump,
}: {
  issue: AuditIssue;
  onApply: () => void;
  onJump?: () => void;
}) {
  return (
    <li
      className={`rounded-lg border px-2.5 py-2 text-xs ${
        issue.severity === "safe"
          ? "border-green-200 bg-green-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <button
        type="button"
        onClick={onJump}
        disabled={!onJump}
        className={`text-left text-stone-800 ${onJump ? "hover:underline" : ""}`}
      >
        {issue.message}
      </button>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
            issue.severity === "safe"
              ? "bg-green-100 text-green-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {issue.severity}
        </span>
        {issue.fix && (
          <button
            type="button"
            onClick={onApply}
            className="font-medium text-stone-700 hover:text-stone-900"
          >
            Apply fix
          </button>
        )}
      </div>
    </li>
  );
}

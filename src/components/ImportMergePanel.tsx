"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocxImportResult, ImportDraft } from "@/lib/import/import-draft-types";
import {
  draftToBlocks,
  resetToPredictedBoundariesClient,
  scrollToParagraph,
  setAllSectionsCarryOverClient,
  snapSectionFromIndices,
  toggleBoundaryClient,
  toggleSectionCarryOverClient,
} from "@/lib/import/import-draft-client";
import {
  selectParagraph,
  visibleParagraphIndices,
} from "@/lib/import/paragraph-selection";
import { DocumentSourcePane } from "@/components/DocumentSourcePane";
import { ImportMarkdownPreview } from "@/components/ImportMarkdownPreview";

interface ImportMergePanelProps {
  result: DocxImportResult & { draft: ImportDraft };
  onConfirm: (blocks: ReturnType<typeof draftToBlocks>) => void;
  onCancel: () => void;
}

export function ImportMergePanel({
  result,
  onConfirm,
  onCancel,
}: ImportMergePanelProps) {
  const [draft, setDraft] = useState<ImportDraft>(result.draft);
  const [showToc, setShowToc] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const visibleIndices = useMemo(
    () => visibleParagraphIndices(draft.paragraphs, showToc),
    [draft.paragraphs, showToc]
  );

  const carryCount = draft.sections.filter((s) => s.carryOver).length;

  const clearParagraphSelection = useCallback(() => {
    setSelectedIndices(new Set());
    setSelectionAnchor(null);
  }, []);

  const handleSelectParagraph = useCallback(
    (index: number, modifiers: { shift: boolean; meta: boolean }) => {
      const next = selectParagraph(
        index,
        modifiers,
        visibleIndices,
        selectedIndices,
        selectionAnchor
      );
      setSelectedIndices(next.selected);
      setSelectionAnchor(next.anchor);
    },
    [visibleIndices, selectedIndices, selectionAnchor]
  );

  const handleCreateSection = useCallback(() => {
    const indices = [...selectedIndices];
    if (indices.length === 0) return;
    setDraft((d) => snapSectionFromIndices(d, indices));
    clearParagraphSelection();
  }, [selectedIndices, clearParagraphSelection]);

  const handleToggleBoundary = useCallback(() => {
    const sorted = [...selectedIndices].sort((a, b) => a - b);
    if (sorted.length !== 1) return;
    setDraft((d) => toggleBoundaryClient(d, sorted[0]));
    clearParagraphSelection();
  }, [selectedIndices, clearParagraphSelection]);

  const handleSectionClick = (sectionId: string, boundaryIndex: number) => {
    setActiveSectionId(sectionId);
    scrollToParagraph(boundaryIndex);
    document
      .getElementById(`preview-section-${sectionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "Escape") clearParagraphSelection();
      else if (e.key === "Enter" && selectedIndices.size > 0) {
        e.preventDefault();
        handleCreateSection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearParagraphSelection, handleCreateSection, selectedIndices.size]);

  const firstSelectedIsBoundary = useMemo(() => {
    if (selectedIndices.size !== 1) return false;
    const idx = [...selectedIndices][0];
    return draft.boundaries.includes(idx);
  }, [selectedIndices, draft.boundaries]);

  const canImport = carryCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-100">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-stone-900">
            Review auto-imported sections
          </h2>
          <p className="text-xs text-stone-500">
            {draft.sections.length} sections detected · {carryCount} to import ·{" "}
            {draft.paragraphs.length} paragraphs
          </p>
        </div>

        {selectedIndices.size > 0 && (
          <>
            <button
              type="button"
              onClick={handleCreateSection}
              className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700"
            >
              Create section ({selectedIndices.size})
            </button>
            {selectedIndices.size === 1 && (
              <button
                type="button"
                onClick={handleToggleBoundary}
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

        <button
          type="button"
          onClick={() => setDraft((d) => resetToPredictedBoundariesClient(d))}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
        >
          Reset boundaries
        </button>

        <label className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={showToc}
            onChange={(e) => setShowToc(e.target.checked)}
            className="rounded border-stone-300"
          />
          Show TOC
        </label>

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
          Import {carryCount} section{carryCount !== 1 ? "s" : ""}
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-4 py-2">
        <span className="shrink-0 text-xs font-medium text-stone-500">
          Sections:
        </span>
        <button
          type="button"
          onClick={() => setDraft((d) => setAllSectionsCarryOverClient(d, true))}
          className="shrink-0 text-xs text-stone-500 hover:text-stone-800"
        >
          All
        </button>
        <button
          type="button"
          onClick={() =>
            setDraft((d) => setAllSectionsCarryOverClient(d, false))
          }
          className="shrink-0 text-xs text-stone-500 hover:text-stone-800"
        >
          None
        </button>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
          {draft.sections.map((s) => (
            <label
              key={s.id}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                s.carryOver
                  ? activeSectionId === s.id
                    ? "border-amber-400 bg-amber-50 text-amber-900"
                    : "border-stone-300 bg-white text-stone-700"
                  : "border-stone-200 bg-stone-50 text-stone-400 line-through"
              }`}
            >
              <input
                type="checkbox"
                checked={s.carryOver}
                onChange={() =>
                  setDraft((d) => toggleSectionCarryOverClient(d, s.id))
                }
                className="h-3 w-3 rounded border-stone-300"
              />
              <button
                type="button"
                onClick={() => handleSectionClick(s.id, s.boundaryIndex)}
                className="max-w-[140px] truncate"
                style={{ marginLeft: s.relativeDepth * 8 }}
              >
                {s.title}
              </button>
            </label>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col border-b border-stone-200 lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-stone-100 bg-stone-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-stone-500">
            Original document
          </div>
          <p className="shrink-0 border-b border-stone-100 bg-white px-4 py-1.5 text-xs text-stone-400">
            Select paragraphs · Shift range · ⌘ multi-select · redraw section
            breaks
          </p>
          <DocumentSourcePane
            draft={draft}
            showToc={showToc}
            selectedIndices={selectedIndices}
            activeSectionId={activeSectionId}
            onSelectParagraph={handleSelectParagraph}
          />
        </div>

        <div className="flex min-h-0 flex-col bg-stone-50">
          <div className="shrink-0 border-b border-stone-100 bg-stone-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-stone-500">
            Import preview
          </div>
          <p className="shrink-0 border-b border-stone-100 bg-white px-4 py-1.5 text-xs text-stone-400">
            Live markdown preview of checked sections
          </p>
          <ImportMarkdownPreview
            sections={draft.sections}
            activeSectionId={activeSectionId}
          />
        </div>
      </div>
    </div>
  );
}

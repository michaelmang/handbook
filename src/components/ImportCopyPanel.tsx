"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarkdownBlock } from "@/lib/markdown-split";
import {
  DocxPreviewReader,
  DOCX_ROOT_SELECTOR,
} from "@/components/DocxPreviewReader";
import type { PreviewSection } from "@/lib/import/docx-preview-sections";
import { scrollToPreviewSection } from "@/lib/import/docx-preview-sections";
import {
  getSelectionInElement,
  sectionFromPastedText,
  sectionFromPreviewParagraphs,
  sectionFromSelection,
} from "@/lib/import/selection-to-section";

export interface PickedSection {
  id: string;
  title: string;
  content: string;
  carryOver: boolean;
}

interface ImportCopyPanelProps {
  docxBuffer: ArrayBuffer;
  fileName: string;
  onConfirm: (blocks: MarkdownBlock[]) => void;
  onCancel: () => void;
}

export function ImportCopyPanel({
  docxBuffer,
  fileName,
  onConfirm,
  onCancel,
}: ImportCopyPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<PickedSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSectionGuides, setShowSectionGuides] = useState(true);
  const [detectedSections, setDetectedSections] = useState<PreviewSection[]>(
    []
  );

  const carryCount = sections.filter((s) => s.carryOver).length;
  const active = sections.find((s) => s.id === activeId) ?? null;

  const getDocRoot = useCallback((): HTMLElement | null => {
    return panelRef.current?.querySelector(DOCX_ROOT_SELECTOR) ?? null;
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      const root = getDocRoot();
      if (!root) {
        setHasSelection(false);
        return;
      }
      setHasSelection(!!getSelectionInElement(root));
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [getDocRoot]);

  const addSection = useCallback((title: string, content: string) => {
    const section: PickedSection = {
      id: nanoid(10),
      title: title.trim() || "Untitled section",
      content: content.trim(),
      carryOver: true,
    };
    setSections((prev) => [...prev, section]);
    setActiveId(section.id);
    setError(null);
    window.getSelection()?.removeAllRanges();
    setHasSelection(false);
  }, []);

  const handleAddSelection = useCallback(() => {
    const root = getDocRoot();
    if (!root) return;

    try {
      const snapshot = getSelectionInElement(root);
      if (!snapshot) {
        setError("Highlight text in the document first");
        return;
      }
      const { title, content } = sectionFromSelection(snapshot);
      addSection(title, content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add selection");
    }
  }, [addSection, getDocRoot]);

  const handleAddDetectedSection = useCallback(
    (section: PreviewSection) => {
      try {
        const { title, content } = sectionFromPreviewParagraphs(
          section.paragraphs
        );
        addSection(title, content);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not add section"
        );
      }
    },
    [addSection]
  );

  const handleJumpToSection = useCallback(
    (sectionId: string) => {
      const root = panelRef.current?.querySelector(DOCX_ROOT_SELECTOR);
      if (root instanceof HTMLElement) {
        scrollToPreviewSection(root, sectionId);
      }
    },
    []
  );

  const handleSectionsDetected = useCallback((sections: PreviewSection[]) => {
    setDetectedSections(sections);
  }, []);

  const handlePasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const { title, content } = sectionFromPastedText(text);
      addSection(title, content);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not read clipboard — try Add selection instead"
      );
    }
  }, [addSection]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      e.preventDefault();
      handleAddSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAddSelection]);

  return (
    <div ref={panelRef} className="fixed inset-0 z-50 flex flex-col bg-stone-100">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-stone-900">
            Copy sections from document
          </h2>
          <p className="truncate text-xs text-stone-500">
            {fileName} · {sections.length} section
            {sections.length !== 1 ? "s" : ""} · {carryCount} to import
          </p>
        </div>

        <button
          type="button"
          disabled={!hasSelection}
          onClick={handleAddSelection}
          className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add selection
        </button>
        <button
          type="button"
          onClick={() => void handlePasteClipboard()}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          Paste from clipboard
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={carryCount === 0}
          onClick={() =>
            onConfirm(
              sections
                .filter((s) => s.carryOver)
                .map((s) => ({
                  relativeDepth: 0,
                  title: s.title,
                  content: s.content,
                }))
            )
          }
          className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Import {carryCount} section{carryCount !== 1 ? "s" : ""}
        </button>
      </header>

      {error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col border-b border-stone-200 lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-stone-100 bg-stone-50 px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  Original document
                </p>
                <p className="mt-0.5 text-xs text-stone-400">
                  Select text with your mouse — just like Word · Add selection or
                  ⌘/Ctrl+Enter
                </p>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-stone-600">
                <input
                  type="checkbox"
                  checked={showSectionGuides}
                  onChange={(e) => setShowSectionGuides(e.target.checked)}
                  className="h-3.5 w-3.5 rounded"
                />
                Section guides
              </label>
            </div>
            {showSectionGuides && detectedSections.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detectedSections.map((section) => (
                  <div
                    key={section.id}
                    className="flex max-w-full items-center gap-1 rounded-md border border-stone-200 bg-white text-xs"
                    style={{ marginLeft: `${section.level * 10}px` }}
                  >
                    <button
                      type="button"
                      onClick={() => handleJumpToSection(section.id)}
                      className="max-w-[180px] truncate px-2 py-1 text-left text-stone-700 hover:bg-stone-50"
                      title={section.label}
                    >
                      {section.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddDetectedSection(section)}
                      className="border-l border-stone-200 px-2 py-1 font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DocxPreviewReader
            data={docxBuffer}
            showSectionGuides={showSectionGuides}
            onSectionsDetected={handleSectionsDetected}
          />
        </div>

        <div className="flex min-h-0 flex-col bg-stone-50">
          <div className="shrink-0 border-b border-stone-100 bg-stone-50 px-4 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Sections to import
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              Preview updates instantly
            </p>
          </div>

          {sections.length > 0 && (
            <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-stone-100 bg-white px-3 py-2">
              <button
                type="button"
                onClick={() =>
                  setSections((prev) =>
                    prev.map((s) => ({ ...s, carryOver: true }))
                  )
                }
                className="shrink-0 text-xs text-stone-500 hover:text-stone-800"
              >
                All
              </button>
              <button
                type="button"
                onClick={() =>
                  setSections((prev) =>
                    prev.map((s) => ({ ...s, carryOver: false }))
                  )
                }
                className="shrink-0 text-xs text-stone-500 hover:text-stone-800"
              >
                None
              </button>
              {sections.map((s) => (
                <label
                  key={s.id}
                  className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-xs ${
                    activeId === s.id
                      ? "border-amber-400 bg-amber-50"
                      : "border-stone-200 bg-white"
                  } ${!s.carryOver ? "opacity-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={s.carryOver}
                    onChange={() =>
                      setSections((prev) =>
                        prev.map((x) =>
                          x.id === s.id
                            ? { ...x, carryOver: !x.carryOver }
                            : x
                        )
                      )
                    }
                    className="h-3 w-3 rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveId(s.id)}
                    className="max-w-[140px] truncate"
                  >
                    {s.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSections((prev) => prev.filter((x) => x.id !== s.id));
                      if (activeId === s.id) setActiveId(null);
                    }}
                    className="text-stone-400 hover:text-red-600"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </label>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {sections.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="rounded-lg border-2 border-dashed border-stone-300 px-8 py-6">
                  <p className="text-sm font-medium text-stone-600">
                    No sections yet
                  </p>
                  <p className="mt-2 max-w-sm text-xs text-stone-400">
                    Highlight a section on the left (title + body), then click{" "}
                    <strong>Add selection</strong>.
                  </p>
                </div>
              </div>
            ) : active ? (
              <div className="p-6">
                <div className="prose-handbook max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {active.content.trim()
                      ? `# ${active.title}\n\n${active.content}`
                      : `# ${active.title}`}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-stone-500">
                Select a section above to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

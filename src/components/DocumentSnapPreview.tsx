"use client";

import { useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react";
import type { ImportDraft } from "@/lib/import/import-draft-types";
import { suggestionIndices } from "@/lib/import/import-draft-client";

interface DocumentSnapPreviewProps {
  draft: ImportDraft;
  showToc: boolean;
  showSuggestions: boolean;
  selectedIndices: Set<number>;
  onSelectParagraph: (
    index: number,
    modifiers: { shift: boolean; meta: boolean }
  ) => void;
  onAcceptSuggestion: (index: number) => void;
}

export function DocumentSnapPreview({
  draft,
  showToc,
  showSuggestions,
  selectedIndices,
  onSelectParagraph,
  onAcceptSuggestion,
}: DocumentSnapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => suggestionIndices(draft), [draft]);
  const visible = useMemo(
    () =>
      showToc ? draft.paragraphs : draft.paragraphs.filter((p) => !p.inToc),
    [draft.paragraphs, showToc]
  );

  const sectionColorByIndex = useMemo(() => {
    const map = new Map<number, number>();
    draft.boundaries.forEach((b, i) => map.set(b, i % 6));
    return map;
  }, [draft.boundaries]);

  const handleRowClick = (index: number, e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-suggestion-accept]")) return;
    onSelectParagraph(index, {
      shift: e.shiftKey,
      meta: e.metaKey || e.ctrlKey,
    });
  };

  const sectionStripe = (index: number): string => {
    const si = sectionColorByIndex.get(index);
    if (si == null) return "border-l-transparent";
    const colors = [
      "border-l-stone-300",
      "border-l-blue-300",
      "border-l-emerald-300",
      "border-l-violet-300",
      "border-l-amber-300",
      "border-l-rose-300",
    ];
    return colors[si] ?? "border-l-stone-300";
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 overflow-y-auto bg-white px-4 py-8"
    >
      <div className="mx-auto max-w-3xl">
        {draft.tocRange && !showToc && (
          <div className="mb-6 rounded-lg border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-center text-xs text-stone-500">
            Table of contents hidden · enable &ldquo;Show TOC&rdquo; to view
          </div>
        )}

        {visible.map((p) => {
          const isSuggestion =
            showSuggestions && suggestions.has(p.index) && !p.isBoundary;
          const isSelected = selectedIndices.has(p.index);

          return (
            <div
              key={p.index}
              data-paragraph-index={p.index}
              className={`group relative flex gap-2 border-l-2 py-1.5 pr-2 transition-colors ${sectionStripe(p.index)} ${
                isSelected
                  ? "bg-sky-50"
                  : p.isBoundary
                    ? "bg-stone-50/80"
                    : p.inToc
                      ? "opacity-60"
                      : "hover:bg-stone-50/50"
              } ${isSuggestion ? "ring-1 ring-inset ring-amber-200/80" : ""}`}
              style={{
                paddingLeft: `${0.5 + (p.listLevel ?? 0) * 1.25}rem`,
                fontSize:
                  p.fontSizeRatio >= 1.15
                    ? "1.05rem"
                    : p.fontSizeRatio >= 1.08
                      ? "1rem"
                      : "0.9375rem",
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectParagraph(p.index, {
                    shift: e.shiftKey,
                    meta: true,
                  });
                }}
                className="mt-1.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-stone-300"
                aria-label={`Select paragraph ${p.index}`}
              />

              <button
                type="button"
                onClick={(e) => handleRowClick(p.index, e)}
                className="min-w-0 flex-1 text-left"
              >
                {p.isBoundary && (
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                    Section start
                  </span>
                )}

                {isSuggestion && (
                  <span
                    role="button"
                    tabIndex={0}
                    data-suggestion-accept
                    className="mb-0.5 block text-[10px] font-medium text-amber-700 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAcceptSuggestion(p.index);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onAcceptSuggestion(p.index);
                      }
                    }}
                  >
                    + AI suggestion — click to accept
                  </span>
                )}

                <ParagraphContent
                  markdown={p.markdown}
                  text={p.text}
                  bold={p.bold}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ParagraphContent({
  markdown,
  text,
  bold,
}: {
  markdown: string;
  text: string;
  bold: boolean;
}) {
  if (markdown.includes("**")) {
    const parts = markdown.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p className="leading-relaxed text-stone-800">
        {parts.map((part, i) => {
          const m = part.match(/^\*\*(.+)\*\*$/);
          if (m) return <strong key={i}>{m[1]}</strong>;
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  }
  if (bold) {
    return (
      <p className="font-semibold leading-relaxed text-stone-900">{text}</p>
    );
  }
  return <p className="leading-relaxed text-stone-800">{text}</p>;
}

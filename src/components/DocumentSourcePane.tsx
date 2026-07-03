"use client";

import { useMemo } from "react";
import type { ImportDraft } from "@/lib/import/import-draft-types";

interface DocumentSourcePaneProps {
  draft: ImportDraft;
  showToc: boolean;
  selectedIndices: Set<number>;
  activeSectionId: string | null;
  onSelectParagraph: (
    index: number,
    modifiers: { shift: boolean; meta: boolean }
  ) => void;
}

export function DocumentSourcePane({
  draft,
  showToc,
  selectedIndices,
  activeSectionId,
  onSelectParagraph,
}: DocumentSourcePaneProps) {
  const visible = useMemo(
    () =>
      showToc ? draft.paragraphs : draft.paragraphs.filter((p) => !p.inToc),
    [draft.paragraphs, showToc]
  );

  const sectionByBoundary = useMemo(() => {
    const map = new Map<number, (typeof draft.sections)[0]>();
    for (const s of draft.sections) map.set(s.boundaryIndex, s);
    return map;
  }, [draft.sections]);

  const activeBoundary = useMemo(() => {
    if (!activeSectionId) return null;
    return (
      draft.sections.find((s) => s.id === activeSectionId)?.boundaryIndex ??
      null
    );
  }, [activeSectionId, draft.sections]);

  const sectionColorByIndex = useMemo(() => {
    const map = new Map<number, number>();
    draft.boundaries.forEach((b, i) => map.set(b, i % 8));
    return map;
  }, [draft.boundaries]);

  const sectionStripe = (index: number): string => {
    const si = sectionColorByIndex.get(index);
    if (si == null) return "border-l-transparent";
    const colors = [
      "border-l-stone-400",
      "border-l-blue-400",
      "border-l-emerald-400",
      "border-l-violet-400",
      "border-l-amber-400",
      "border-l-rose-400",
      "border-l-cyan-400",
      "border-l-orange-400",
    ];
    return colors[si] ?? "border-l-stone-300";
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-6">
      <div className="mx-auto max-w-3xl">
        {draft.tocRange && !showToc && (
          <div className="mb-6 rounded-lg border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-center text-xs text-stone-500">
            Table of contents hidden
          </div>
        )}

        {visible.map((p) => {
          const isSelected = selectedIndices.has(p.index);
          const section = sectionByBoundary.get(p.index);
          const isActive = activeBoundary === p.index;
          const excluded = section && !section.carryOver;

          return (
            <div
              key={p.index}
              data-paragraph-index={p.index}
              className={`group relative flex gap-2 border-l-2 py-1.5 pr-2 transition-colors ${sectionStripe(p.index)} ${
                isActive
                  ? "bg-amber-50 ring-1 ring-inset ring-amber-300"
                  : isSelected
                    ? "bg-sky-50"
                    : p.isBoundary
                      ? excluded
                        ? "bg-stone-50 opacity-50"
                        : "bg-stone-50/90"
                      : p.inToc
                        ? "opacity-50"
                        : "hover:bg-stone-50/40"
              }`}
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
                onClick={(e) =>
                  onSelectParagraph(p.index, {
                    shift: e.shiftKey,
                    meta: e.metaKey || e.ctrlKey,
                  })
                }
                className="min-w-0 flex-1 text-left"
              >
                {p.isBoundary && (
                  <span
                    className={`mb-0.5 block text-[10px] font-semibold uppercase tracking-wide ${
                      excluded ? "text-stone-400" : "text-stone-500"
                    }`}
                  >
                    Section: {section?.title ?? "Untitled"}
                    {excluded ? " (excluded)" : ""}
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

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SectionDraft } from "@/lib/import/import-draft-types";
import { sectionsToPreviewMarkdown } from "@/lib/import/import-draft-client";

interface ImportMarkdownPreviewProps {
  sections: SectionDraft[];
  accentColor?: string;
  activeSectionId?: string | null;
}

export function ImportMarkdownPreview({
  sections,
  accentColor = "#1e3a5f",
  activeSectionId = null,
}: ImportMarkdownPreviewProps) {
  const markdown = sectionsToPreviewMarkdown(sections);
  const carryCount = sections.filter((s) => s.carryOver).length;

  if (carryCount === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-stone-500">
          No sections selected to import.
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Check sections below to preview what will be added to your handbook.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div
        className="prose-handbook mx-auto max-w-2xl text-sm"
        style={{ "--accent": accentColor } as React.CSSProperties}
      >
        {sections
          .filter((s) => s.carryOver)
          .map((s) => (
            <section
              key={s.id}
              id={`preview-section-${s.id}`}
              className={`mb-8 scroll-mt-4 rounded-lg transition ${
                activeSectionId === s.id
                  ? "bg-amber-50/80 ring-1 ring-amber-200 -mx-3 px-3 py-2"
                  : ""
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {s.content.trim()
                  ? `# ${s.title}\n\n${s.content}`
                  : `# ${s.title}`}
              </ReactMarkdown>
            </section>
          ))}
      </div>
      {markdown.length > 0 && (
        <p className="mx-auto mt-6 max-w-2xl border-t border-stone-100 pt-4 text-center text-xs text-stone-400">
          {carryCount} section{carryCount !== 1 ? "s" : ""} will be imported
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Section } from "@/lib/types";

interface SectionEditorModalProps {
  section: Section;
  accentColor?: string;
  onSave: (title: string, markdown: string) => void;
  onClose: () => void;
}

export function SectionEditorModal({
  section,
  accentColor = "#1e3a5f",
  onSave,
  onClose,
}: SectionEditorModalProps) {
  const [title, setTitle] = useState(section.title);
  const [markdown, setMarkdown] = useState(section.markdownContent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="border-b border-stone-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-stone-900">Edit section</h3>
          <p className="mt-1 text-xs text-stone-500">
            Edit the body in Markdown. Use the organizer to move sections — not
            heading levels in this file. The title field maps to the section
            header in export.
          </p>
        </div>

        <div className="px-6 pt-4">
          <label className="text-sm font-medium text-stone-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 border-t border-stone-200 mt-4 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-stone-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-stone-100 bg-stone-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Markdown
            </div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="min-h-[280px] flex-1 resize-none border-0 px-4 py-3 font-mono text-sm focus:outline-none focus:ring-0 lg:min-h-[360px]"
              spellCheck={false}
            />
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="border-b border-stone-100 bg-stone-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Preview
            </div>
            <div className="min-h-[280px] flex-1 overflow-y-auto px-4 py-3 lg:min-h-[360px]">
              {markdown.trim() ? (
                <div
                  className="prose-handbook max-w-none text-sm"
                  style={{ "--accent": accentColor } as React.CSSProperties}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {markdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm italic text-stone-400">Nothing to preview</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(title, markdown)}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

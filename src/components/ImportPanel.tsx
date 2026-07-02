"use client";

import { useCallback, useRef, useState } from "react";
import { useProjectsStore } from "@/lib/store";
import { extractTitleFromMarkdown } from "@/lib/markdown";

interface ImportPanelProps {
  projectId: string;
}

export function ImportPanel({ projectId }: ImportPanelProps) {
  const { addSectionFromMarkdown } = useProjectsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const mdFiles = Array.from(files).filter(
        (f) => f.name.endsWith(".md") || f.type === "text/markdown" || f.type === "text/plain"
      );

      for (const file of mdFiles) {
        const text = await file.text();
        if (text.trim()) {
          addSectionFromMarkdown(projectId, text);
        }
      }
    },
    [addSectionFromMarkdown, projectId]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        await processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handlePasteSubmit = () => {
    if (pasteContent.trim()) {
      addSectionFromMarkdown(projectId, pasteContent);
      setPasteContent("");
      setShowPaste(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
          isDragging
            ? "border-stone-500 bg-stone-100"
            : "border-stone-200 bg-stone-50 hover:border-stone-300"
        }`}
      >
        <UploadIcon className="mx-auto h-8 w-8 text-stone-400" />
        <p className="mt-3 text-sm font-medium text-stone-700">
          Drop Markdown files here
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Headings (<code className="text-stone-600">#</code>,{" "}
          <code className="text-stone-600">##</code>, etc.) define nesting
          within each file. Add top-level parts manually, then import.
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50"
        >
          Choose files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {!showPaste ? (
        <button
          onClick={() => setShowPaste(true)}
          className="w-full rounded-lg border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          Paste Markdown instead
        </button>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <label className="text-sm font-medium text-stone-700">
            Paste Markdown content
          </label>
          <textarea
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder={"# Section Title\n\nYour policy content here..."}
            rows={8}
            className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 font-mono text-sm focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          {pasteContent.trim() && (
            <p className="mt-1 text-xs text-stone-500">
              Title: {extractTitleFromMarkdown(pasteContent)}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteContent.trim()}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              Add section
            </button>
            <button
              onClick={() => {
                setShowPaste(false);
                setPasteContent("");
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

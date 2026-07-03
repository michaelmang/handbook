"use client";

import { useCallback, useRef, useState } from "react";
import { useProjectsStore } from "@/lib/store";
import { extractTitleFromMarkdown } from "@/lib/markdown";
import type { MarkdownBlock } from "@/lib/markdown-split";
import { ImportCopyPanel } from "@/components/ImportCopyPanel";
import { ImportMergePanel } from "@/components/ImportMergePanel";
import { draftToBlocks } from "@/lib/import/import-draft-client";
import type { DocxAutoImportResult } from "@/lib/import/upload-docx";
import { uploadDocxForAutoImport } from "@/lib/import/upload-docx";
import type { ImportProgressEvent } from "@/lib/import/import-progress";

const MAX_DOCX_BYTES = 10 * 1024 * 1024;

interface DocxCopyImport {
  kind: "copy";
  buffer: ArrayBuffer;
  fileName: string;
}

interface ImportPanelProps {
  projectId: string;
  parentId?: string | null;
}

export function ImportPanel({ projectId, parentId = null }: ImportPanelProps) {
  const { addSectionFromMarkdown, addSectionsFromBlocks } = useProjectsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [docxCopyImport, setDocxCopyImport] = useState<DocxCopyImport | null>(
    null
  );
  const [docxAutoImport, setDocxAutoImport] =
    useState<DocxAutoImportResult | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxProgress, setDocxProgress] = useState<ImportProgressEvent | null>(
    null
  );
  const [docxError, setDocxError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{
    count: number;
    titles: string[];
  } | null>(null);
  const [reviewBeforeImport, setReviewBeforeImport] = useState(false);

  const processMarkdownFiles = useCallback(
    async (files: FileList | File[]) => {
      const mdFiles = Array.from(files).filter(
        (f) =>
          f.name.endsWith(".md") ||
          f.name.endsWith(".markdown") ||
          f.name.endsWith(".txt") ||
          f.type === "text/markdown" ||
          f.type === "text/plain"
      );

      for (const file of mdFiles) {
        const text = await file.text();
        if (text.trim()) {
          addSectionFromMarkdown(projectId, text, parentId);
        }
      }
    },
    [addSectionFromMarkdown, projectId, parentId]
  );

  const finishAutoImport = useCallback(
    (result: DocxAutoImportResult) => {
      const blocks =
        result.blocks.length > 0 ? result.blocks : draftToBlocks(result.draft);
      if (blocks.length === 0) {
        throw new Error("No sections detected — try manual copy import");
      }
      addSectionsFromBlocks(projectId, blocks, parentId);
      setImportSuccess({
        count: blocks.length,
        titles: blocks.map((b) => b.title),
      });
      setDocxAutoImport(null);
      setDocxError(null);
    },
    [addSectionsFromBlocks, projectId, parentId]
  );

  const processDocxFile = useCallback(
    async (file: File) => {
      setDocxLoading(true);
      setDocxError(null);
      setDocxCopyImport(null);
      setDocxAutoImport(null);
      setImportSuccess(null);
      setDocxProgress(null);

      try {
        if (file.size > MAX_DOCX_BYTES) {
          throw new Error("File exceeds 10MB limit");
        }

        const result = await uploadDocxForAutoImport(file, setDocxProgress);

        if (reviewBeforeImport) {
          setDocxAutoImport(result);
        } else {
          finishAutoImport(result);
        }
      } catch (err) {
        setDocxError(err instanceof Error ? err.message : "Import failed");
      } finally {
        setDocxLoading(false);
        setDocxProgress(null);
      }
    },
    [finishAutoImport, reviewBeforeImport]
  );

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileList = Array.from(files);
      const docxFiles = fileList.filter((f) =>
        f.name.toLowerCase().endsWith(".docx")
      );
      const otherFiles = fileList.filter(
        (f) => !f.name.toLowerCase().endsWith(".docx")
      );

      if (docxFiles.length > 1) {
        setDocxError("Import one Word file at a time.");
        return;
      }

      if (docxFiles.length === 1) {
        await processDocxFile(docxFiles[0]);
      }

      if (otherFiles.length > 0) {
        await processMarkdownFiles(otherFiles);
      }
    },
    [processDocxFile, processMarkdownFiles]
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
      addSectionFromMarkdown(projectId, pasteContent, parentId);
      setPasteContent("");
      setShowPaste(false);
    }
  };

  const handleConfirmImport = (blocks: MarkdownBlock[]) => {
    addSectionsFromBlocks(projectId, blocks, parentId);
    setDocxCopyImport(null);
    setDocxAutoImport(null);
    setDocxError(null);
    setImportSuccess({
      count: blocks.length,
      titles: blocks.map((b) => b.title),
    });
  };

  const openManualCopyImport = async (file: File) => {
    if (file.size > MAX_DOCX_BYTES) {
      setDocxError("File exceeds 10MB limit");
      return;
    }
    const buffer = await file.arrayBuffer();
    setDocxAutoImport(null);
    setDocxCopyImport({ kind: "copy", buffer, fileName: file.name });
  };

  return (
    <>
      {docxCopyImport && (
        <ImportCopyPanel
          docxBuffer={docxCopyImport.buffer}
          fileName={docxCopyImport.fileName}
          onConfirm={handleConfirmImport}
          onCancel={() => {
            setDocxCopyImport(null);
            setDocxError(null);
          }}
        />
      )}

      {docxAutoImport && (
        <ImportMergePanel
          result={docxAutoImport}
          onConfirm={handleConfirmImport}
          onCancel={() => {
            setDocxAutoImport(null);
            setDocxError(null);
          }}
        />
      )}

      {docxLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm font-medium text-stone-900">
              {docxProgress?.message ?? "Importing Word document…"}
            </p>
            {docxProgress?.detail && (
              <p className="mt-1 text-xs text-stone-500">{docxProgress.detail}</p>
            )}
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-stone-800" />
            </div>
          </div>
        </div>
      )}

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
            Drop Markdown or Word files here
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Word files are auto-imported into sections — AI adds subsections,
            formats lists, and cleans stray headings when configured.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={docxLoading}
            className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50"
          >
            {docxLoading ? "Importing…" : "Choose files"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt,.docx,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={reviewBeforeImport}
            onChange={(e) => setReviewBeforeImport(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          Review Word sections before importing
        </label>

        {importSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium">
              Imported {importSuccess.count} section
              {importSuccess.count !== 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              {importSuccess.titles.join(" · ")}
            </p>
          </div>
        )}

        {docxError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {docxError}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept =
              ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) void openManualCopyImport(file);
            };
            input.click();
          }}
          className="w-full rounded-lg border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          Copy sections manually from Word instead
        </button>

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
    </>
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

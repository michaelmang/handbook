"use client";

import { useCallback, useState } from "react";
import { nanoid } from "nanoid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocxImportResult } from "@/lib/import/import-draft-types";
import type { MarkdownBlock } from "@/lib/markdown-split";
import { WordDocumentViewer } from "@/components/WordDocumentViewer";
import { compressCaptureForVision } from "@/lib/import/compress-capture";

export interface CapturedSection {
  id: string;
  title: string;
  content: string;
  carryOver: boolean;
  thumbnail: string;
}

interface ImportVisualPanelProps {
  result: DocxImportResult & { visual: true; html: string };
  onConfirm: (blocks: MarkdownBlock[]) => void;
  onCancel: () => void;
}

export function ImportVisualPanel({
  result,
  onConfirm,
  onCancel,
}: ImportVisualPanelProps) {
  const [sections, setSections] = useState<CapturedSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carryCount = sections.filter((s) => s.carryOver).length;
  const active = sections.find((s) => s.id === activeId) ?? null;

  const handleCapture = useCallback(async (imageDataUrl: string) => {
    setExtracting(true);
    setError(null);
    try {
      const image = await compressCaptureForVision(imageDataUrl);
      const response = await fetch("/api/import/extract-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      const data = (await response.json()) as {
        title?: string;
        content?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Extraction failed");
      }

      const section: CapturedSection = {
        id: nanoid(10),
        title: data.title?.trim() || "Untitled section",
        content: data.content?.trim() ?? "",
        carryOver: true,
        thumbnail: imageDataUrl,
      };

      setSections((prev) => [...prev, section]);
      setActiveId(section.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }, []);

  const handleImport = () => {
    const blocks: MarkdownBlock[] = sections
      .filter((s) => s.carryOver)
      .map((s) => ({
        relativeDepth: 0,
        title: s.title,
        content: s.content,
      }));
    onConfirm(blocks);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-100">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-stone-900">
            Capture sections
          </h2>
          <p className="text-xs text-stone-500">
            {sections.length} captured · {carryCount} to import
            {extracting && " · Extracting with AI…"}
          </p>
        </div>

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
          onClick={handleImport}
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

      {result.warnings.length > 0 && (
        <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          {result.warnings[0]}
          {result.warnings.length > 1 && ` (+${result.warnings.length - 1} more)`}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col border-b border-stone-200 lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-stone-100 bg-stone-50 px-4 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Original document
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              Drag to select a region (screenshot-style) · works on Mac and
              Windows
            </p>
          </div>
          <WordDocumentViewer
            html={result.html}
            disabled={extracting}
            onCapture={handleCapture}
            onCaptureError={setError}
          />
        </div>

        <div className="flex min-h-0 flex-col bg-stone-50">
          <div className="shrink-0 border-b border-stone-100 bg-stone-50 px-4 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Captured sections
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              AI reads your selection and builds markdown below
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
                    className="max-w-[120px] truncate"
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
            {extracting && sections.length === 0 && (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <p className="text-sm text-stone-500">
                  Reading your selection…
                </p>
              </div>
            )}

            {!extracting && sections.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="rounded-lg border-2 border-dashed border-stone-300 px-8 py-6">
                  <p className="text-sm font-medium text-stone-600">
                    No sections yet
                  </p>
                  <p className="mt-2 max-w-xs text-xs text-stone-400">
                    Drag across part of the document on the left — like taking a
                    screenshot — and the AI will transcribe it here.
                  </p>
                </div>
              </div>
            )}

            {active && (
              <div className="p-6">
                <div className="mb-4 overflow-hidden rounded-lg border border-stone-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={active.thumbnail}
                    alt={`Capture: ${active.title}`}
                    className="max-h-40 w-full object-contain object-left-top bg-stone-100"
                  />
                </div>
                <div className="prose-handbook max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {active.content.trim()
                      ? `# ${active.title}\n\n${active.content}`
                      : `# ${active.title}`}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {!active && sections.length > 0 && (
              <div className="p-6 text-center text-sm text-stone-500">
                Select a captured section above to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

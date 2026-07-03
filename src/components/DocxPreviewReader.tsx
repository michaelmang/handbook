"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PreviewSection } from "@/lib/import/docx-preview-sections";
import {
  applySectionHighlights,
  clearSectionHighlights,
  detectPreviewSections,
} from "@/lib/import/docx-preview-sections";

interface DocxPreviewReaderProps {
  data: ArrayBuffer;
  showSectionGuides?: boolean;
  onSectionsDetected?: (sections: PreviewSection[]) => void;
}

export function DocxPreviewReader({
  data,
  showSectionGuides = true,
  onSectionsDetected,
}: DocxPreviewReaderProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendered, setRendered] = useState(false);

  const applyGuides = useCallback(() => {
    const body = bodyRef.current;
    if (!body || !rendered) return;

    if (!showSectionGuides) {
      clearSectionHighlights(body);
      onSectionsDetected?.([]);
      return;
    }

    const sections = detectPreviewSections(body);
    applySectionHighlights(body, sections);
    onSectionsDetected?.(sections);
  }, [showSectionGuides, rendered, onSectionsDetected]);

  useEffect(() => {
    const body = bodyRef.current;
    const style = styleRef.current;
    if (!body || !style) return;

    let cancelled = false;
    body.innerHTML = "";
    style.innerHTML = "";
    setLoading(true);
    setRendered(false);
    setError(null);

    (async () => {
      try {
        const docx = await import("docx-preview");
        if (cancelled) return;

        await docx.renderAsync(data, body, style, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
        });

        if (!cancelled) setRendered(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not render document"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    applyGuides();
  }, [applyGuides]);

  return (
    <div
      className="min-h-0 flex-1 overflow-auto p-6"
      style={{ backgroundColor: "#e7e5e4" }}
    >
      <div ref={styleRef} className="docx-preview-styles" aria-hidden />
      <div className="mx-auto max-w-[8.5in]">
        {loading && (
          <p className="py-12 text-center text-sm text-stone-500">
            Rendering document…
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div
          ref={bodyRef}
          data-docx-root
          className="docx-preview-root bg-white shadow-lg"
        />
      </div>
    </div>
  );
}

export const DOCX_ROOT_SELECTOR = "[data-docx-root]";

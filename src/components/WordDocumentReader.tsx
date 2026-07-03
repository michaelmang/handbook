"use client";

import { useEffect, useRef } from "react";

interface WordDocumentReaderProps {
  html: string;
}

export function WordDocumentReader({ html }: WordDocumentReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.focus();
  }, [html]);

  return (
    <div
      className="min-h-0 flex-1 overflow-auto p-6"
      style={{ backgroundColor: "#e7e5e4" }}
    >
      <div className="mx-auto max-w-[8.5in] shadow-lg">
        <div
          ref={rootRef}
          className="docx-document select-text"
          style={{ backgroundColor: "#ffffff" }}
          tabIndex={-1}
        >
          <div
            className="docx-document-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

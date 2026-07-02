"use client";

import { useState } from "react";
import { useProjectsStore } from "@/lib/store";
import { downloadExport } from "@/lib/export/client";

interface ExportPanelProps {
  projectId: string;
}

export function ExportPanel({ projectId }: ExportPanelProps) {
  const project = useProjectsStore((s) => s.getProject(projectId));
  const exportProjectJson = useProjectsStore((s) => s.exportProjectJson);
  const importProjectJson = useProjectsStore((s) => s.importProjectJson);
  const [loading, setLoading] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!project) return null;

  const includedSections = project.sections.filter((s) => s.included);

  const handleExport = async (format: "pdf" | "docx") => {
    setLoading(format);
    setError(null);
    try {
      await downloadExport(project, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadProject = () => {
    const json = exportProjectJson(projectId);
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.replace(/[^a-z0-9]/gi, "_")}.handbook.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProject = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.handbook.json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const id = importProjectJson(text);
      if (!id) {
        setError("Invalid project file");
      }
    };
    input.click();
  };

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-stone-900">Export handbook</h3>
        <p className="mt-1 text-sm text-stone-500">
          {includedSections.length} section
          {includedSections.length !== 1 ? "s" : ""} will be included in the
          export.
        </p>

        {includedSections.length === 0 && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No sections are included. Go to Organize and ensure sections are
            marked for export.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => handleExport("pdf")}
            disabled={loading !== null || includedSections.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-stone-900 px-5 py-3 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {loading === "pdf" ? (
              <Spinner />
            ) : (
              <PdfIcon />
            )}
            Download PDF
          </button>
          <button
            onClick={() => handleExport("docx")}
            disabled={loading !== null || includedSections.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {loading === "docx" ? (
              <Spinner />
            ) : (
              <DocIcon />
            )}
            Download Word
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-stone-900">
          Project backup
        </h3>
        <p className="mt-1 text-xs text-stone-500">
          Save or restore your project file. Projects are also auto-saved in
          your browser.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleDownloadProject}
            className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Download project file
          </button>
          <button
            onClick={handleImportProject}
            className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Import project file
          </button>
        </div>
      </section>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

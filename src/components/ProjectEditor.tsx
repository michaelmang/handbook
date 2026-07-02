"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjectsStore } from "@/lib/store";
import { OrganizePanel } from "@/components/OrganizePanel";
import { StylePanel } from "@/components/StylePanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { ExportPanel } from "@/components/ExportPanel";

type Tab = "organize" | "style" | "preview" | "export";

const TABS: { id: Tab; label: string }[] = [
  { id: "organize", label: "Organize" },
  { id: "style", label: "Style" },
  { id: "preview", label: "Preview" },
  { id: "export", label: "Export" },
];

interface ProjectEditorProps {
  projectId: string;
}

export function ProjectEditor({ projectId }: ProjectEditorProps) {
  const router = useRouter();
  const { getProject, setActiveProject, updateProject } = useProjectsStore();
  const [activeTab, setActiveTab] = useState<Tab>("organize");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const project = getProject(projectId);

  useEffect(() => {
    setActiveProject(projectId);
  }, [projectId, setActiveProject]);

  useEffect(() => {
    if (!project) {
      router.replace("/");
    }
  }, [project, router]);

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        Loading…
      </div>
    );
  }

  const handleNameSave = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== project.name) {
      updateProject(projectId, { name: trimmed });
    }
    setEditingName(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
          <Link
            href="/"
            className="text-stone-400 transition hover:text-stone-600"
            aria-label="Back to projects"
          >
            <BackIcon />
          </Link>
          <div className="flex-1">
            {editingName ? (
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="text-lg font-semibold text-stone-900 focus:outline-none"
                autoFocus
              />
            ) : (
              <button
                onClick={() => {
                  setNameDraft(project.name);
                  setEditingName(true);
                }}
                className="text-lg font-semibold text-stone-900 hover:text-stone-700"
              >
                {project.name}
              </button>
            )}
            <p className="text-xs text-stone-500">
              {project.sections.filter((s) => s.included).length} sections ·{" "}
              {TEMPLATE_LABELS[project.templateId]} template
            </p>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-7xl">
          {activeTab === "organize" && <OrganizePanel projectId={projectId} />}
          {activeTab === "style" && <StylePanel projectId={projectId} />}
          {activeTab === "preview" && <PreviewPanel projectId={projectId} />}
          {activeTab === "export" && <ExportPanel projectId={projectId} />}
        </div>
      </main>
    </div>
  );
}

const TEMPLATE_LABELS = {
  classic: "Classic",
  modern: "Modern",
  compact: "Compact",
};

function BackIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

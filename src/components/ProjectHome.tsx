"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectsStore } from "@/lib/store";

export function ProjectHome() {
  const router = useRouter();
  const { projects, createProject, duplicateProjectById, deleteProject } =
    useProjectsStore();
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const sorted = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const handleCreate = () => {
    const name = newName.trim() || "Untitled Handbook";
    const id = createProject(name);
    setNewName("");
    setShowCreate(false);
    router.push(`/project/${id}`);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="font-serif text-2xl font-bold text-stone-900">
              Handbook Builder
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Assemble policy documents from Markdown sections
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            New handbook
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {showCreate && (
          <div className="mb-8 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">
              Create a new handbook
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              e.g. &ldquo;2026–27 Student Handbook&rdquo;
            </p>
            <div className="mt-4 flex gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Handbook name"
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                autoFocus
              />
              <button
                onClick={handleCreate}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-stone-200 bg-white px-8 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
              <BookIcon className="h-7 w-7 text-stone-400" />
            </div>
            <h2 className="text-lg font-semibold text-stone-800">
              No handbooks yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
              Import Markdown sections, organize them into nested groups, apply your
              school&apos;s branding, and export a polished PDF or Word document.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
            >
              Create your first handbook
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sorted.map((project) => (
              <div
                key={project.id}
                className="group flex items-center justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow"
              >
                <button
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="flex-1 text-left"
                >
                  <h3 className="font-semibold text-stone-900 group-hover:text-stone-700">
                    {project.name}
                  </h3>
                  <p className="mt-1 text-sm text-stone-500">
                    {project.sections.length} item
                    {project.sections.length !== 1 ? "s" : ""}
                    {" · "}Updated{" "}
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </button>
                <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => {
                      const id = duplicateProjectById(
                        project.id,
                        `${project.name.replace(/\s*\d{4}.*$/, "").trim()} (Next Year)`
                      );
                      router.push(`/project/${id}`);
                    }}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    title="Duplicate for next year"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${project.name}"? This cannot be undone.`
                        )
                      ) {
                        deleteProject(project.id);
                      }
                    }}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function BookIcon({ className }: { className?: string }) {
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
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

"use client";

import { useRef } from "react";
import { useProject, useProjectsStore } from "@/lib/store";
import { TEMPLATE_LIST, DEFAULT_ACCENT_COLORS } from "@/lib/templates";
import type { TemplateId } from "@/lib/types";

interface StylePanelProps {
  projectId: string;
}

export function StylePanel({ projectId }: StylePanelProps) {
  const updateProject = useProjectsStore((s) => s.updateProject);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const project = useProject(projectId);

  if (!project) return null;

  const { branding } = project;

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      updateProject(projectId, {
        branding: { ...branding, logoDataUrl: reader.result as string },
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
          School branding
        </h3>
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
          <div>
            <label className="text-sm font-medium text-stone-700">
              School name
            </label>
            <input
              type="text"
              value={branding.schoolName}
              onChange={(e) =>
                updateProject(projectId, {
                  branding: { ...branding, schoolName: e.target.value },
                })
              }
              placeholder="St. Augustine Academy"
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">Logo</label>
            <div className="mt-2 flex items-center gap-4">
              {branding.logoDataUrl ? (
                <img
                  src={branding.logoDataUrl}
                  alt="School logo"
                  className="h-16 w-auto max-w-[120px] object-contain"
                />
              ) : (
                <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-stone-200 bg-stone-50 text-xs text-stone-400">
                  No logo
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  Upload
                </button>
                {branding.logoDataUrl && (
                  <button
                    onClick={() =>
                      updateProject(projectId, {
                        branding: { ...branding, logoDataUrl: null },
                      })
                    }
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">
              Cover page text
            </label>
            <textarea
              value={branding.coverPageText}
              onChange={(e) =>
                updateProject(projectId, {
                  branding: { ...branding, coverPageText: e.target.value },
                })
              }
              placeholder="Optional subtitle or academic year note for the cover page"
              rows={3}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">
              Accent color
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {DEFAULT_ACCENT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() =>
                    updateProject(projectId, {
                      branding: { ...branding, accentColor: color },
                    })
                  }
                  className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition ${
                    branding.accentColor === color
                      ? "ring-stone-400"
                      : "ring-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
              <input
                type="color"
                value={branding.accentColor}
                onChange={(e) =>
                  updateProject(projectId, {
                    branding: { ...branding, accentColor: e.target.value },
                  })
                }
                className="h-8 w-8 cursor-pointer rounded border border-stone-200"
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Template
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {TEMPLATE_LIST.map((template) => (
            <button
              key={template.id}
              onClick={() =>
                updateProject(projectId, { templateId: template.id as TemplateId })
              }
              className={`rounded-xl border p-4 text-left transition ${
                project.templateId === template.id
                  ? "border-stone-800 bg-stone-50 ring-1 ring-stone-800"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <p className="font-semibold text-stone-900">{template.name}</p>
              <p className="mt-1 text-xs text-stone-500">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

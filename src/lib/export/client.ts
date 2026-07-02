"use client";

import { useCallback } from "react";
import type { Project } from "@/lib/types";

export async function downloadExport(
  project: Project,
  format: "pdf" | "docx"
): Promise<void> {
  const response = await fetch(`/api/export/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.name.replace(/[^a-z0-9]/gi, "_")}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function useExport() {
  const exportProject = useCallback(
    async (project: Project, format: "pdf" | "docx") => {
      await downloadExport(project, format);
    },
    []
  );

  return { exportProject };
}

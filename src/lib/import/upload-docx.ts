import type { DocxImportResult, ImportDraft } from "./import-draft-types";
import type { ImportProgressEvent, ImportStreamLine } from "./import-progress";
import { isCompleteLine, isErrorLine } from "./import-progress";

export type DocxAutoImportResult = DocxImportResult & { draft: ImportDraft };

export async function uploadDocxForAutoImport(
  file: File,
  onProgress?: (event: ImportProgressEvent) => void
): Promise<DocxAutoImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", "auto");

  const response = await fetch("/api/import/docx", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? `Import failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as ImportStreamLine;
      if (isErrorLine(parsed)) throw new Error(parsed.error);
      if (isCompleteLine(parsed)) {
        if (!parsed.result.draft) {
          throw new Error("Import did not return section predictions");
        }
        return parsed.result as DocxAutoImportResult;
      }
      if (!("type" in parsed)) onProgress?.(parsed);
    }
  }

  throw new Error("Import ended without a result");
}

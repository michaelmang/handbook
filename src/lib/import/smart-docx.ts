import type { DocxImportResult } from "./import-draft-types";
import type { ImportProgressReporter } from "./import-progress";
import { buildImportDraft } from "./build-import-draft";

/** Smart DOCX import → reviewable ImportDraft (paragraphs + boundaries + audit). */
export async function parseDocxSmart(
  buffer: Buffer,
  onProgress: ImportProgressReporter = () => {},
  useSmart = true
): Promise<DocxImportResult> {
  return buildImportDraft(buffer, onProgress, useSmart);
}

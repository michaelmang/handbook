import type { ImportDraft } from "./import-draft-types";
import type { ImportProgressReporter } from "./import-progress";
import { noopProgress } from "./import-progress";
import { extractDocxParagraphs } from "./docx-xml";
import { buildFeatureList } from "./paragraph-features";
import { detectTocRange } from "./toc-detection";
import { collectDeterministicCandidates } from "./boundary-candidates";
import { applyPredictedBoundaries } from "./predict-initial-boundaries";
import { draftFromCandidates } from "./import-draft-fixes";
import type { DocxImportResult } from "./import-draft-types";
import { sectionsToMarkdownBlocks } from "./import-draft-builder";
import { formatSectionMarkdown } from "./format-import-markdown";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function buildImportDraft(
  buffer: Buffer,
  onProgress: ImportProgressReporter = noopProgress,
  _useSmart = false
): Promise<DocxImportResult> {
  const warnings: string[] = [];
  const changelog: string[] = [];

  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("File exceeds 10MB limit");
  }

  onProgress({
    phase: "read",
    status: "complete",
    message: "Document loaded",
    detail: `${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`,
  });

  onProgress({
    phase: "extract",
    status: "start",
    message: "Loading document",
  });

  const paragraphs = await extractDocxParagraphs(buffer);
  if (paragraphs.length === 0) {
    throw new Error("No paragraphs found in document");
  }

  onProgress({
    phase: "extract",
    status: "complete",
    message: "Document loaded",
    detail: `${paragraphs.length} paragraphs`,
  });

  onProgress({
    phase: "features",
    status: "start",
    message: "Preparing preview",
  });
  const features = buildFeatureList(paragraphs);
  onProgress({
    phase: "features",
    status: "complete",
    message: "Preview ready",
  });

  const tocRange = detectTocRange(features, paragraphs);
  if (tocRange) {
    warnings.push(
      `Detected table of contents (paragraphs ${tocRange.start + 1}–${tocRange.end + 1}).`
    );
    changelog.push(
      `TOC range ¶${tocRange.start}–${tocRange.end} excluded from sections`
    );
  }

  onProgress({
    phase: "pass_a",
    status: "start",
    message: "Predicting section boundaries",
  });

  const rawCandidates = collectDeterministicCandidates(features, tocRange);
  const { candidates, boundaries } = applyPredictedBoundaries(
    rawCandidates,
    tocRange
  );

  changelog.push(
    `${boundaries.length} initial sections predicted (${rawCandidates.length} candidates)`
  );

  onProgress({
    phase: "pass_a",
    status: "complete",
    message: "Section boundaries predicted",
    detail: `${boundaries.length} sections detected`,
  });

  onProgress({ phase: "build", status: "start", message: "Building preview" });

  let draft = draftFromCandidates(
    candidates,
    paragraphs,
    features,
    tocRange,
    warnings,
    changelog,
    "heuristic"
  );

  onProgress({
    phase: "build",
    status: "complete",
    message: "Preview ready",
    detail: `${draft.sections.length} sections`,
  });

  let blocks = sectionsToMarkdownBlocks(
    draft.sections.filter((s) => s.carryOver)
  ).map((b) => ({
    ...b,
    content: formatSectionMarkdown(b.content),
  }));
  let importMode: "heuristic" | "smart" = "heuristic";

  if (
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_SKIP_MARKDOWN_REFINE !== "true"
  ) {
    onProgress({
      phase: "pass_b",
      status: "start",
      message: "Structuring section content with AI",
    });

    const { refineMarkdownSectionsWithLlm, sectionDraftsFromBlocks } =
      await import("./llm-refine-section-markdown");
    const refined = await refineMarkdownSectionsWithLlm(blocks, onProgress);
    blocks = refined.blocks;

    if (refined.refinedSectionCount > 0) {
      importMode = "smart";
    }

    draft = {
      ...draft,
      sections: sectionDraftsFromBlocks(blocks),
      warnings: [...draft.warnings, ...refined.warnings],
      changelog: [
        ...draft.changelog,
        ...refined.changelog,
        ...(refined.refinedSectionCount > 0
          ? [
              `AI expanded ${refined.refinedSectionCount} top-level part(s) into subsections`,
            ]
          : []),
      ],
      importMode,
    };

    onProgress({
      phase: "build",
      status: "complete",
      message: "Sections ready",
      detail: `${blocks.length} sections after AI structuring`,
    });
  }

  onProgress({
    phase: "done",
    status: "complete",
    message: "Define sections and import",
  });

  return {
    blocks,
    warnings: draft.warnings,
    importMode,
    flat: true,
    draft,
  };
}

import { nanoid } from "nanoid";
import type { DocxParagraphRaw } from "./docx-xml";
import type { ParagraphFeatures } from "./paragraph-features";
import type {
  BoundaryCandidate,
  ImportParagraph,
  SectionDraft,
} from "./import-draft-types";
import { isLikelyTocLine, isTocCompositeLine } from "./boundary-rules";
import { stripNumberingPrefix } from "./numbering";
import { isInTocRange, type TocRange } from "./toc-detection";
import {
  boundarySpecsFromCandidates,
  nextBoundaryIndex,
} from "./boundary-scoring";

export interface BoundarySpec {
  index: number;
  relativeDepth: number;
}

export function toImportParagraphs(
  paragraphs: DocxParagraphRaw[],
  features: ParagraphFeatures[],
  boundaries: number[],
  tocRange: TocRange | null
): ImportParagraph[] {
  const boundarySet = new Set(boundaries);
  const byIndex = new Map(features.map((f) => [f.index, f]));

  return paragraphs.map((p) => {
    const f = byIndex.get(p.index);
    const text = p.text;
    return {
      index: p.index,
      text,
      markdown: p.markdown || text,
      preview:
        text.length > 120 ? `${text.slice(0, 117)}…` : text,
      wordCount: f?.wordCount ?? text.split(/\s+/).filter(Boolean).length,
      bold: f?.bold ?? false,
      listLevel: f?.listLevel ?? null,
      fontSizeRatio: f?.fontSizeRatio ?? 1,
      inToc: isInTocRange(p.index, tocRange) || p.inTocField,
      isBoundary: boundarySet.has(p.index),
    };
  });
}

export function buildSectionDrafts(
  paragraphs: DocxParagraphRaw[],
  boundaries: number[],
  tocRange: TocRange | null,
  candidates: BoundaryCandidate[] = []
): SectionDraft[] {
  const specs = boundarySpecsFromCandidates(candidates, boundaries);
  if (specs.length === 0 && boundaries.length > 0) {
    return buildSectionDraftsFlat(paragraphs, boundaries, tocRange);
  }

  const boundarySet = new Set(boundaries);
  const byIndex = new Map(paragraphs.map((p) => [p.index, p]));
  const sections: SectionDraft[] = [];

  for (const spec of specs) {
    const index = spec.index;
    const para = byIndex.get(index);
    if (!para) continue;

    const numbering = stripNumberingPrefix(para.text);
    const nextIndex = nextBoundaryIndex(
      index,
      spec.relativeDepth,
      specs
    );
    const bodyParts: string[] = [];

    for (const p of paragraphs) {
      if (p.index <= index) continue;
      if (p.index >= nextIndex) break;
      if (boundarySet.has(p.index) && p.index !== index) continue;
      if (isInTocRange(p.index, tocRange)) continue;
      const line = (p.markdown || p.text).trim();
      if (!line) continue;
      if (isLikelyTocLine(line) || isTocCompositeLine(line)) continue;
      bodyParts.push(line);
    }

    const content = bodyParts.join("\n\n").trim();
    sections.push({
      id: nanoid(10),
      boundaryIndex: index,
      title: numbering.cleanTitle || para.text.slice(0, 80),
      content,
      charCount: content.length,
      relativeDepth: spec.relativeDepth,
      issueIds: [],
      carryOver: true,
    });
  }

  return sections;
}

function buildSectionDraftsFlat(
  paragraphs: DocxParagraphRaw[],
  boundaries: number[],
  tocRange: TocRange | null
): SectionDraft[] {
  const sorted = [...boundaries].sort((a, b) => a - b);
  const boundarySet = new Set(sorted);
  const byIndex = new Map(paragraphs.map((p) => [p.index, p]));
  const sections: SectionDraft[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const index = sorted[i];
    const para = byIndex.get(index);
    if (!para) continue;

    const numbering = stripNumberingPrefix(para.text);
    const nextIndex = sorted[i + 1] ?? Number.MAX_SAFE_INTEGER;
    const bodyParts: string[] = [];

    for (const p of paragraphs) {
      if (p.index <= index) continue;
      if (p.index >= nextIndex) break;
      if (boundarySet.has(p.index)) continue;
      if (isInTocRange(p.index, tocRange)) continue;
      const line = (p.markdown || p.text).trim();
      if (!line) continue;
      if (isLikelyTocLine(line) || isTocCompositeLine(line)) continue;
      bodyParts.push(line);
    }

    const content = bodyParts.join("\n\n").trim();
    sections.push({
      id: nanoid(10),
      boundaryIndex: index,
      title: numbering.cleanTitle || para.text.slice(0, 80),
      content,
      charCount: content.length,
      relativeDepth: 0,
      issueIds: [],
      carryOver: true,
    });
  }

  return sections;
}

export function sectionsToMarkdownBlocks(
  sections: SectionDraft[]
): { relativeDepth: number; title: string; content: string }[] {
  return sections.map((s) => ({
    relativeDepth: s.relativeDepth,
    title: s.title,
    content: s.content,
  }));
}

export function syncCandidatesSelection(
  candidates: BoundaryCandidate[],
  boundaries: number[]
): BoundaryCandidate[] {
  const set = new Set(boundaries);
  return candidates.map((c) => ({
    ...c,
    selected: set.has(c.index),
  }));
}

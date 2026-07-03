import type { ParagraphFeatures } from "./paragraph-features";
import type { BoundaryCandidate } from "./import-draft-types";
import { collectDeterministicCandidates } from "./boundary-candidates";
import { detectTocRange, isInTocRange } from "./toc-detection";
import { stripNumberingPrefix } from "./numbering";
import { isLikelyTocLine, isTocCompositeLine } from "./boundary-rules";
import {
  getParagraphDisplayText,
  inferPreviewListLevel,
} from "./preview-paragraph-dom";

export interface PreviewSection {
  id: string;
  /** Clean title for import (numbering stripped when confident). */
  title: string;
  /** Chip / scroll label including visible list prefix. */
  label: string;
  boundaryIndex: number;
  /** 0 = chapter, 1 = section, 2+ = subsection. */
  level: number;
  confidence: "high" | "medium" | "low";
  paragraphs: HTMLElement[];
}

interface PreviewBoundary {
  index: number;
  level: number;
  confidence: PreviewSection["confidence"];
}

const SECTION_COLORS = [
  "#64748b",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#06b6d4",
  "#f97316",
];

/** Block-level paragraphs from a docx-preview render tree. */
export function getPreviewParagraphs(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll("section.docx p, article p");
  const result: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement) || seen.has(node)) return;
    const text = getParagraphDisplayText(node);
    if (!text) return;
    seen.add(node);
    result.push(node);
  });

  if (result.length > 0) return result;

  root.querySelectorAll("p").forEach((node) => {
    if (!(node instanceof HTMLElement) || seen.has(node)) return;
    const text = getParagraphDisplayText(node);
    if (!text) return;
    seen.add(node);
    result.push(node);
  });

  return result;
}

function isBoldElement(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const weight = style.fontWeight;
  if (weight === "bold" || parseInt(weight, 10) >= 600) return true;
  if (el.querySelector("strong, b")) return true;

  const childSpans = el.querySelectorAll("span");
  for (const span of childSpans) {
    const sw = window.getComputedStyle(span).fontWeight;
    if (sw === "bold" || parseInt(sw, 10) >= 600) return true;
  }
  return false;
}

export function computeBodyFontSize(paragraphs: HTMLElement[]): number {
  const sizes: number[] = [];
  for (const el of paragraphs) {
    const words = getParagraphDisplayText(el).split(/\s+/).filter(Boolean).length;
    if (words < 6) continue;
    const fs = parseFloat(window.getComputedStyle(el).fontSize);
    if (fs > 0) sizes.push(fs);
  }
  if (sizes.length === 0) return 16;
  sizes.sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)];
}

export function domToParagraphFeatures(
  el: HTMLElement,
  index: number,
  bodyFontSize: number
): ParagraphFeatures {
  const text = getParagraphDisplayText(el);
  const words = text.split(/\s+/).filter(Boolean);
  const fontSize = parseFloat(window.getComputedStyle(el).fontSize) || bodyFontSize;
  const bold = isBoldElement(el);
  const listLevel = inferPreviewListLevel(el);

  return {
    index,
    text,
    wordCount: words.length,
    charCount: text.length,
    endsWithPeriod: text.endsWith("."),
    fontSizeRatio: fontSize / bodyFontSize,
    bold,
    allCaps:
      text.length > 0 &&
      text === text.toUpperCase() &&
      /[A-Z]/.test(text) &&
      words.length <= 10,
    indentLevel: 0,
    listLevel,
    outlineLevel: listLevel,
    spaceBeforeRatio: 1,
    styleHint: null,
  };
}

/** All structural boundaries for preview guides, including subsections. */
export function predictPreviewBoundaries(
  candidates: BoundaryCandidate[],
  features: ParagraphFeatures[],
  tocRange: { start: number; end: number } | null
): PreviewBoundary[] {
  const eligible = candidates.filter((c) => {
    if (isInTocRange(c.index, tocRange)) return false;
    if (c.confidence === "high") return true;
    if (c.confidence === "medium") {
      return (
        c.source === "numbered" ||
        c.reason === "outline list item" ||
        c.reason === "all-caps heading"
      );
    }
    return false;
  });

  return eligible
    .map((c) => ({
      index: c.index,
      level: inferBoundaryLevel(features[c.index]),
      confidence: c.confidence,
    }))
    .sort((a, b) => a.index - b.index);
}

export function inferBoundaryLevel(
  feature: ParagraphFeatures | undefined
): number {
  if (!feature) return 0;

  const numbering = stripNumberingPrefix(feature.text);
  if (numbering.depthHint !== null && numbering.confidence !== "none") {
    return numbering.depthHint;
  }

  if (feature.listLevel != null && feature.wordCount <= 12) {
    return feature.listLevel;
  }

  if (feature.fontSizeRatio >= 1.12 && feature.wordCount <= 10) return 0;
  if (feature.bold && feature.wordCount <= 8) return 1;
  return 0;
}

function sectionEndIndex(
  startIndex: number,
  level: number,
  boundaries: PreviewBoundary[],
  total: number
): number {
  for (const boundary of boundaries) {
    if (boundary.index <= startIndex) continue;
    if (boundary.level <= level) return boundary.index;
  }
  return total;
}

export function detectPreviewSections(root: HTMLElement): PreviewSection[] {
  const paragraphEls = getPreviewParagraphs(root);
  if (paragraphEls.length === 0) return [];

  const bodyFontSize = computeBodyFontSize(paragraphEls);
  const features = paragraphEls.map((el, index) =>
    domToParagraphFeatures(el, index, bodyFontSize)
  );

  const tocRange = detectTocRange(features);
  const candidates = collectDeterministicCandidates(features, tocRange);
  const boundaries = predictPreviewBoundaries(candidates, features, tocRange);

  if (boundaries.length === 0) {
    return [buildPreviewSection(paragraphEls, features, 0, boundaries, tocRange)];
  }

  return boundaries.map((boundary) =>
    buildPreviewSection(
      paragraphEls,
      features,
      boundary.index,
      boundaries,
      tocRange,
      boundary
    )
  );
}

function buildPreviewSection(
  paragraphEls: HTMLElement[],
  features: ParagraphFeatures[],
  boundaryIndex: number,
  boundaries: PreviewBoundary[],
  tocRange: { start: number; end: number } | null,
  boundaryMeta?: PreviewBoundary
): PreviewSection {
  const level = boundaryMeta?.level ?? inferBoundaryLevel(features[boundaryIndex]);
  const next = sectionEndIndex(
    boundaryIndex,
    level,
    boundaries,
    paragraphEls.length
  );

  const paragraphs: HTMLElement[] = [];
  for (let i = boundaryIndex; i < next; i++) {
    if (isInTocRange(i, tocRange) && i !== boundaryIndex) continue;
    const f = features[i];
    if (!f) continue;
    const line = f.text.trim();
    if (
      i !== boundaryIndex &&
      (isLikelyTocLine(line) || isTocCompositeLine(line))
    ) {
      continue;
    }
    paragraphs.push(paragraphEls[i]);
  }

  const titleFeature = features[boundaryIndex];
  const labelText = titleFeature?.text ?? "Section";
  const numbering = stripNumberingPrefix(labelText);

  return {
    id: `section-${boundaryIndex}`,
    title: numbering.cleanTitle || labelText.slice(0, 80),
    label: labelText.slice(0, 120),
    boundaryIndex,
    level,
    confidence: boundaryMeta?.confidence ?? "medium",
    paragraphs,
  };
}

/** Map each paragraph to the innermost containing section (for nested highlights). */
export function assignParagraphOwners(
  paragraphEls: HTMLElement[],
  sections: PreviewSection[]
): Map<HTMLElement, PreviewSection> {
  const owners = new Map<HTMLElement, PreviewSection>();

  for (let i = 0; i < paragraphEls.length; i++) {
    const containing = sections.filter((s) => {
      const start = s.boundaryIndex;
      const end =
        sectionEndIndex(
          s.boundaryIndex,
          s.level,
          sections.map((x) => ({
            index: x.boundaryIndex,
            level: x.level,
            confidence: x.confidence,
          })),
          paragraphEls.length
        );
      return i >= start && i < end;
    });

    if (containing.length === 0) continue;
    const deepest = containing.reduce((a, b) => (a.level >= b.level ? a : b));
    owners.set(paragraphEls[i], deepest);
  }

  return owners;
}

export function clearSectionHighlights(root: HTMLElement): void {
  root.querySelectorAll("[data-section-highlight]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.classList.remove("docx-section-highlight", "docx-section-boundary");
    el.removeAttribute("data-section-highlight");
    el.removeAttribute("data-section-id");
    el.removeAttribute("data-section-boundary");
    el.style.removeProperty("--section-accent");
    el.style.removeProperty("--section-level");
  });
}

export function applySectionHighlights(
  root: HTMLElement,
  sections: PreviewSection[]
): void {
  clearSectionHighlights(root);

  const paragraphEls = getPreviewParagraphs(root);
  const owners = assignParagraphOwners(paragraphEls, sections);

  sections.forEach((section, i) => {
    const color = SECTION_COLORS[i % SECTION_COLORS.length];
    for (const el of section.paragraphs) {
      const owner = owners.get(el) ?? section;
      const isBoundary = el === section.paragraphs[0];
      const ownerIndex = sections.indexOf(owner);
      const accent =
        ownerIndex >= 0
          ? SECTION_COLORS[ownerIndex % SECTION_COLORS.length]
          : color;

      el.classList.add("docx-section-highlight");
      el.setAttribute("data-section-highlight", "true");
      el.setAttribute("data-section-id", section.id);
      el.style.setProperty("--section-accent", accent);
      el.style.setProperty("--section-level", String(section.level));

      if (isBoundary) {
        el.classList.add("docx-section-boundary");
        el.setAttribute("data-section-boundary", "true");
      }
    }
  });
}

export function scrollToPreviewSection(
  root: HTMLElement,
  sectionId: string
): void {
  root
    .querySelector(`[data-section-boundary="true"][data-section-id="${sectionId}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

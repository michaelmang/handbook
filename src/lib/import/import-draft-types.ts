import type { MarkdownBlock } from "@/lib/markdown-split";

export type BoundarySource =
  | "numbered"
  | "typography"
  | "llm"
  | "user"
  | "heuristic";

export type AuditIssueKind =
  | "empty_section"
  | "huge_section"
  | "thin_section"
  | "prose_as_title"
  | "duplicate_title"
  | "back_to_back"
  | "suggested_split"
  | "suggested_boundary"
  | "toc_boundary"
  | "numbering_artifact";

export type AuditFixType =
  | "merge_sections"
  | "remove_boundary"
  | "add_boundary"
  | "split_at_paragraphs";

export interface ImportParagraph {
  index: number;
  text: string;
  /** Markdown from DOCX extractor (bold etc.) */
  markdown: string;
  preview: string;
  wordCount: number;
  bold: boolean;
  listLevel: number | null;
  fontSizeRatio: number;
  inToc: boolean;
  isBoundary: boolean;
}

export interface BoundaryCandidate {
  index: number;
  source: BoundarySource;
  confidence: "high" | "medium" | "low";
  reason: string;
  selected: boolean;
  /** Weighted boundary score (document-relative). */
  score?: number;
  /** Nesting depth inferred from typography / numbering. */
  relativeDepth?: number;
}

export interface SectionDraft {
  id: string;
  boundaryIndex: number;
  title: string;
  content: string;
  charCount: number;
  relativeDepth: number;
  issueIds: string[];
  /** Whether this section is included when committing import. */
  carryOver: boolean;
}

export interface AuditFix {
  type: AuditFixType;
  sectionIds?: string[];
  sectionId?: string;
  paragraphIndex?: number;
  paragraphIndices?: number[];
}

export interface AuditIssue {
  id: string;
  kind: AuditIssueKind;
  severity: "safe" | "review";
  message: string;
  paragraphIndex?: number;
  sectionId?: string;
  fix?: AuditFix;
}

export interface ImportDraft {
  paragraphs: ImportParagraph[];
  boundaries: number[];
  candidates: BoundaryCandidate[];
  sections: SectionDraft[];
  issues: AuditIssue[];
  tocRange: { start: number; end: number } | null;
  warnings: string[];
  changelog: string[];
  importMode: "smart" | "heuristic";
}

export interface DocxImportResult {
  blocks: MarkdownBlock[];
  warnings: string[];
  importMode?: "heuristic" | "smart";
  flat?: boolean;
  /** Present for DOCX import API responses (review before commit). */
  draft?: ImportDraft;
  /** Visual import: mammoth-rendered HTML for faithful document display. */
  visual?: boolean;
  html?: string;
}

import type { MarkdownBlock } from "@/lib/markdown-split";

export type {
  ImportDraft,
  ImportParagraph,
  SectionDraft,
  AuditIssue,
  AuditFix,
  BoundaryCandidate,
  DocxImportResult,
} from "./import-draft-types";

export interface ParsedSectionBoundary {
  title: string;
  html: string;
  headingLevel: number;
  confidence: "high" | "medium" | "low";
  source: "heading-style" | "outline-number" | "bold-short" | "all-caps";
}

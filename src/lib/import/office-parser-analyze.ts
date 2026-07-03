import type { OfficeContentNode, OfficeParserAST } from "officeparser";
import { looksLikeOutlineTitle } from "./numbering";
import { isLikelyTocLine } from "./boundary-rules";

export interface OfficeAstStats {
  topLevelNodes: number;
  nodeTypes: Record<string, number>;
  listItems: number;
  orderedListItems: number;
  headings: number;
  paragraphs: number;
  tables: number;
  maxListIndentation: number;
}

export interface OfficeSectionProposal {
  index: number;
  title: string;
  level: number;
  source: "heading" | "list" | "paragraph";
  listType?: "ordered" | "unordered";
  wordCount: number;
  preview: string;
}

export type ImportModeRecommendation = "auto" | "guided" | "manual";

export interface OfficeImportAssessment {
  stats: OfficeAstStats;
  sections: OfficeSectionProposal[];
  tocLikely: boolean;
  duplicateTitles: string[];
  recommendation: ImportModeRecommendation;
  recommendationReasons: string[];
}

function nodeText(node: OfficeContentNode): string {
  return (node.text ?? "").replace(/\s+/g, " ").trim();
}

function nodeIsBold(node: OfficeContentNode): boolean {
  if (node.formatting?.bold) return true;
  for (const child of node.children ?? []) {
    if (nodeIsBold(child)) return true;
  }
  return false;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function walkNodes(
  nodes: OfficeContentNode[],
  visitor: (node: OfficeContentNode, depth: number) => void,
  depth = 0
): void {
  for (const node of nodes) {
    visitor(node, depth);
    if (node.children?.length) {
      walkNodes(node.children, visitor, depth + 1);
    }
  }
}

export function analyzeOfficeAst(ast: OfficeParserAST): OfficeAstStats {
  const nodeTypes: Record<string, number> = {};
  let listItems = 0;
  let orderedListItems = 0;
  let headings = 0;
  let paragraphs = 0;
  let tables = 0;
  let maxListIndentation = 0;

  walkNodes(ast.content, (node) => {
    nodeTypes[node.type] = (nodeTypes[node.type] ?? 0) + 1;
    if (node.type === "list") {
      listItems++;
      const meta = node.metadata as { listType?: string; indentation?: number };
      if (meta?.listType === "ordered") orderedListItems++;
      if (typeof meta?.indentation === "number") {
        maxListIndentation = Math.max(maxListIndentation, meta.indentation);
      }
    }
    if (node.type === "heading") headings++;
    if (node.type === "paragraph") paragraphs++;
    if (node.type === "table") tables++;
  });

  return {
    topLevelNodes: ast.content.length,
    nodeTypes,
    listItems,
    orderedListItems,
    headings,
    paragraphs,
    tables,
    maxListIndentation,
  };
}

function isListSectionBoundary(node: OfficeContentNode): boolean {
  if (node.type !== "list") return false;
  const meta = node.metadata as {
    listType?: string;
    indentation?: number;
  };
  if (meta?.listType !== "ordered") return false;

  const text = nodeText(node);
  const words = countWords(text);
  if (!text || words > 14) return false;
  if (isLikelyTocLine(text)) return false;

  const indent = meta.indentation ?? 0;
  if (indent === 0) {
    return nodeIsBold(node) || looksLikeOutlineTitle(text) || words <= 8;
  }

  return (
    looksLikeOutlineTitle(text) ||
    (nodeIsBold(node) && words <= 10) ||
    /^\d+(?:\.\d+)+/.test(text)
  );
}

function isParagraphSectionBoundary(node: OfficeContentNode): boolean {
  if (node.type !== "paragraph") return false;
  const text = nodeText(node);
  if (!text || text.length > 120) return false;
  if (isLikelyTocLine(text)) return false;
  return (
    looksLikeOutlineTitle(text) ||
    (nodeIsBold(node) && countWords(text) <= 10 && !text.endsWith("."))
  );
}

export function proposeOfficeSections(
  ast: OfficeParserAST
): OfficeSectionProposal[] {
  const proposals: OfficeSectionProposal[] = [];

  ast.content.forEach((node, index) => {
    if (node.type === "heading") {
      const level =
        (node.metadata as { level?: number } | undefined)?.level ?? 1;
      const title = nodeText(node);
      if (!title) return;
      proposals.push({
        index,
        title,
        level: Math.max(0, level - 1),
        source: "heading",
        wordCount: countWords(title),
        preview: title,
      });
      return;
    }

    if (isListSectionBoundary(node)) {
      const meta = node.metadata as {
        listType?: "ordered" | "unordered";
        indentation?: number;
      };
      const title = nodeText(node);
      proposals.push({
        index,
        title,
        level: meta?.indentation ?? 0,
        source: "list",
        listType: meta?.listType,
        wordCount: countWords(title),
        preview: title.slice(0, 100),
      });
      return;
    }

    if (isParagraphSectionBoundary(node)) {
      const title = nodeText(node);
      proposals.push({
        index,
        title,
        level: 0,
        source: "paragraph",
        wordCount: countWords(title),
        preview: title.slice(0, 100),
      });
    }
  });

  return proposals;
}

export function assessOfficeImport(
  ast: OfficeParserAST,
  markdown: string
): OfficeImportAssessment {
  const stats = analyzeOfficeAst(ast);
  const sections = proposeOfficeSections(ast);

  const titleCounts = new Map<string, number>();
  for (const s of sections) {
    const key = s.title.toLowerCase();
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }
  const duplicateTitles = [...titleCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([t]) => t);

  const tocLines = markdown
    .split("\n")
    .filter((l) => /table of contents/i.test(l)).length;
  const tocLikely =
    tocLines > 0 ||
    (sections.length > 20 &&
      sections.filter((s) => s.level === 0).length > 15 &&
      stats.listItems > stats.paragraphs);

  const reasons: string[] = [];
  let recommendation: ImportModeRecommendation = "guided";

  if (sections.length === 0) {
    recommendation = "manual";
    reasons.push("No section boundaries detected — import as one blob or select manually.");
  } else if (sections.length === 1) {
    recommendation = "manual";
    reasons.push("Only one section detected.");
  } else if (
    sections.length <= 25 &&
    duplicateTitles.length === 0 &&
    !tocLikely &&
    stats.headings >= 2
  ) {
    recommendation = "auto";
    reasons.push("Heading-based document with a modest section count.");
  } else if (
    stats.listItems > stats.headings * 3 &&
    stats.orderedListItems > 20
  ) {
    recommendation = "guided";
    reasons.push(
      "List-heavy handbook (outline numbering) — review sections before import."
    );
  }

  if (duplicateTitles.length > 0) {
    recommendation = recommendation === "auto" ? "guided" : recommendation;
    reasons.push(
      `${duplicateTitles.length} duplicate section title(s) (likely TOC + body).`
    );
  }

  if (tocLikely) {
    recommendation = "guided";
    reasons.push("Table of contents detected — merge/review recommended.");
  }

  if (sections.length > 40) {
    recommendation = "guided";
    reasons.push(`${sections.length} proposed sections — review in merge UI.`);
  }

  if (stats.tables > 5) {
    reasons.push(`${stats.tables} tables — verify markdown tables in preview.`);
  }

  return {
    stats,
    sections,
    tocLikely,
    duplicateTitles,
    recommendation,
    recommendationReasons: reasons,
  };
}

/** Slice top-level AST nodes for one proposed section (until next peer boundary). */
export function sliceOfficeSectionNodes(
  ast: OfficeParserAST,
  section: OfficeSectionProposal,
  allSections: OfficeSectionProposal[]
): OfficeContentNode[] {
  const sameOrHigher = allSections
    .filter((s) => s.index > section.index && s.level <= section.level)
    .sort((a, b) => a.index - b.index)[0];

  const end = sameOrHigher?.index ?? ast.content.length;
  return ast.content.slice(section.index, end);
}

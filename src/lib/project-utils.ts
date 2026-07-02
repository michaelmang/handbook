import { nanoid } from "nanoid";
import type { Project, Section } from "./types";
import { extractTitleFromMarkdown } from "./markdown";
import type { MarkdownBlock } from "./markdown-split";
import {
  flattenSections,
  migrateProject,
  type FlatSectionItem,
} from "./section-tree";

export type { FlatSectionItem };

export function createEmptyProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    name,
    templateId: "classic",
    branding: {
      schoolName: "",
      logoDataUrl: null,
      accentColor: "#1e3a5f",
      coverPageText: "",
    },
    sections: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateProject(project: Project, newName?: string): Project {
  const now = new Date().toISOString();
  const idMap = new Map<string, string>();

  const sections = project.sections.map((section) => {
    const newId = nanoid();
    idMap.set(section.id, newId);
    return { ...section, id: newId };
  });

  const remappedSections = sections.map((section) => ({
    ...section,
    parentId: section.parentId ? idMap.get(section.parentId) ?? null : null,
  }));

  return {
    ...project,
    id: nanoid(),
    name: newName ?? `${project.name} (Copy)`,
    sections: remappedSections,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSectionFromMarkdown(
  markdown: string,
  parentId: string | null = null,
  orderIndex = 0
): Section {
  return {
    id: nanoid(),
    parentId,
    title: extractTitleFromMarkdown(markdown),
    markdownContent: markdown.trim(),
    orderIndex,
    included: true,
  };
}

/** Build a section subtree from parsed Markdown heading blocks */
export function sectionsFromMarkdownBlocks(
  blocks: MarkdownBlock[],
  importParentId: string | null,
  startOrderIndex: number
): Section[] {
  if (blocks.length === 0) return [];

  const sections: Section[] = [];
  const parentStack: (string | null)[] = [];
  const orderCounters = new Map<string | null, number>();

  orderCounters.set(importParentId, startOrderIndex);

  for (const block of blocks) {
    const parentId =
      block.relativeDepth === 0
        ? importParentId
        : (parentStack[block.relativeDepth - 1] ?? importParentId);

    const orderIndex = orderCounters.get(parentId) ?? 0;
    orderCounters.set(parentId, orderIndex + 1);

    const section: Section = {
      id: nanoid(),
      parentId,
      title: block.title,
      markdownContent: block.content,
      orderIndex,
      included: true,
    };

    sections.push(section);
    parentStack[block.relativeDepth] = section.id;
    parentStack.length = block.relativeDepth + 1;
  }

  return sections;
}

export function createContainerSection(
  title: string,
  parentId: string | null = null,
  orderIndex = 0
): Section {
  return {
    id: nanoid(),
    parentId,
    title,
    markdownContent: "",
    orderIndex,
    included: true,
  };
}

export function getNextOrderIndex(
  sections: Section[],
  parentId: string | null
): number {
  const siblings = sections.filter((s) => s.parentId === parentId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((s) => s.orderIndex)) + 1;
}

export function organizeProject(
  project: Project,
  options: { includedOnly?: boolean } = {}
): FlatSectionItem[] {
  const migrated = migrateProject(project);
  return flattenSections(migrated.sections, options);
}

export { migrateProject };

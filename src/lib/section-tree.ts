import type { Project, Section } from "./types";

/** @deprecated Legacy chapter type — migrated into container sections */
export interface LegacyChapter {
  id: string;
  title: string;
  orderIndex: number;
}

/** @deprecated Legacy section shape */
export interface LegacySection extends Omit<Section, "parentId"> {
  chapterId?: string | null;
  parentId?: string | null;
}

export interface LegacyProject extends Omit<Project, "sections"> {
  chapters?: LegacyChapter[];
  sections: LegacySection[];
}

export interface FlatSectionItem {
  section: Section;
  depth: number;
  number: string;
}

export function isContainerSection(section: Section): boolean {
  return section.markdownContent.trim() === "";
}

export function migrateProject(project: LegacyProject | Project): Project {
  const legacy = project as LegacyProject;

  if (!legacy.chapters?.length) {
    return {
      id: project.id,
      name: project.name,
      templateId: project.templateId,
      branding: project.branding,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      sections: project.sections.map((s) => ({
        ...s,
        parentId: s.parentId ?? (s as LegacySection).chapterId ?? null,
      })),
    };
  }

  const sections: Section[] = [];
  const chapterToSection = new Map<string, string>();

  for (const chapter of [...legacy.chapters].sort(
    (a, b) => a.orderIndex - b.orderIndex
  )) {
    const containerId = chapter.id;
    chapterToSection.set(chapter.id, containerId);
    sections.push({
      id: containerId,
      parentId: null,
      title: chapter.title,
      markdownContent: "",
      orderIndex: chapter.orderIndex,
      included: true,
    });
  }

  const ungrouped = legacy.sections
    .filter((s) => !s.chapterId && !s.parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  let rootOrder = legacy.chapters.length;
  for (const section of ungrouped) {
    sections.push({
      id: section.id,
      parentId: null,
      title: section.title,
      markdownContent: section.markdownContent,
      orderIndex: rootOrder++,
      included: section.included,
    });
  }

  for (const chapter of legacy.chapters) {
    const parentId = chapterToSection.get(chapter.id)!;
    const chapterSections = legacy.sections
      .filter((s) => s.chapterId === chapter.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    chapterSections.forEach((section, idx) => {
      sections.push({
        id: section.id,
        parentId,
        title: section.title,
        markdownContent: section.markdownContent,
        orderIndex: idx,
        included: section.included,
      });
    });
  }

  return {
    id: project.id,
    name: project.name,
    templateId: project.templateId,
    branding: project.branding,
    sections,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function getChildSections(
  sections: Section[],
  parentId: string | null
): Section[] {
  return sections
    .filter((s) => s.parentId === parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function getSectionDepth(
  section: Section,
  sections: Section[]
): number {
  let depth = 0;
  let current: string | null = section.parentId;
  const seen = new Set<string>();

  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    depth++;
    const parent = sections.find((s) => s.id === current);
    current = parent?.parentId ?? null;
  }

  return depth;
}

export function flattenSections(
  sections: Section[],
  options: { includedOnly?: boolean } = {}
): FlatSectionItem[] {
  const { includedOnly = false } = options;
  const result: FlatSectionItem[] = [];
  const counters: number[] = [];

  function walk(parentId: string | null, depth: number) {
    const children = getChildSections(sections, parentId).filter(
      (s) => !includedOnly || s.included
    );

    for (const section of children) {
      counters[depth] = (counters[depth] ?? 0) + 1;
      counters.length = depth + 1;

      result.push({
        section,
        depth,
        number: counters.slice(0, depth + 1).join("."),
      });

      walk(section.id, depth + 1);
    }
  }

  walk(null, 0);
  return result;
}

export function applyFlatListToSections(
  flatList: Array<{ section: Section; depth: number }>
): Array<{ id: string; parentId: string | null; orderIndex: number }> {
  const updates: Array<{
    id: string;
    parentId: string | null;
    orderIndex: number;
  }> = [];
  const siblingCounts = new Map<string | null, number>();

  for (let i = 0; i < flatList.length; i++) {
    const { section, depth } = flatList[i];
    let parentId: string | null = null;

    if (depth > 0) {
      for (let j = i - 1; j >= 0; j--) {
        if (flatList[j].depth === depth - 1) {
          parentId = flatList[j].section.id;
          break;
        }
      }
    }

    const orderIndex = siblingCounts.get(parentId) ?? 0;
    siblingCounts.set(parentId, orderIndex + 1);

    updates.push({ id: section.id, parentId, orderIndex });
  }

  return updates;
}

function collectBlockFromFlat(
  flatList: FlatSectionItem[],
  startIdx: number
): FlatSectionItem[] {
  const startDepth = flatList[startIdx].depth;
  const block: FlatSectionItem[] = [flatList[startIdx]];

  for (let i = startIdx + 1; i < flatList.length; i++) {
    if (flatList[i].depth <= startDepth) break;
    block.push(flatList[i]);
  }

  return block;
}

/** Move a node and all its descendants within the flat outline */
export function moveBlockInFlatList(
  flatList: FlatSectionItem[],
  activeId: string,
  overId: string
): FlatSectionItem[] | null {
  const oldIndex = flatList.findIndex((i) => i.section.id === activeId);
  const overIndex = flatList.findIndex((i) => i.section.id === overId);
  if (oldIndex === -1 || overIndex === -1 || activeId === overId) return null;

  const blockLen = collectBlockFromFlat(flatList, oldIndex).length;

  if (overIndex > oldIndex && overIndex < oldIndex + blockLen) return null;

  const block = flatList.slice(oldIndex, oldIndex + blockLen);
  const withoutBlock = [
    ...flatList.slice(0, oldIndex),
    ...flatList.slice(oldIndex + blockLen),
  ];

  const newOverIndex = withoutBlock.findIndex((i) => i.section.id === overId);
  if (newOverIndex === -1) return null;

  let insertIndex: number;
  if (oldIndex < overIndex) {
    const overBlockLen = collectBlockFromFlat(flatList, overIndex).length;
    insertIndex = newOverIndex + overBlockLen;
  } else {
    insertIndex = newOverIndex;
  }

  const reordered = [
    ...withoutBlock.slice(0, insertIndex),
    ...block,
    ...withoutBlock.slice(insertIndex),
  ];

  return renumberFlatList(reordered);
}

export function indentFlatList(
  flatList: FlatSectionItem[],
  sectionId: string
): FlatSectionItem[] | null {
  const idx = flatList.findIndex((item) => item.section.id === sectionId);
  if (idx <= 0) return null;

  const item = flatList[idx];
  const newParent = flatList[idx - 1];
  const newDepth = newParent.depth + 1;

  const block = collectBlockFromFlat(flatList, idx);
  const updated = flatList.map((entry, i) => {
    if (i >= idx && i < idx + block.length) {
      return {
        ...entry,
        depth: entry.depth + (newDepth - item.depth),
      };
    }
    return entry;
  });

  return renumberFlatList(updated);
}

export function outdentFlatList(
  flatList: FlatSectionItem[],
  sectionId: string
): FlatSectionItem[] | null {
  const idx = flatList.findIndex((item) => item.section.id === sectionId);
  if (idx === -1 || flatList[idx].depth === 0) return null;

  const depthDelta = 1;
  const block = collectBlockFromFlat(flatList, idx);

  const updated = flatList.map((entry, i) => {
    if (i >= idx && i < idx + block.length) {
      return {
        ...entry,
        depth: Math.max(0, entry.depth - depthDelta),
      };
    }
    return entry;
  });

  return renumberFlatList(updated);
}

function renumberFlatList(flatList: FlatSectionItem[]): FlatSectionItem[] {
  const counters: number[] = [];
  return flatList.map((item) => {
    const d = item.depth;
    counters[d] = (counters[d] ?? 0) + 1;
    counters.length = d + 1;
    return {
      ...item,
      number: counters.slice(0, d + 1).join("."),
    };
  });
}

export function getDescendantIds(
  sections: Section[],
  sectionId: string
): string[] {
  const ids: string[] = [];
  const queue = [sectionId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const child of sections.filter((s) => s.parentId === parentId)) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }

  return ids;
}

export function headingLevelForDepth(depth: number): number {
  return Math.min(depth + 1, 6);
}

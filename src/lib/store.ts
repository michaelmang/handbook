import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, Section } from "./types";
import {
  createContainerSection,
  createEmptyProject,
  duplicateProject,
  getNextOrderIndex,
  migrateProject,
  sectionsFromMarkdownBlocks,
} from "./project-utils";
import {
  applyFlatListToSections,
  flattenSections,
  getDescendantIds,
  indentFlatList,
  outdentFlatList,
  type FlatSectionItem,
} from "./section-tree";
import { splitMarkdownByHeadings } from "./markdown";

interface ProjectsState {
  projects: Project[];
  activeProjectId: string | null;

  createProject: (name: string) => string;
  duplicateProjectById: (id: string, newName?: string) => string;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  getActiveProject: () => Project | null;
  getProject: (id: string) => Project | undefined;
  updateProject: (
    id: string,
    updates: Partial<Pick<Project, "name" | "templateId" | "branding">>
  ) => void;

  addSectionFromMarkdown: (
    projectId: string,
    markdown: string,
    parentId?: string | null
  ) => void;
  addContainerSection: (
    projectId: string,
    title: string,
    parentId?: string | null
  ) => void;
  updateSection: (
    projectId: string,
    sectionId: string,
    updates: Partial<
      Pick<
        Section,
        "title" | "markdownContent" | "included" | "parentId" | "orderIndex"
      >
    >
  ) => void;
  deleteSection: (projectId: string, sectionId: string) => void;
  duplicateSection: (projectId: string, sectionId: string) => void;
  applyFlatStructure: (
    projectId: string,
    flatList: FlatSectionItem[]
  ) => void;
  indentSection: (projectId: string, sectionId: string) => void;
  outdentSection: (projectId: string, sectionId: string) => void;

  importProjectJson: (json: string) => string | null;
  exportProjectJson: (id: string) => string | null;
}

function touchProject(project: Project): Project {
  return { ...project, updatedAt: new Date().toISOString() };
}

function normalizeProject(project: Project): Project {
  return migrateProject(project);
}

function updateProjectInList(
  projects: Project[],
  projectId: string,
  updater: (project: Project) => Project
): Project[] {
  return projects.map((p) =>
    p.id === projectId ? touchProject(updater(normalizeProject(p))) : p
  );
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      createProject: (name) => {
        const project = createEmptyProject(name);
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
        }));
        return project.id;
      },

      duplicateProjectById: (id, newName) => {
        const source = get().projects.find((p) => p.id === id);
        if (!source) return "";
        const copy = duplicateProject(normalizeProject(source), newName);
        set((state) => ({
          projects: [...state.projects, copy],
          activeProjectId: copy.id,
        }));
        return copy.id;
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId:
            state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },

      setActiveProject: (id) => set({ activeProjectId: id }),

      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        const project = projects.find((p) => p.id === activeProjectId);
        return project ? normalizeProject(project) : null;
      },

      getProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        return project ? normalizeProject(project) : undefined;
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: updateProjectInList(state.projects, id, (p) => ({
            ...p,
            ...updates,
            branding: updates.branding
              ? { ...p.branding, ...updates.branding }
              : p.branding,
          })),
        }));
      },

      addSectionFromMarkdown: (projectId, markdown, parentId = null) => {
        set((state) => ({
          projects: updateProjectInList(state.projects, projectId, (p) => {
            const blocks = splitMarkdownByHeadings(markdown);
            const startOrder = getNextOrderIndex(p.sections, parentId);
            const newSections = sectionsFromMarkdownBlocks(
              blocks,
              parentId,
              startOrder
            );
            return { ...p, sections: [...p.sections, ...newSections] };
          }),
        }));
      },

      addContainerSection: (projectId, title, parentId = null) => {
        set((state) => ({
          projects: updateProjectInList(state.projects, projectId, (p) => {
            const orderIndex = getNextOrderIndex(p.sections, parentId);
            const section = createContainerSection(title, parentId, orderIndex);
            return { ...p, sections: [...p.sections, section] };
          }),
        }));
      },

      updateSection: (projectId, sectionId, updates) => {
        set((state) => ({
          projects: updateProjectInList(state.projects, projectId, (p) => ({
            ...p,
            sections: p.sections.map((s) =>
              s.id === sectionId ? { ...s, ...updates } : s
            ),
          })),
        }));
      },

      deleteSection: (projectId, sectionId) => {
        set((state) => ({
          projects: updateProjectInList(state.projects, projectId, (p) => {
            const toDelete = new Set([
              sectionId,
              ...getDescendantIds(p.sections, sectionId),
            ]);
            return {
              ...p,
              sections: p.sections.filter((s) => !toDelete.has(s.id)),
            };
          }),
        }));
      },

      duplicateSection: (projectId, sectionId) => {
        set((state) => ({
          projects: updateProjectInList(state.projects, projectId, (p) => {
            const source = p.sections.find((s) => s.id === sectionId);
            if (!source) return p;
            const copy: Section = {
              ...source,
              id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              title: `${source.title} (Copy)`,
              orderIndex: getNextOrderIndex(p.sections, source.parentId),
            };
            return { ...p, sections: [...p.sections, copy] };
          }),
        }));
      },

      applyFlatStructure: (projectId, flatList) => {
        const updates = applyFlatListToSections(flatList);
        set((state) => ({
          projects: updateProjectInList(state.projects, projectId, (p) => ({
            ...p,
            sections: p.sections.map((s) => {
              const update = updates.find((u) => u.id === s.id);
              return update
                ? {
                    ...s,
                    parentId: update.parentId,
                    orderIndex: update.orderIndex,
                  }
                : s;
            }),
          })),
        }));
      },

      indentSection: (projectId, sectionId) => {
        set((state) => ({
          projects: updateProjectInList(state.projects, projectId, (p) => {
            const flat = flattenSections(p.sections);
            const updated = indentFlatList(flat, sectionId);
            if (!updated) return p;
            const updates = applyFlatListToSections(updated);
            return {
              ...p,
              sections: p.sections.map((s) => {
                const update = updates.find((u) => u.id === s.id);
                return update
                  ? {
                      ...s,
                      parentId: update.parentId,
                      orderIndex: update.orderIndex,
                    }
                  : s;
              }),
            };
          }),
        }));
      },

      outdentSection: (projectId, sectionId) => {
        set((state) => ({
          projects: updateProjectInList(state.projects, projectId, (p) => {
            const flat = flattenSections(p.sections);
            const updated = outdentFlatList(flat, sectionId);
            if (!updated) return p;
            const updates = applyFlatListToSections(updated);
            return {
              ...p,
              sections: p.sections.map((s) => {
                const update = updates.find((u) => u.id === s.id);
                return update
                  ? {
                      ...s,
                      parentId: update.parentId,
                      orderIndex: update.orderIndex,
                    }
                  : s;
              }),
            };
          }),
        }));
      },

      importProjectJson: (json) => {
        try {
          const parsed = migrateProject(JSON.parse(json));
          if (!parsed.id || !parsed.name) return null;
          const existing = get().projects.find((p) => p.id === parsed.id);
          const project = existing
            ? { ...parsed, updatedAt: new Date().toISOString() }
            : parsed;
          set((state) => ({
            projects: existing
              ? state.projects.map((p) => (p.id === project.id ? project : p))
              : [...state.projects, project],
            activeProjectId: project.id,
          }));
          return project.id;
        } catch {
          return null;
        }
      },

      exportProjectJson: (id) => {
        const project = get().projects.find((p) => p.id === id);
        if (!project) return null;
        return JSON.stringify(normalizeProject(project), null, 2);
      },
    }),
    {
      name: "handbook-builder-projects",
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.projects = state.projects.map((p) => migrateProject(p));
        }
      },
    }
  )
);

export { splitMarkdownByHeadings };

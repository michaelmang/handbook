"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProject, useProjectsStore } from "@/lib/store";
import type { Section } from "@/lib/types";
import { organizeProject } from "@/lib/project-utils";
import { isContainerSection, getDescendantIds, moveBlockInFlatList } from "@/lib/section-tree";
import { ImportPanel } from "./ImportPanel";
import { SectionEditorModal } from "./SectionEditorModal";

interface OrganizePanelProps {
  projectId: string;
}

export function OrganizePanel({ projectId }: OrganizePanelProps) {
  const {
    addContainerSection,
    updateSection,
    deleteSection,
    deleteSections,
    applyFlatStructure,
    indentSection,
    outdentSection,
  } = useProjectsStore();

  const project = useProject(projectId);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [importParentId, setImportParentId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const flatItems = useMemo(
    () => (project ? organizeProject(project) : []),
    [project]
  );

  if (!project) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const reordered = moveBlockInFlatList(
      flatItems,
      String(active.id),
      String(over.id)
    );
    if (!reordered) return;

    applyFlatStructure(projectId, reordered);
  };

  const handleAddGroup = () => {
    const title = newGroupTitle.trim() || "New Section Group";
    addContainerSection(projectId, title);
    setNewGroupTitle("");
    setShowAddGroup(false);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (sectionId: string) => {
    if (!project) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const descendants = getDescendantIds(project.sections, sectionId);
      if (next.has(sectionId)) {
        next.delete(sectionId);
        for (const id of descendants) next.delete(id);
      } else {
        next.add(sectionId);
        for (const id of descendants) next.add(id);
      }
      return next;
    });
  };

  const selectAllSections = () => {
    setSelectedIds(new Set(flatItems.map((i) => i.section.id)));
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (
      !confirm(
        `Delete ${count} selected section(s)? Nested items under selected groups are included.`
      )
    ) {
      return;
    }
    deleteSections(projectId, Array.from(selectedIds));
    exitSelectionMode();
  };

  const editingSectionData = editingSection
    ? project.sections.find((s) => s.id === editingSection)
    : null;

  const containerGroups = project.sections.filter((s) =>
    isContainerSection(s)
  );

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Import sections
        </h3>
        {containerGroups.length > 0 && (
          <div className="mb-3">
            <label className="text-xs font-medium text-stone-600">
              Import into
            </label>
            <select
              value={importParentId ?? ""}
              onChange={(e) =>
                setImportParentId(e.target.value ? e.target.value : null)
              }
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:border-stone-400 focus:outline-none"
            >
              <option value="">Top level</option>
              {containerGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <ImportPanel projectId={projectId} parentId={importParentId} />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Structure ({project.sections.length} items)
          </h3>
          <div className="flex items-center gap-2">
            {flatItems.length > 0 && (
              <button
                onClick={() =>
                  selectionMode ? exitSelectionMode() : setSelectionMode(true)
                }
                className={`text-xs font-medium ${
                  selectionMode
                    ? "text-stone-900"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {selectionMode ? "Done" : "Select"}
              </button>
            )}
            <button
              onClick={() => setShowAddGroup(true)}
              className="text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              + Add group
            </button>
          </div>
        </div>

        {selectionMode && flatItems.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <span className="text-xs text-stone-600">
              {selectedIds.size} selected
            </span>
            <button
              onClick={selectAllSections}
              className="text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              Select all
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedIds.size === 0}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 disabled:opacity-40"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="ml-auto rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              Delete selected
            </button>
          </div>
        )}

        <p className="mb-3 text-xs text-stone-500">
          Numbers are generated from position — never typed manually. Drag to
          reorder (subtrees move together). Use → ← to change nesting depth.
        </p>

        {showAddGroup && (
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newGroupTitle}
              onChange={(e) => setNewGroupTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
              placeholder="Part I: Academic Policies"
              className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:border-stone-400 focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleAddGroup}
              className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddGroup(false)}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600"
            >
              Cancel
            </button>
          </div>
        )}

        {flatItems.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
            Add top-level parts with &ldquo;Add group,&rdquo; then import
            Markdown files. Headings in each file become nested nodes you can
            rearrange here.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flatItems.map((i) => i.section.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {flatItems.map((item) => (
                  <SortableSectionRow
                    key={item.section.id}
                    item={item}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(item.section.id)}
                    onToggleSelected={() => toggleSelected(item.section.id)}
                    onEdit={() => setEditingSection(item.section.id)}
                    onToggleIncluded={() =>
                      updateSection(projectId, item.section.id, {
                        included: !item.section.included,
                      })
                    }
                    onDelete={() => {
                      const label = isContainerSection(item.section)
                        ? "group"
                        : "section";
                      if (
                        confirm(
                          `Delete ${label} "${item.section.title}" and all nested items?`
                        )
                      ) {
                        deleteSection(projectId, item.section.id);
                      }
                    }}
                    onIndent={() => indentSection(projectId, item.section.id)}
                    onOutdent={() => outdentSection(projectId, item.section.id)}
                    onRename={(title) =>
                      updateSection(projectId, item.section.id, { title })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {editingSectionData && (
        <SectionEditorModal
          section={editingSectionData}
          accentColor={project.branding.accentColor}
          onSave={(title, markdownContent) => {
            updateSection(projectId, editingSectionData.id, {
              title,
              markdownContent,
            });
            setEditingSection(null);
          }}
          onClose={() => setEditingSection(null)}
        />
      )}
    </div>
  );
}

function SortableSectionRow({
  item,
  selectionMode,
  selected,
  onToggleSelected,
  onEdit,
  onToggleIncluded,
  onDelete,
  onIndent,
  onOutdent,
  onRename,
}: {
  item: { section: Section; depth: number; number: string };
  selectionMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onToggleIncluded: () => void;
  onDelete: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onRename: (title: string) => void;
}) {
  const { section, depth, number } = item;
  const isContainer = isContainerSection(section);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : section.included ? 1 : 0.5,
    paddingLeft: `${depth * 1.25 + 0.75}rem`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 rounded-lg border py-2 pr-2 ${
        selected
          ? "border-stone-400 bg-stone-100 ring-1 ring-stone-300"
          : isContainer
            ? "border-stone-200 bg-stone-100"
            : section.included
              ? "border-stone-200 bg-white"
              : "border-stone-100 bg-stone-50"
      }`}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="ml-2 h-3.5 w-3.5 shrink-0 rounded border-stone-300 text-stone-800 focus:ring-stone-400"
          aria-label={`Select ${section.title}`}
        />
      )}

      <button
        {...attributes}
        {...listeners}
        disabled={selectionMode}
        className={`pl-2 text-stone-300 ${
          selectionMode
            ? "cursor-default opacity-30"
            : "cursor-grab hover:text-stone-500 active:cursor-grabbing"
        }`}
        aria-label="Drag to reorder"
      >
        <GripIcon />
      </button>

      <span className="w-14 shrink-0 font-mono text-xs text-stone-400">
        {number}
      </span>

      {isContainer ? (
        <input
          type="text"
          defaultValue={section.title}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== section.title) {
              onRename(e.target.value.trim());
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-800 focus:outline-none"
        />
      ) : (
        <button
          onClick={onEdit}
          className="min-w-0 flex-1 truncate text-left text-sm text-stone-700 hover:text-stone-900"
        >
          {section.title}
          {!section.included && (
            <span className="ml-2 text-xs text-stone-400">(excluded)</span>
          )}
        </button>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={onOutdent}
          disabled={depth === 0}
          className="rounded px-1.5 py-1 text-xs text-stone-500 hover:bg-stone-200/60 disabled:opacity-30"
          title="Outdent (move up one level)"
        >
          ←
        </button>
        <button
          onClick={onIndent}
          className="rounded px-1.5 py-1 text-xs text-stone-500 hover:bg-stone-200/60"
          title="Indent (nest under item above)"
        >
          →
        </button>
        <button
          onClick={onToggleIncluded}
          className="rounded px-1.5 py-1 text-xs text-stone-500 hover:bg-stone-200/60"
          title={section.included ? "Exclude from export" : "Include in export"}
        >
          {section.included ? "✓" : "○"}
        </button>
        <button
          onClick={onDelete}
          className="rounded px-1.5 py-1 text-xs text-stone-400 hover:bg-red-50 hover:text-red-500"
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function GripIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  );
}

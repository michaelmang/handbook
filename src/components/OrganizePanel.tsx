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
import { useProjectsStore } from "@/lib/store";
import type { Section } from "@/lib/types";
import { organizeProject } from "@/lib/project-utils";
import { isContainerSection, moveBlockInFlatList } from "@/lib/section-tree";
import { ImportPanel } from "./ImportPanel";

interface OrganizePanelProps {
  projectId: string;
}

export function OrganizePanel({ projectId }: OrganizePanelProps) {
  const {
    getProject,
    addContainerSection,
    updateSection,
    deleteSection,
    duplicateSection,
    applyFlatStructure,
    indentSection,
    outdentSection,
  } = useProjectsStore();

  const project = getProject(projectId);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);

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

  const editingSectionData = editingSection
    ? project.sections.find((s) => s.id === editingSection)
    : null;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Import sections
        </h3>
        <ImportPanel projectId={projectId} />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Structure ({project.sections.length} items)
          </h3>
          <button
            onClick={() => setShowAddGroup(true)}
            className="text-xs font-medium text-stone-600 hover:text-stone-900"
          >
            + Add group
          </button>
        </div>

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
                    onEdit={() => setEditingSection(item.section.id)}
                    onToggleIncluded={() =>
                      updateSection(projectId, item.section.id, {
                        included: !item.section.included,
                      })
                    }
                    onDuplicate={() =>
                      duplicateSection(projectId, item.section.id)
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
  onEdit,
  onToggleIncluded,
  onDuplicate,
  onDelete,
  onIndent,
  onOutdent,
  onRename,
}: {
  item: { section: Section; depth: number; number: string };
  onEdit: () => void;
  onToggleIncluded: () => void;
  onDuplicate: () => void;
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
        isContainer
          ? "border-stone-200 bg-stone-100"
          : section.included
            ? "border-stone-200 bg-white"
            : "border-stone-100 bg-stone-50"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab pl-2 text-stone-300 hover:text-stone-500 active:cursor-grabbing"
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
          onClick={onDuplicate}
          className="rounded px-1.5 py-1 text-xs text-stone-500 hover:bg-stone-200/60"
          title="Duplicate"
        >
          ⧉
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

function SectionEditorModal({
  section,
  onSave,
  onClose,
}: {
  section: Section;
  onSave: (title: string, markdown: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [markdown, setMarkdown] = useState(section.markdownContent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-stone-900">Edit section</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-stone-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">
              Markdown content
            </label>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={16}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 font-mono text-sm focus:border-stone-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(title, markdown)}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Save
          </button>
        </div>
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

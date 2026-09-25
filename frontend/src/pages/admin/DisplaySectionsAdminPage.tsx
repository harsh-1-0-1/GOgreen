import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Eye, EyeOff, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useAdminDisplaySections,
  useCreateDisplaySection,
  useDeleteDisplaySection,
  useReorderDisplaySections,
  useSetDisplaySectionActive,
  useUpdateDisplaySection,
} from '@/hooks/useDisplaySections';
import { getApiErrorDetail } from '@/lib/apiError';
import type { DisplaySectionAdmin } from '@/types';

function SortableSectionRow({
  section,
  onRename,
  onDelete,
  onToggleActive,
}: {
  section: DisplaySectionAdmin;
  onRename: (id: number, name: string) => Promise<boolean>;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function saveName() {
    const nextName = name.trim();
    if (!nextName) {
      setName(section.name);
      return;
    }
    if (nextName === section.name) {
      setEditing(false);
      return;
    }
    const saved = await onRename(section.id, nextName);
    if (saved) {
      setName(nextName);
      setEditing(false);
    }
  }

  function cancelEdit() {
    setName(section.name);
    setEditing(false);
  }

  function cancelDelete() {
    setConfirmStep(0);
    setDeleteError(null);
  }

  async function confirmDelete() {
    try {
      onDelete(section.id);
      cancelDelete();
    } catch (error) {
      setDeleteError(getApiErrorDetail(error, 'Failed to delete display section'));
      setConfirmStep(0);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 sm:px-4 py-3.5 bg-white border-b last:border-0 hover:bg-gray-50/60"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none touch-target text-gray-400 hover:text-gray-600 shrink-0"
        aria-label={`Drag ${section.name} to reorder`}
      >
        <GripVertical size={18} />
      </button>

      <span className="w-7 text-center text-xs font-semibold text-gray-400 shrink-0">
        {section.sort_order + 1}
      </span>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveName();
                if (event.key === 'Escape') cancelEdit();
              }}
              autoFocus
              maxLength={100}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => void saveName()}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
              aria-label="Save section name"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
              aria-label="Cancel rename"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-800 truncate">{section.name}</p>
              {section.is_system && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-indigo-50 text-indigo-700">
                  System
                </span>
              )}
              {!section.is_active && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-gray-100 text-gray-500">
                  Hidden
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 font-mono truncate">{section.key}</p>
          </>
        )}
      </div>

      <span
        className={`shrink-0 px-2 py-1 text-[11px] font-semibold rounded-full ${
          section.product_count === 0
            ? 'bg-amber-50 text-amber-700'
            : 'bg-gray-100 text-gray-600'
        }`}
        title={
          section.product_count === 0
            ? 'No products assigned — this section will not appear on the homepage'
            : `${section.product_count} product(s) assigned`
        }
      >
        {section.product_count} {section.product_count === 1 ? 'product' : 'products'}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        {!editing && (
          <button
            type="button"
            onClick={() => onToggleActive(section.id, !section.is_active)}
            className={`p-2 rounded-lg transition ${
              section.is_active
                ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                : 'text-amber-600 hover:bg-amber-50'
            }`}
            aria-label={`${section.is_active ? 'Hide' : 'Show'} ${section.name}`}
            title={section.is_active ? 'Hide from homepage' : 'Show on homepage'}
          >
            {section.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setName(section.name);
              setEditing(true);
            }}
            className="p-2 text-gray-400 hover:text-primary hover:bg-primary-light/10 rounded-lg transition"
            aria-label={`Rename ${section.name}`}
            title="Rename"
          >
            <Pencil size={15} />
          </button>
        )}
        {!section.is_system &&
          (confirmStep > 0 ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 max-w-[16rem] text-right">
                  {confirmStep === 1
                    ? `Delete "${section.name}"? This cannot be undone.`
                    : `Are you sure? "${section.name}" will be removed from the storefront permanently.`}
                </span>
                {confirmStep === 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmStep(2)}
                      className="px-2 py-1.5 text-red-600 font-semibold hover:bg-red-50 rounded-lg"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={cancelDelete}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void confirmDelete()}
                      className="px-2 py-1.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={cancelDelete}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              {deleteError && (
                <p className="text-[11px] text-red-600 max-w-[20rem] text-right">{deleteError}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirmStep(1);
              }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              aria-label={`Delete ${section.name}`}
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          ))}
      </div>
    </div>
  );
}

export default function DisplaySectionsAdminPage() {
  const { data: sections, isLoading, isError, refetch } = useAdminDisplaySections();
  const createMutation = useCreateDisplaySection();
  const updateMutation = useUpdateDisplaySection();
  const deleteMutation = useDeleteDisplaySection();
  const reorderMutation = useReorderDisplaySections();
  const activeMutation = useSetDisplaySectionActive();
  const [newName, setNewName] = useState('');
  const visibleSections = useMemo(() => sections ?? [], [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createMutation.mutateAsync({ name });
      setNewName('');
      toast.success('Display section created');
    } catch (error) {
      toast.error(getApiErrorDetail(error, 'Failed to create display section'));
    }
  }, [createMutation, newName]);

  const handleRename = useCallback(
    async (id: number, name: string) => {
      try {
        await updateMutation.mutateAsync({ id, body: { name } });
        toast.success('Display section renamed');
        return true;
      } catch (error) {
        toast.error(getApiErrorDetail(error, 'Failed to rename display section'));
        return false;
      }
    },
    [updateMutation],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await deleteMutation.mutateAsync(id);
      toast.success('Display section deleted');
    },
    [deleteMutation],
  );

  const handleToggleActive = useCallback(
    async (id: number, isActive: boolean) => {
      try {
        await activeMutation.mutateAsync({ id, isActive });
        toast.success(isActive ? 'Section is now visible' : 'Section hidden from homepage');
      } catch (error) {
        toast.error(getApiErrorDetail(error, 'Failed to update section visibility'));
      }
    },
    [activeMutation],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || reorderMutation.isPending) return;

      const oldIndex = visibleSections.findIndex((section) => section.id === active.id);
      const newIndex = visibleSections.findIndex((section) => section.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const reordered = arrayMove(visibleSections, oldIndex, newIndex).map((section, index) => ({
        ...section,
        sort_order: index,
      }));

      try {
        await reorderMutation.mutateAsync(
          reordered.map((section) => ({ id: section.id, sort_order: section.sort_order })),
        );
        toast.success('Section order updated');
      } catch (error) {
        toast.error(getApiErrorDetail(error, 'Failed to update section order'));
      }
    },
    [visibleSections, reorderMutation],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Display Sections</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Create product display sections, rename them, and drag them into the required order.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={100}
            placeholder="New section name"
            className="w-full sm:w-56 px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newName.trim()}
            className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm rounded-lg font-semibold flex items-center gap-2 transition disabled:opacity-50 shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Section</span>
          </button>
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-800">
          Section names are editable. The system key stays stable so products already assigned to a
          section continue to work. Sections marked <span className="font-semibold">System</span>{' '}
          cannot be deleted — hide or rename them instead.
        </p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">Loading sections...</div>
        ) : isError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-500 mb-3">Failed to load display sections.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-4 py-2 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary/90 transition"
            >
              Retry
            </button>
          </div>
        ) : visibleSections.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            No display sections yet. Add your first section above.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleSections.map((section) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y">
                {visibleSections.map((section) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    onRename={handleRename}
                    onDelete={(id) => void handleDelete(id)}
                    onToggleActive={(id, isActive) => void handleToggleActive(id, isActive)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

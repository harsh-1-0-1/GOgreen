import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  GripVertical,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/lib/api';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { getApiErrorDetail } from '@/lib/apiError';
import type { MenuItem } from '@/types';

const menuSchema = z.object({
  label: z.string().min(1, 'Label is required').max(255),
  href: z
    .string()
    .min(1, 'URL is required')
    .max(512)
    .refine(
      (v) => !v.startsWith('//') && (v.startsWith('/') || v.startsWith('https://')),
      { message: 'URL must start with / or https:// (// is not allowed)' },
    ),
  parent_id: z.string().optional(),
  image_url: z.string().max(512).optional().or(z.literal('')),
  accent_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #FF5733)')
    .optional()
    .or(z.literal('')),
  highlight: z.boolean(),
  sort_order: z.number(),
  is_active: z.boolean(),
});

type MenuFormData = z.infer<typeof menuSchema>;

const inputClass =
  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

function SortableMenuRow({
  item,
  parentLabel,
  onEdit,
  onToggle,
  onDelete,
  deleteConfirmId,
  setDeleteConfirmId,
}: {
  item: MenuItem;
  parentLabel?: string;
  onEdit: (m: MenuItem) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  deleteConfirmId: number | null;
  setDeleteConfirmId: (id: number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 sm:px-4 py-3.5 bg-white border-b last:border-0 hover:bg-gray-50/50"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-target text-gray-400 hover:text-gray-600 shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={18} />
      </button>

      {item.image_url ? (
        <img
          src={item.image_url}
          alt=""
          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-50 border border-gray-100"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-100">
          <ImageIcon size={15} className="text-gray-300" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1.5">
          {item.label}
          {item.highlight && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
              HIGHLIGHT
            </span>
          )}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {parentLabel ? `${parentLabel} → ` : ''}
          {item.href}
          {item.accent_color && (
            <span
              className="inline-block w-2.5 h-2.5 rounded-full ml-1.5 align-middle"
              style={{ background: item.accent_color }}
            />
          )}
        </p>
      </div>

      <span
        className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
          item.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${item.is_active ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        {item.is_active ? 'Active' : 'Paused'}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(item)}
          className="px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-light/10 rounded-lg transition"
        >
          Edit
        </button>
        <button
          onClick={() => onToggle(item.id)}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition hidden sm:inline-flex"
        >
          {item.is_active ? 'Pause' : 'Activate'}
        </button>
        {deleteConfirmId === item.id ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Sure?</span>
            <button
              onClick={() => onDelete(item.id)}
              className="text-red-600 font-medium hover:underline px-1"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="text-gray-500 hover:underline px-1"
            >
              No
            </button>
          </span>
        ) : (
          <button
            onClick={() => setDeleteConfirmId(item.id)}
            className="px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function MenuDrawer({
  item,
  topLevelItems,
  initialParentId,
  onClose,
  onSaved,
}: {
  item: MenuItem | null;
  topLevelItems: MenuItem[];
  initialParentId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      label: item?.label || '',
      href: item?.href || '',
      parent_id: String(item?.parent_id ?? initialParentId ?? ''),
      image_url: item?.image_url || '',
      accent_color: item?.accent_color || '',
      highlight: item?.highlight ?? false,
      sort_order: item?.sort_order ?? 0,
      is_active: item?.is_active ?? true,
    },
  });

  useBodyScrollLock(true);
  const [submitting, setSubmitting] = useState(false);

  const watchedHighlight = watch('highlight');
  const watchedActive = watch('is_active');
  const watchedAccent = watch('accent_color');

  async function onSubmit(data: MenuFormData) {
    setSubmitting(true);
    try {
      const payload = {
        label: data.label,
        href: data.href,
        parent_id: data.parent_id ? Number(data.parent_id) : null,
        image_url: data.image_url || null,
        accent_color: data.accent_color || null,
        highlight: data.highlight,
        sort_order: data.sort_order,
        is_active: data.is_active,
      };

      if (isEdit) {
        await api.put(`/menu_items/admin/${item!.id}`, payload);
      } else {
        await api.post('/menu_items/admin', payload);
      }

      toast.success('Menu item saved successfully!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to save menu item'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[460px] bg-[#FAFAF8] z-50 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Menu Item' : 'Create Menu Item'}
            </h2>
            <p className="text-xs text-gray-500">Configure a navigation link</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Label *</label>
            <input {...register('label')} className={inputClass} placeholder="e.g. Diwali Gifting" />
            {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label.message}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">
              URL (Href) *
            </label>
            <input
              {...register('href')}
              className={inputClass}
              placeholder="/products?tags=... or https://..."
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Must start with <strong>/</strong> (but not //) or <strong>https://</strong>.
            </p>
            {errors.href && <p className="text-xs text-red-500 mt-1">{errors.href.message}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Parent Item</label>
            <select {...register('parent_id')} className={inputClass}>
              <option value="">Top-level item (no parent)</option>
              {topLevelItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Leave blank for a top-level nav item. Selecting a parent makes this a submenu item.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">
              Image URL (mobile thumbnail)
            </label>
            <input
              {...register('image_url')}
              className={inputClass}
              placeholder="https://... (optional)"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Accent Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={watchedAccent && /^#[0-9A-Fa-f]{6}$/.test(watchedAccent) ? watchedAccent : '#cccccc'}
                onChange={(e) => setValue('accent_color', e.target.value)}
                className="w-9 h-9 rounded-lg border cursor-pointer shrink-0"
              />
              <input
                {...register('accent_color')}
                className={inputClass}
                placeholder="#FF5733"
              />
            </div>
            {errors.accent_color && (
              <p className="text-xs text-red-500 mt-1">{errors.accent_color.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Sort Order</label>
              <input {...register('sort_order')} type="number" className={inputClass} />
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white p-3 rounded-lg border">
            <div>
              <label className="text-xs font-semibold text-gray-700 block">Highlight</label>
              <span className="text-[10px] text-gray-400">Yellow/emphasis styling (e.g. Offers)</span>
            </div>
            <button
              type="button"
              onClick={() => setValue('highlight', !getValues('highlight'))}
              className={`relative w-11 h-6 rounded-full transition-colors ml-auto ${
                watchedHighlight ? 'bg-amber-400' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  watchedHighlight ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3 bg-white p-3 rounded-lg border">
            <div>
              <label className="text-xs font-semibold text-gray-700 block">Active</label>
              <span className="text-[10px] text-gray-400">Visible on the website</span>
            </div>
            <button
              type="button"
              onClick={() => setValue('is_active', !getValues('is_active'))}
              className={`relative w-11 h-6 rounded-full transition-colors ml-auto ${
                watchedActive ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  watchedActive ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function MenuAdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'top' | 'sub'>('top');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [initialParentId, setInitialParentId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const { data: items, isLoading, isError, refetch } = useQuery<MenuItem[]>({
    queryKey: ['admin-menu-items'],
    queryFn: () => api.get('/menu_items/admin').then((r) => r.data),
  });

  const [localItems, setLocalItems] = useState<MenuItem[]>(items ?? []);

  // Keep the optimistic copy in sync with the latest fetched items. Using an
  // effect (instead of setState during render) avoids an infinite re-render
  // loop that previously crashed the page with "Too many re-renders".
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop->state sync
    setLocalItems(items ?? []);
  }, [items]);

  const topLevelItems = useMemo(
    () =>
      [...localItems]
        .filter((m) => !m.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [localItems],
  );

  const subMenuItems = useMemo(
    () =>
      [...localItems]
        .filter((m) => !!m.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [localItems],
  );

  const activeItems = tab === 'top' ? topLevelItems : subMenuItems;
  const parentLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    topLevelItems.forEach((m) => map.set(m.id, m.label));
    return map;
  }, [topLevelItems]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
    queryClient.invalidateQueries({ queryKey: ['menu_items'] });
  }, [queryClient]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const list = tab === 'top' ? topLevelItems : subMenuItems;
      const oldIndex = list.findIndex((m) => m.id === active.id);
      const newIndex = list.findIndex((m) => m.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const reordered = arrayMove(list, oldIndex, newIndex);
      const updated = reordered.map((m, i) => ({ ...m, sort_order: i }));
      setLocalItems((prev) =>
        prev.map((p) => updated.find((u) => u.id === p.id) ?? p),
      );

      try {
        await api.patch('/menu_items/admin/reorder', {
          items: reordered.map((m, i) => ({ id: m.id, sort_order: i })),
        });
        toast.success('Order updated');
        invalidateAll();
      } catch (err) {
        toast.error(getApiErrorDetail(err, 'Failed to reorder'));
        refetch();
      }
    },
    [tab, topLevelItems, subMenuItems, invalidateAll, refetch],
  );

  async function handleToggle(id: number) {
    try {
      await api.patch(`/menu_items/admin/${id}/toggle`);
      toast.success('Menu item updated');
      invalidateAll();
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to update menu item'));
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/menu_items/admin/${id}`);
      toast.success('Menu item deleted');
      setDeleteConfirmId(null);
      invalidateAll();
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to delete menu item'));
    }
  }

  async function handleSeedDefaults() {
    if (!confirm('Restore default navigation items? Existing items will be updated, new ones added. Your custom sort order will be preserved.')) {
      return;
    }
    setSeeding(true);
    try {
      await api.post('/menu_items/admin/seed-defaults');
      toast.success('Default menu items restored');
      invalidateAll();
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to restore defaults'));
    } finally {
      setSeeding(false);
    }
  }

  function openCreate() {
    setEditingItem(null);
    setInitialParentId(tab === 'sub' ? null : null);
    setDrawerOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditingItem(item);
    setInitialParentId(item.parent_id);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Navigation Menu</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage the site navigation. Seasonal promotions can be added without code deploys.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg font-semibold flex items-center gap-2 transition disabled:opacity-50"
          >
            <RotateCcw size={15} /> {seeding ? 'Restoring...' : 'Seed Defaults'}
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm rounded-lg font-semibold flex items-center gap-2 transition shrink-0"
          >
            <Plus size={16} /> Add {tab === 'sub' ? 'Submenu' : 'Item'}
          </button>
        </div>
      </div>

      {/* Help card */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
        <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center text-green-700 shrink-0 text-lg">
          💡
        </div>
        <div>
          <h3 className="font-semibold text-sm text-green-900">Pro Tip</h3>
          <p className="text-xs text-green-700 mt-0.5">
            Use the menu for seasonal promotions (e.g. Diwali, Monsoon). Create a top-level item,
            then add submenu children under it. Pause items to hide them without deleting. The
            website updates automatically within 5 minutes — no deploy needed.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border overflow-hidden shadow-sm w-fit">
        {(
          [
            ['top', `Top-Level Items (${topLevelItems.length})`],
            ['sub', `Submenu Items (${subMenuItems.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setDeleteConfirmId(null);
            }}
            className={`px-4 py-2.5 text-sm font-semibold transition ${
              tab === key ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            Loading menu items...
          </div>
        ) : isError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-500 mb-3">Failed to load menu items.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary/90 transition"
            >
              Retry
            </button>
          </div>
        ) : activeItems.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            No {tab === 'sub' ? 'submenu items' : 'top-level items'} yet.{' '}
            <button onClick={openCreate} className="text-primary font-semibold hover:underline">
              Add your first {tab === 'sub' ? 'submenu item' : 'menu item'}
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeItems.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y">
                {activeItems.map((item) => (
                  <SortableMenuRow
                    key={item.id}
                    item={item}
                    parentLabel={
                      item.parent_id ? parentLabelMap.get(item.parent_id) : undefined
                    }
                    onEdit={openEdit}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    deleteConfirmId={deleteConfirmId}
                    setDeleteConfirmId={setDeleteConfirmId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {drawerOpen && (
        <MenuDrawer
          item={editingItem}
          topLevelItems={topLevelItems}
          initialParentId={initialParentId}
          onClose={() => setDrawerOpen(false)}
          onSaved={invalidateAll}
        />
      )}
    </div>
  );
}

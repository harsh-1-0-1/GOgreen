import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Image as ImageIcon, Plus, RotateCcw, X, } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useCategories } from '@/hooks/useCategories';
import { getApiErrorDetail } from '@/lib/apiError';
import CategoryLinkPicker from '@/components/admin/CategoryLinkPicker';
const menuSchema = z.object({
    label: z.string().min(1, 'Label is required').max(255),
    href: z
        .string()
        .min(1, 'URL is required')
        .max(512)
        .refine((v) => !v.startsWith('//') && (v.startsWith('/') || v.startsWith('https://')), { message: 'URL must start with / or https:// (// is not allowed)' }),
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
const inputClass = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const MAX_MENU_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MENU_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
function SortableMenuRow({ item, parentLabel, onEdit, onToggle, onDelete, deleteConfirmId, setDeleteConfirmId, }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (_jsxs("div", { ref: setNodeRef, style: style, className: "flex items-center gap-3 px-3 sm:px-4 py-3.5 bg-white border-b last:border-0 hover:bg-gray-50/50", children: [_jsx("button", { ...attributes, ...listeners, className: "cursor-grab active:cursor-grabbing touch-none touch-target text-gray-400 hover:text-gray-600 shrink-0", "aria-label": "Drag to reorder", children: _jsx(GripVertical, { size: 18 }) }), item.image_url ? (_jsx("img", { src: item.image_url, alt: "", className: "w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-50 border border-gray-100", onError: (e) => {
                    e.currentTarget.style.display = 'none';
                } })) : (_jsx("div", { className: "w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-100", children: _jsx(ImageIcon, { size: 15, className: "text-gray-300" }) })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("p", { className: "text-sm font-semibold text-gray-800 truncate flex items-center gap-1.5", children: [item.label, item.highlight && (_jsx("span", { className: "inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full", children: "HIGHLIGHT" }))] }), _jsxs("p", { className: "text-xs text-gray-400 truncate", children: [parentLabel ? `${parentLabel} → ` : '', item.href, item.accent_color && (_jsx("span", { className: "inline-block w-2.5 h-2.5 rounded-full ml-1.5 align-middle", style: { background: item.accent_color } }))] })] }), _jsxs("span", { className: `hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${item.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`, children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full ${item.is_active ? 'bg-green-500' : 'bg-gray-400'}` }), item.is_active ? 'Active' : 'Paused'] }), _jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx("button", { onClick: () => onEdit(item), className: "px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-light/10 rounded-lg transition", children: "Edit" }), _jsx("button", { onClick: () => onToggle(item.id), className: "px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition hidden sm:inline-flex", children: item.is_active ? 'Pause' : 'Activate' }), deleteConfirmId === item.id ? (_jsxs("span", { className: "flex items-center gap-1 text-xs", children: [_jsx("span", { className: "text-gray-500", children: "Sure?" }), _jsx("button", { onClick: () => onDelete(item.id), className: "text-red-600 font-medium hover:underline px-1", children: "Delete" }), _jsx("button", { onClick: () => setDeleteConfirmId(null), className: "text-gray-500 hover:underline px-1", children: "No" })] })) : (_jsx("button", { onClick: () => setDeleteConfirmId(item.id), className: "px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition", children: "Delete" }))] })] }));
}
function MenuDrawer({ item, topLevelItems, initialParentId, onClose, onSaved, }) {
    const isEdit = !!item;
    const { register, handleSubmit, watch, setValue, getValues, formState: { errors }, } = useForm({
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
    const [imageFile, setImageFile] = useState(null);
    const [imageFilePreview, setImageFilePreview] = useState(null);
    const imageFilePreviewRef = useRef(null);
    const { data: categories } = useCategories();
    useEffect(() => {
        return () => {
            if (imageFilePreviewRef.current) {
                URL.revokeObjectURL(imageFilePreviewRef.current);
            }
        };
    }, []);
    // react-hook-form's `watch()` is a React-Compiler-incompatible library (cannot be
    // memoized safely); the live preview needs its reactive values, so the
    // compiler is intentionally allowed to skip memoizing this drawer.
    // eslint-disable-next-line react-hooks/incompatible-library
    const watchedHighlight = watch('highlight');
    const watchedActive = watch('is_active');
    const watchedAccent = watch('accent_color');
    const watchedHref = watch('href');
    const watchedImageUrl = watch('image_url');
    const imageUrlField = register('image_url');
    const imagePreview = imageFilePreview || watchedImageUrl || null;
    function clearSelectedImage() {
        if (imageFilePreviewRef.current) {
            URL.revokeObjectURL(imageFilePreviewRef.current);
            imageFilePreviewRef.current = null;
        }
        setImageFile(null);
        setImageFilePreview(null);
    }
    function handleImageChange(event) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        if (!ALLOWED_MENU_IMAGE_TYPES.has(file.type)) {
            toast.error('Please choose a JPG, PNG, or WEBP image');
            event.target.value = '';
            return;
        }
        if (file.size > MAX_MENU_IMAGE_SIZE) {
            toast.error('Menu image must be 5MB or smaller');
            event.target.value = '';
            return;
        }
        clearSelectedImage();
        const previewUrl = URL.createObjectURL(file);
        imageFilePreviewRef.current = previewUrl;
        setImageFile(file);
        setImageFilePreview(previewUrl);
        setValue('image_url', '');
    }
    async function onSubmit(data) {
        setSubmitting(true);
        try {
            let imageUrl = data.image_url || null;
            if (imageFile) {
                const formData = new FormData();
                formData.append('image', imageFile);
                const uploadResponse = await api.post('/menu_items/admin/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                imageUrl = uploadResponse.data.key;
            }
            const payload = {
                label: data.label,
                href: data.href,
                parent_id: data.parent_id ? Number(data.parent_id) : null,
                image_url: imageUrl,
                accent_color: data.accent_color || null,
                highlight: data.highlight,
                sort_order: data.sort_order,
                is_active: data.is_active,
            };
            if (isEdit) {
                await api.put(`/menu_items/admin/${item.id}`, payload);
            }
            else {
                await api.post('/menu_items/admin', payload);
            }
            toast.success('Menu item saved successfully!');
            onSaved();
            onClose();
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to save menu item'));
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/40 z-40 transition-opacity", onClick: onClose }), _jsxs("div", { className: "fixed right-0 top-0 h-full w-full sm:w-[460px] bg-[#FAFAF8] z-50 shadow-2xl flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-bold text-gray-900", children: isEdit ? 'Edit Menu Item' : 'Create Menu Item' }), _jsx("p", { className: "text-xs text-gray-500", children: "Configure a navigation link" })] }), _jsx("button", { onClick: onClose, className: "p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors", children: _jsx(X, { size: 20 }) })] }), _jsxs("form", { onSubmit: handleSubmit(onSubmit), className: "flex-1 overflow-y-auto p-4 sm:p-5 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Label *" }), _jsx("input", { ...register('label'), className: inputClass, placeholder: "e.g. Diwali Gifting" }), errors.label && _jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.label.message })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "URL (Href) *" }), _jsx("input", { ...register('href'), className: inputClass, placeholder: "/products?tags=... or https://..." }), _jsx(CategoryLinkPicker, { categories: categories, value: watchedHref, onPick: (link) => setValue('href', link) }), _jsxs("p", { className: "text-[10px] text-gray-400 mt-0.5", children: ["Must start with ", _jsx("strong", { children: "/" }), " (but not //) or ", _jsx("strong", { children: "https://" }), "."] }), errors.href && _jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.href.message })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Parent Item" }), _jsxs("select", { ...register('parent_id'), className: inputClass, children: [_jsx("option", { value: "", children: "Top-level item (no parent)" }), topLevelItems.map((m) => (_jsx("option", { value: m.id, children: m.label }, m.id)))] }), _jsx("p", { className: "text-[10px] text-gray-400 mt-0.5", children: "Leave blank for a top-level nav item. Selecting a parent makes this a submenu item." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Menu Image" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0", children: imagePreview ? (_jsx("img", { src: imagePreview, alt: "Menu preview", className: "w-full h-full object-cover" })) : (_jsx(ImageIcon, { size: 24, className: "text-gray-300" })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", onChange: handleImageChange, className: "w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" }), _jsx("p", { className: "text-[10px] text-gray-400 mt-1", children: "JPG, PNG, or WEBP up to 5 MB." })] })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Or use an image URL" }), _jsx("input", { ...imageUrlField, onChange: (event) => {
                                                    imageUrlField.onChange(event);
                                                    if (imageFile)
                                                        clearSelectedImage();
                                                }, className: inputClass, placeholder: "https://... (optional)" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Accent Color" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "color", value: watchedAccent && /^#[0-9A-Fa-f]{6}$/.test(watchedAccent) ? watchedAccent : '#cccccc', onChange: (e) => setValue('accent_color', e.target.value), className: "w-9 h-9 rounded-lg border cursor-pointer shrink-0" }), _jsx("input", { ...register('accent_color'), className: inputClass, placeholder: "#FF5733" })] }), errors.accent_color && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.accent_color.message }))] }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Sort Order" }), _jsx("input", { ...register('sort_order'), type: "number", className: inputClass })] }) }), _jsxs("div", { className: "flex items-center gap-3 bg-white p-3 rounded-lg border", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Highlight" }), _jsx("span", { className: "text-[10px] text-gray-400", children: "Yellow/emphasis styling (e.g. Offers)" })] }), _jsx("button", { type: "button", onClick: () => setValue('highlight', !getValues('highlight')), className: `relative w-11 h-6 rounded-full transition-colors ml-auto ${watchedHighlight ? 'bg-amber-400' : 'bg-gray-300'}`, children: _jsx("span", { className: `absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${watchedHighlight ? 'translate-x-[22px]' : 'translate-x-0.5'}` }) })] }), _jsxs("div", { className: "flex items-center gap-3 bg-white p-3 rounded-lg border", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Active" }), _jsx("span", { className: "text-[10px] text-gray-400", children: "Visible on the website" })] }), _jsx("button", { type: "button", onClick: () => setValue('is_active', !getValues('is_active')), className: `relative w-11 h-6 rounded-full transition-colors ml-auto ${watchedActive ? 'bg-primary' : 'bg-gray-300'}`, children: _jsx("span", { className: `absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${watchedActive ? 'translate-x-[22px]' : 'translate-x-0.5'}` }) })] }), _jsxs("div", { className: "pt-2 flex gap-3", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition", children: "Cancel" }), _jsx("button", { type: "submit", disabled: submitting, className: "flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50", children: submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Item' })] })] })] })] }));
}
export default function MenuAdminPage() {
    const queryClient = useQueryClient();
    const [tab, setTab] = useState('top');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [initialParentId, setInitialParentId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [seeding, setSeeding] = useState(false);
    const { data: items, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin-menu-items'],
        queryFn: () => api.get('/menu_items/admin').then((r) => r.data),
    });
    const [localItems, setLocalItems] = useState(items ?? []);
    // Keep the optimistic copy in sync with the latest fetched items. Using an
    // effect (instead of setState during render) avoids an infinite re-render
    // loop that previously crashed the page with "Too many re-renders".
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop->state sync
        setLocalItems(items ?? []);
    }, [items]);
    const topLevelItems = useMemo(() => [...localItems]
        .filter((m) => !m.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order), [localItems]);
    const subMenuItems = useMemo(() => [...localItems]
        .filter((m) => !!m.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order), [localItems]);
    const activeItems = tab === 'top' ? topLevelItems : subMenuItems;
    const parentLabelMap = useMemo(() => {
        const map = new Map();
        topLevelItems.forEach((m) => map.set(m.id, m.label));
        return map;
    }, [topLevelItems]);
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
    }));
    const invalidateAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
        queryClient.invalidateQueries({ queryKey: ['menu_items'] });
    }, [queryClient]);
    const handleDragEnd = useCallback(async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id)
            return;
        const list = tab === 'top' ? topLevelItems : subMenuItems;
        const oldIndex = list.findIndex((m) => m.id === active.id);
        const newIndex = list.findIndex((m) => m.id === over.id);
        if (oldIndex < 0 || newIndex < 0)
            return;
        const reordered = arrayMove(list, oldIndex, newIndex);
        const updated = reordered.map((m, i) => ({ ...m, sort_order: i }));
        setLocalItems((prev) => prev.map((p) => updated.find((u) => u.id === p.id) ?? p));
        try {
            await api.patch('/menu_items/admin/reorder', {
                items: reordered.map((m, i) => ({ id: m.id, sort_order: i })),
            });
            toast.success('Order updated');
            invalidateAll();
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to reorder'));
            refetch();
        }
    }, [tab, topLevelItems, subMenuItems, invalidateAll, refetch]);
    async function handleToggle(id) {
        try {
            await api.patch(`/menu_items/admin/${id}/toggle`);
            toast.success('Menu item updated');
            invalidateAll();
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to update menu item'));
        }
    }
    async function handleDelete(id) {
        try {
            await api.delete(`/menu_items/admin/${id}`);
            toast.success('Menu item deleted');
            setDeleteConfirmId(null);
            invalidateAll();
        }
        catch (err) {
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
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to restore defaults'));
        }
        finally {
            setSeeding(false);
        }
    }
    function openCreate() {
        setEditingItem(null);
        setInitialParentId(tab === 'sub' ? null : null);
        setDrawerOpen(true);
    }
    function openEdit(item) {
        setEditingItem(item);
        setInitialParentId(item.parent_id);
        setDrawerOpen(true);
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold text-gray-900", children: "Navigation Menu" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Manage the site navigation. Seasonal promotions can be added without code deploys." })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: handleSeedDefaults, disabled: seeding, className: "px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg font-semibold flex items-center gap-2 transition disabled:opacity-50", children: [_jsx(RotateCcw, { size: 15 }), " ", seeding ? 'Restoring...' : 'Seed Defaults'] }), _jsxs("button", { onClick: openCreate, className: "px-4 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm rounded-lg font-semibold flex items-center gap-2 transition shrink-0", children: [_jsx(Plus, { size: 16 }), " Add ", tab === 'sub' ? 'Submenu' : 'Item'] })] })] }), _jsxs("div", { className: "bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3", children: [_jsx("div", { className: "bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center text-green-700 shrink-0 text-lg", children: "\uD83D\uDCA1" }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-sm text-green-900", children: "Pro Tip" }), _jsx("p", { className: "text-xs text-green-700 mt-0.5", children: "Use the menu for seasonal promotions (e.g. Diwali, Monsoon). Create a top-level item, then add submenu children under it. Pause items to hide them without deleting. The website updates automatically within 5 minutes \u2014 no deploy needed." })] })] }), _jsx("div", { className: "flex bg-white rounded-xl border overflow-hidden shadow-sm w-fit", children: [
                    ['top', `Top-Level Items (${topLevelItems.length})`],
                    ['sub', `Submenu Items (${subMenuItems.length})`],
                ].map(([key, label]) => (_jsx("button", { onClick: () => {
                        setTab(key);
                        setDeleteConfirmId(null);
                    }, className: `px-4 py-2.5 text-sm font-semibold transition ${tab === key ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`, children: label }, key))) }), _jsx("div", { className: "bg-white rounded-xl border overflow-hidden shadow-sm", children: isLoading ? (_jsx("div", { className: "px-4 py-12 text-center text-gray-400 text-sm", children: "Loading menu items..." })) : isError ? (_jsxs("div", { className: "px-4 py-12 text-center", children: [_jsx("p", { className: "text-sm text-gray-500 mb-3", children: "Failed to load menu items." }), _jsx("button", { onClick: () => refetch(), className: "px-4 py-2 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-primary/90 transition", children: "Retry" })] })) : activeItems.length === 0 ? (_jsxs("div", { className: "px-4 py-12 text-center text-gray-400 text-sm", children: ["No ", tab === 'sub' ? 'submenu items' : 'top-level items', " yet.", ' ', _jsxs("button", { onClick: openCreate, className: "text-primary font-semibold hover:underline", children: ["Add your first ", tab === 'sub' ? 'submenu item' : 'menu item'] })] })) : (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: activeItems.map((m) => m.id), strategy: verticalListSortingStrategy, children: _jsx("div", { className: "divide-y", children: activeItems.map((item) => (_jsx(SortableMenuRow, { item: item, parentLabel: item.parent_id ? parentLabelMap.get(item.parent_id) : undefined, onEdit: openEdit, onToggle: handleToggle, onDelete: handleDelete, deleteConfirmId: deleteConfirmId, setDeleteConfirmId: setDeleteConfirmId }, item.id))) }) }) })) }), drawerOpen && (_jsx(MenuDrawer, { item: editingItem, topLevelItems: topLevelItems, initialParentId: initialParentId, onClose: () => setDrawerOpen(false), onSaved: invalidateAll }))] }));
}

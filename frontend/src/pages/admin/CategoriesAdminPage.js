import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Eye, EyeOff, FolderTree, Image, Info, Pencil, Plus, Trash2, Upload, X, CheckCircle, Smartphone, } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCategoriesAdmin } from '@/hooks/useCategories';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/hooks/useAdmin';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { getApiErrorDetail } from '@/lib/apiError';
function CategoryNode({ cat, onDelete, onRename, onToggleActive, onMove, onUpdateImage, onUpdateMobileImage }) {
    const [expanded, setExpanded] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(cat.name);
    const [editingImage, setEditingImage] = useState(false);
    const [imageMode, setImageMode] = useState('url');
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [manualUrl, setManualUrl] = useState(cat.image_url || '');
    const [urlValid, setUrlValid] = useState(null);
    const [editingMobileImage, setEditingMobileImage] = useState(false);
    const [mobileImageMode, setMobileImageMode] = useState('url');
    const [mobileSelectedFile, setMobileSelectedFile] = useState(null);
    const [mobileFilePreview, setMobileFilePreview] = useState(null);
    const [mobileManualUrl, setMobileManualUrl] = useState(cat.mobile_image_url || '');
    const [mobileUrlValid, setMobileUrlValid] = useState(null);
    const [busy, setBusy] = useState(false);
    const hasChildren = cat.children && cat.children.length > 0;
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setFilePreview(URL.createObjectURL(file));
        }
    };
    const handleMobileFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setMobileSelectedFile(file);
            setMobileFilePreview(URL.createObjectURL(file));
        }
    };
    const handleUrlBlur = () => {
        if (!manualUrl) {
            setUrlValid(null);
            return;
        }
        const img = new window.Image();
        img.onload = () => setUrlValid(true);
        img.onerror = () => setUrlValid(false);
        img.src = manualUrl;
    };
    const handleMobileUrlBlur = () => {
        if (!mobileManualUrl) {
            setMobileUrlValid(null);
            return;
        }
        const img = new window.Image();
        img.onload = () => setMobileUrlValid(true);
        img.onerror = () => setMobileUrlValid(false);
        img.src = mobileManualUrl;
    };
    async function saveRename() {
        const name = editValue.trim();
        if (!name || name === cat.name) {
            setEditing(false);
            setEditValue(cat.name);
            return;
        }
        setBusy(true);
        try {
            await onRename(cat.id, name);
            toast.success('Category renamed');
            setEditing(false);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Rename failed'));
        }
        finally {
            setBusy(false);
        }
    }
    async function saveImage() {
        setBusy(true);
        try {
            if (imageMode === 'upload' && selectedFile) {
                const fd = new FormData();
                fd.append('image', selectedFile);
                await api.post(`/categories/${cat.id}/image`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            else if (imageMode === 'url' && manualUrl) {
                await onUpdateImage(cat.id, manualUrl.trim());
            }
            else if (imageMode === 'none') {
                await onUpdateImage(cat.id, null);
            }
            toast.success('Category image updated');
            setEditingImage(false);
            setSelectedFile(null);
            setFilePreview(null);
            setUrlValid(null);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to update image'));
        }
        finally {
            setBusy(false);
        }
    }
    async function saveMobileImage() {
        setBusy(true);
        try {
            if (mobileImageMode === 'upload' && mobileSelectedFile) {
                const fd = new FormData();
                fd.append('image', mobileSelectedFile);
                await api.post(`/categories/${cat.id}/mobile-image`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            else if (mobileImageMode === 'url' && mobileManualUrl) {
                await onUpdateMobileImage(cat.id, mobileManualUrl.trim());
            }
            else if (mobileImageMode === 'none') {
                await onUpdateMobileImage(cat.id, null);
            }
            toast.success('Home circle image updated');
            setEditingMobileImage(false);
            setMobileSelectedFile(null);
            setMobileFilePreview(null);
            setMobileUrlValid(null);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to update home circle image'));
        }
        finally {
            setBusy(false);
        }
    }
    async function handleMove(direction) {
        setBusy(true);
        try {
            await onMove(cat.id, direction);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Reorder failed'));
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { className: cat.is_active ? '' : 'opacity-60', children: [_jsxs("div", { className: "flex items-center gap-2 py-3 px-3 hover:bg-gray-50 rounded-lg group transition-colors", children: [_jsx("button", { onClick: () => setExpanded(!expanded), className: "w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition", children: hasChildren ? (expanded ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 })) : _jsx("span", { className: "w-3" }) }), cat.image_url ? (_jsx("img", { src: cat.image_url, alt: "", className: "w-7 h-7 rounded object-cover border bg-gray-50 shrink-0" })) : (_jsx(FolderTree, { size: 16, className: "text-primary-light shrink-0" })), editing ? (_jsxs("div", { className: "flex items-center gap-1 flex-1 min-w-0", children: [_jsx("input", { value: editValue, onChange: (e) => setEditValue(e.target.value), onKeyDown: (e) => {
                                    if (e.key === 'Enter')
                                        saveRename();
                                    if (e.key === 'Escape') {
                                        setEditing(false);
                                        setEditValue(cat.name);
                                    }
                                }, autoFocus: true, className: "flex-1 min-w-0 px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" }), _jsx("button", { onClick: saveRename, disabled: busy, className: "p-1 text-green-600 hover:bg-green-50 rounded", title: "Save", children: _jsx(Check, { size: 14 }) })] })) : (_jsx("span", { className: "text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate", children: cat.name })), _jsxs("span", { className: "text-xs text-gray-400 hidden sm:inline shrink-0 font-medium", children: ["/", cat.slug] }), !cat.is_active && (_jsx("span", { className: "text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0", children: "Hidden" })), _jsxs("div", { className: "flex items-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0", children: [_jsx("button", { onClick: () => setEditing(true), className: "p-1.5 text-gray-400 hover:text-primary transition", title: "Rename", children: _jsx(Pencil, { size: 13 }) }), _jsx("button", { onClick: () => {
                                    setEditingImage(!editingImage);
                                    setImageMode(cat.image_url ? 'url' : 'none');
                                    setManualUrl(cat.image_url || '');
                                }, className: "p-1.5 text-gray-400 hover:text-blue-600 transition", title: "Edit image", children: _jsx(Image, { size: 13 }) }), _jsx("button", { onClick: () => {
                                    setEditingMobileImage(!editingMobileImage);
                                    setMobileImageMode(cat.mobile_image_url ? 'url' : 'none');
                                    setMobileManualUrl(cat.mobile_image_url || '');
                                }, className: `p-1.5 transition ${cat.mobile_image_url ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'}`, title: "Edit home circle image", children: _jsx(Smartphone, { size: 13 }) }), _jsx("button", { onClick: () => handleMove(-1), disabled: busy, className: "p-1.5 text-gray-400 hover:text-primary transition", title: "Move up", children: _jsx(ArrowUp, { size: 13 }) }), _jsx("button", { onClick: () => handleMove(1), disabled: busy, className: "p-1.5 text-gray-400 hover:text-primary transition", title: "Move down", children: _jsx(ArrowDown, { size: 13 }) }), _jsx("button", { onClick: () => onToggleActive(cat.id, cat.is_active), disabled: busy, className: "p-1.5 text-gray-400 hover:text-primary transition", title: cat.is_active ? 'Hide from site' : 'Show on site', children: cat.is_active ? _jsx(EyeOff, { size: 13 }) : _jsx(Eye, { size: 13 }) }), _jsx("button", { onClick: () => onDelete(cat.id, cat.name), className: "p-1.5 text-red-400 hover:text-red-600 transition", title: "Delete category", children: _jsx(Trash2, { size: 13 }) })] })] }), editingImage && (_jsxs("div", { className: "px-3 py-3 bg-blue-50 border-l-2 border-blue-200 ml-3 rounded mb-2 space-y-2.5", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Edit Category Image" }), _jsx("button", { onClick: () => setEditingImage(false), className: "p-1 text-gray-400 hover:text-gray-600", children: _jsx(X, { size: 14 }) })] }), _jsxs("div", { className: "flex gap-3 text-[10px] font-bold text-gray-600", children: [_jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: imageMode === 'none', onChange: () => setImageMode('none') }), "No Image"] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: imageMode === 'upload', onChange: () => setImageMode('upload') }), "Upload"] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: imageMode === 'url', onChange: () => setImageMode('url') }), "URL"] })] }), imageMode === 'upload' && (_jsxs("div", { className: "border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-lg p-3 text-center cursor-pointer relative transition-colors", children: [_jsx("input", { type: "file", accept: "image/*", onChange: handleFileChange, className: "absolute inset-0 opacity-0 cursor-pointer" }), filePreview ? (_jsx("img", { src: filePreview, alt: "Preview", className: "max-h-16 mx-auto object-cover rounded" })) : (_jsxs("div", { className: "text-gray-400 text-[10px]", children: [_jsx(Upload, { size: 16, className: "mx-auto mb-0.5" }), _jsx("span", { className: "font-semibold block", children: "Click to upload image" })] }))] })), imageMode === 'url' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx("input", { type: "url", value: manualUrl, onChange: (e) => {
                                    setManualUrl(e.target.value);
                                    setUrlValid(null);
                                }, onBlur: handleUrlBlur, placeholder: "https://...", className: "w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400" }), urlValid === true && (_jsxs("p", { className: "text-[10px] text-green-600 flex items-center gap-1 font-semibold", children: [_jsx(CheckCircle, { size: 11 }), " Image loaded"] })), manualUrl && (_jsx("div", { className: "h-12 w-12 border rounded overflow-hidden bg-gray-50", children: _jsx("img", { src: manualUrl, alt: "", className: "h-full w-full object-cover", onError: (e) => e.currentTarget.style.display = 'none' }) }))] })), _jsxs("div", { className: "flex items-center gap-2 justify-end pt-1", children: [_jsx("button", { onClick: saveImage, disabled: busy, className: "px-2 py-1 text-xs bg-green-600 text-white rounded font-semibold hover:bg-green-700 disabled:opacity-60 transition", children: "Save Image" }), _jsx("button", { onClick: () => setEditingImage(false), className: "px-2 py-1 text-xs border rounded font-semibold hover:bg-gray-100 transition", children: "Cancel" })] })] })), editingMobileImage && (_jsxs("div", { className: "px-3 py-3 bg-purple-50 border-l-2 border-purple-200 ml-3 rounded mb-2 space-y-2.5", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("label", { className: "text-xs font-semibold text-gray-700 flex items-center gap-1.5", children: [_jsx(Smartphone, { size: 13, className: "text-purple-500" }), " Edit Home Circle Image"] }), _jsx("button", { onClick: () => setEditingMobileImage(false), className: "p-1 text-gray-400 hover:text-gray-600", children: _jsx(X, { size: 14 }) })] }), _jsx("p", { className: "text-[10px] text-gray-500 leading-relaxed", children: "Used for the circular category preview on the homepage (web + mobile). Falls back to the main category image when not set." }), _jsxs("div", { className: "flex gap-3 text-[10px] font-bold text-gray-600", children: [_jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: mobileImageMode === 'none', onChange: () => setMobileImageMode('none') }), "No Image"] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: mobileImageMode === 'upload', onChange: () => setMobileImageMode('upload') }), "Upload"] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: mobileImageMode === 'url', onChange: () => setMobileImageMode('url') }), "URL"] })] }), mobileImageMode === 'upload' && (_jsxs("div", { className: "border-2 border-dashed border-gray-200 hover:border-purple-400 rounded-lg p-3 text-center cursor-pointer relative transition-colors", children: [_jsx("input", { type: "file", accept: "image/*", onChange: handleMobileFileChange, className: "absolute inset-0 opacity-0 cursor-pointer" }), mobileFilePreview ? (_jsx("img", { src: mobileFilePreview, alt: "Preview", className: "max-h-16 mx-auto object-cover rounded" })) : (_jsxs("div", { className: "text-gray-400 text-[10px]", children: [_jsx(Upload, { size: 16, className: "mx-auto mb-0.5" }), _jsx("span", { className: "font-semibold block", children: "Click to upload image" })] }))] })), mobileImageMode === 'url' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx("input", { type: "url", value: mobileManualUrl, onChange: (e) => {
                                    setMobileManualUrl(e.target.value);
                                    setMobileUrlValid(null);
                                }, onBlur: handleMobileUrlBlur, placeholder: "https://...", className: "w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400" }), mobileUrlValid === true && (_jsxs("p", { className: "text-[10px] text-green-600 flex items-center gap-1 font-semibold", children: [_jsx(CheckCircle, { size: 11 }), " Image loaded"] })), mobileManualUrl && (_jsx("div", { className: "h-12 w-12 border rounded overflow-hidden bg-gray-50", children: _jsx("img", { src: mobileManualUrl, alt: "", className: "h-full w-full object-cover", onError: (e) => e.currentTarget.style.display = 'none' }) }))] })), mobileImageMode !== 'none' && (!mobileManualUrl && mobileImageMode === 'url') && (_jsx("p", { className: "text-[10px] text-gray-400", children: cat.image_url ? 'Currently showing the main category image as fallback.' : 'No image set. The default placeholder will be shown.' })), _jsxs("div", { className: "flex items-center gap-2 justify-end pt-1", children: [_jsx("button", { onClick: saveMobileImage, disabled: busy, className: "px-2 py-1 text-xs bg-purple-600 text-white rounded font-semibold hover:bg-purple-700 disabled:opacity-60 transition", children: "Save" }), _jsx("button", { onClick: () => setEditingMobileImage(false), className: "px-2 py-1 text-xs border rounded font-semibold hover:bg-gray-100 transition", children: "Cancel" })] })] })), expanded && hasChildren && (_jsx("div", { className: "ml-4 sm:ml-6 border-l pl-2 space-y-0.5", children: cat.children.map((child) => (_jsx(CategoryNode, { cat: child, onDelete: onDelete, onRename: onRename, onToggleActive: onToggleActive, onMove: onMove, onUpdateImage: onUpdateImage, onUpdateMobileImage: onUpdateMobileImage }, child.id))) }))] }));
}
function findSiblings(nodes, id) {
    for (const n of nodes) {
        if (n.id === id)
            return nodes.map((c) => ({ id: c.id, sort_order: c.sort_order }));
        const found = findSiblings(n.children ?? [], id);
        if (found)
            return found;
    }
    return [];
}
export default function CategoriesAdminPage() {
    const qc = useQueryClient();
    const { data: categories, isLoading, refetch } = useCategoriesAdmin();
    const createMutation = useCreateCategory();
    const deleteMutation = useDeleteCategory();
    const updateMutation = useUpdateCategory();
    const [newName, setNewName] = useState('');
    const [parentId, setParentId] = useState('');
    // Image selection states
    const [imageMode, setImageMode] = useState('none');
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [manualUrl, setManualUrl] = useState('');
    const [urlValid, setUrlValid] = useState(null);
    // Mobile home circle image selection states
    const [mobileImageMode, setMobileImageMode] = useState('none');
    const [mobileSelectedFile, setMobileSelectedFile] = useState(null);
    const [mobileFilePreview, setMobileFilePreview] = useState(null);
    const [mobileManualUrl, setMobileManualUrl] = useState('');
    const [mobileUrlValid, setMobileUrlValid] = useState(null);
    const allCats = categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];
    const roots = categories?.filter((c) => !c.parent_id) ?? [];
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setFilePreview(URL.createObjectURL(file));
        }
    };
    const handleMobileFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setMobileSelectedFile(file);
            setMobileFilePreview(URL.createObjectURL(file));
        }
    };
    const handleUrlBlur = () => {
        if (!manualUrl) {
            setUrlValid(null);
            return;
        }
        const img = new window.Image();
        img.onload = () => setUrlValid(true);
        img.onerror = () => setUrlValid(false);
        img.src = manualUrl;
    };
    const handleMobileUrlBlur = () => {
        if (!mobileManualUrl) {
            setMobileUrlValid(null);
            return;
        }
        const img = new window.Image();
        img.onload = () => setMobileUrlValid(true);
        img.onerror = () => setMobileUrlValid(false);
        img.src = mobileManualUrl;
    };
    function invalidate() {
        qc.invalidateQueries({ queryKey: ['categories'] });
        qc.invalidateQueries({ queryKey: ['categories-admin'] });
        refetch();
    }
    async function handleCreate(e) {
        e.preventDefault();
        if (!newName.trim())
            return;
        try {
            // 1. Create category basic structure (image_url accepted inline)
            const newCat = await createMutation.mutateAsync({
                name: newName.trim(),
                parent_id: parentId ? Number(parentId) : null,
                ...(imageMode === 'url' && manualUrl ? { image_url: manualUrl } : {}),
                ...(mobileImageMode === 'url' && mobileManualUrl ? { mobile_image_url: mobileManualUrl } : {}),
            });
            // 2. Upload image if chosen (file upload requires a follow-up request)
            if (imageMode === 'upload' && selectedFile) {
                const fd = new FormData();
                fd.append('image', selectedFile);
                await api.post(`/categories/${newCat.id}/image`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            // 3. Upload mobile home circle image if chosen
            if (mobileImageMode === 'upload' && mobileSelectedFile) {
                const fd = new FormData();
                fd.append('image', mobileSelectedFile);
                await api.post(`/categories/${newCat.id}/mobile-image`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            toast.success('Category created successfully!');
            // Reset forms
            setNewName('');
            setParentId('');
            setImageMode('none');
            setSelectedFile(null);
            setFilePreview(null);
            setManualUrl('');
            setUrlValid(null);
            setMobileImageMode('none');
            setMobileSelectedFile(null);
            setMobileFilePreview(null);
            setMobileManualUrl('');
            setMobileUrlValid(null);
            invalidate();
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to create category'));
        }
    }
    async function handleDelete(id, name) {
        if (!confirm(`Are you sure you want to delete "${name}"? Categories with active products attached cannot be deleted.`))
            return;
        try {
            await deleteMutation.mutateAsync(id);
            toast.success('Category deleted successfully!');
            invalidate();
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to delete (check if products are attached)'));
        }
    }
    async function handleRename(id, name) {
        await updateMutation.mutateAsync({ id, body: { name } });
        invalidate();
    }
    async function handleToggleActive(id, isActive) {
        await updateMutation.mutateAsync({ id, body: { is_active: !isActive } });
        toast.success(isActive ? 'Category hidden from site' : 'Category shown on site');
        invalidate();
    }
    async function handleMove(id, direction) {
        const siblings = findSiblings(roots, id).sort((a, b) => a.sort_order - b.sort_order);
        const index = siblings.findIndex((s) => s.id === id);
        if (index === -1 || siblings.length < 2)
            return;
        const swapWith = index + direction;
        if (swapWith < 0 || swapWith >= siblings.length)
            return;
        const a = siblings[index];
        const b = siblings[swapWith];
        await updateMutation.mutateAsync({ id: a.id, body: { sort_order: b.sort_order } });
        await updateMutation.mutateAsync({ id: b.id, body: { sort_order: a.sort_order } });
        invalidate();
    }
    async function handleUpdateImage(id, imageUrl) {
        await updateMutation.mutateAsync({ id, body: { image_url: imageUrl } });
        invalidate();
    }
    async function handleUpdateMobileImage(id, mobileImageUrl) {
        await updateMutation.mutateAsync({ id, body: { mobile_image_url: mobileImageUrl } });
        toast.success(mobileImageUrl ? 'Home circle image set' : 'Home circle image removed');
        invalidate();
    }
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold text-gray-900", children: "Categories Management" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Organize store products into logical groups. Root categories drive the navigation menu." })] }), _jsxs("div", { className: "bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 shadow-sm", children: [_jsx("div", { className: "bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0", children: _jsx(Info, { size: 18 }) }), _jsxs("div", { className: "text-xs text-gray-600 leading-relaxed", children: [_jsx("p", { className: "font-bold text-primary", children: "Where do categories show up on the website?" }), _jsxs("ul", { className: "list-disc pl-4 mt-1 space-y-0.5", children: [_jsxs("li", { children: [_jsx("strong", { children: "Root Categories" }), " (no parent) appear in the main navigation menu, the mobile menu, the footer, and the homepage category slider. Use the arrows to control their order in the menu."] }), _jsxs("li", { children: [_jsx("strong", { children: "Subcategories" }), " (attached to a parent) show up as dropdown items under their root and in the catalog filters."] }), _jsxs("li", { children: ["Use the ", _jsx("strong", { children: "eye" }), " button to hide a category from the site; hidden categories still appear here so you can bring them back."] }), _jsxs("li", { children: ["To change the ", _jsx("strong", { children: "page banner" }), " for a category, go to ", _jsx("strong", { children: "Banners \u2192 Page" }), " and set the ", _jsx("em", { children: "Target Path" }), " field to the category slug (e.g. ", _jsx("code", { children: "xl-plants" }), ")."] })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-5", children: [_jsxs("div", { className: "md:col-span-1 bg-white p-4 rounded-xl border shadow-sm space-y-4 h-fit", children: [_jsx("h2", { className: "text-sm font-bold text-gray-800 pb-2 border-b", children: "Add New Category" }), _jsxs("form", { onSubmit: handleCreate, className: "space-y-3.5", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Category Name *" }), _jsx("input", { placeholder: "e.g., Ferns, Bonsai, Ceramic Pots", value: newName, onChange: (e) => setNewName(e.target.value), required: true, className: "w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Parent Category" }), _jsxs("select", { value: parentId, onChange: (e) => setParentId(e.target.value), className: "w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary", children: [_jsx("option", { value: "", children: "No Parent (Root category)" }), allCats.map((c) => (_jsx("option", { value: c.id, children: c.parent_id ? `↳ ${c.name}` : c.name }, c.id)))] }), _jsx("p", { className: "text-[9px] text-gray-400 mt-1", children: "If this is a subcategory, select its parent here." })] }), _jsxs("div", { className: "pt-2 border-t space-y-2", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Category Thumbnail / Image" }), _jsxs("div", { className: "flex gap-3 text-[10px] font-bold text-gray-500 mb-2", children: [_jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: imageMode === 'none', onChange: () => setImageMode('none') }), "No Image"] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: imageMode === 'upload', onChange: () => setImageMode('upload') }), "Upload Image"] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: imageMode === 'url', onChange: () => setImageMode('url') }), "Paste URL"] })] }), imageMode === 'upload' && (_jsx("div", { className: "space-y-2", children: _jsxs("div", { className: "border-2 border-dashed border-gray-100 hover:border-primary/40 rounded-lg p-4 text-center cursor-pointer relative transition-colors", children: [_jsx("input", { type: "file", accept: "image/*", onChange: handleFileChange, className: "absolute inset-0 opacity-0 cursor-pointer" }), filePreview ? (_jsx("img", { src: filePreview, alt: "Preview", className: "max-h-20 mx-auto object-cover rounded" })) : (_jsxs("div", { className: "text-gray-400", children: [_jsx(Upload, { size: 20, className: "mx-auto mb-1" }), _jsx("span", { className: "text-[10px] font-semibold block text-gray-700", children: "Choose image file" })] }))] }) })), imageMode === 'url' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx("input", { type: "url", value: manualUrl, onChange: (e) => { setManualUrl(e.target.value); setUrlValid(null); }, onBlur: handleUrlBlur, placeholder: "https://...", className: "w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none" }), urlValid === true && (_jsxs("p", { className: "text-[10px] text-green-600 flex items-center gap-1 font-semibold", children: [_jsx(CheckCircle, { size: 11 }), " Image loaded"] })), manualUrl && (_jsx("div", { className: "h-12 w-12 border rounded overflow-hidden mt-1.5 bg-gray-50", children: _jsx("img", { src: manualUrl, alt: "", className: "h-full w-full object-cover", onError: (e) => e.currentTarget.style.display = 'none' }) }))] }))] }), _jsxs("div", { className: "pt-2 border-t space-y-2", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Home Circle Image (Optional)" }), _jsx("p", { className: "text-[9px] text-gray-400", children: "Used for the circular preview on the homepage (web + mobile). Falls back to the category image if not set." }), _jsxs("div", { className: "flex gap-3 text-[10px] font-bold text-gray-500 mb-2", children: [_jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: mobileImageMode === 'none', onChange: () => setMobileImageMode('none') }), "No Image"] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: mobileImageMode === 'upload', onChange: () => setMobileImageMode('upload') }), "Upload Image"] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "radio", checked: mobileImageMode === 'url', onChange: () => setMobileImageMode('url') }), "Paste URL"] })] }), mobileImageMode === 'upload' && (_jsx("div", { className: "space-y-2", children: _jsxs("div", { className: "border-2 border-dashed border-gray-100 hover:border-purple-400/40 rounded-lg p-4 text-center cursor-pointer relative transition-colors", children: [_jsx("input", { type: "file", accept: "image/*", onChange: handleMobileFileChange, className: "absolute inset-0 opacity-0 cursor-pointer" }), mobileFilePreview ? (_jsx("img", { src: mobileFilePreview, alt: "Preview", className: "max-h-20 mx-auto object-cover rounded" })) : (_jsxs("div", { className: "text-gray-400", children: [_jsx(Upload, { size: 20, className: "mx-auto mb-1" }), _jsx("span", { className: "text-[10px] font-semibold block text-gray-700", children: "Choose image file" })] }))] }) })), mobileImageMode === 'url' && (_jsxs("div", { className: "space-y-1.5", children: [_jsx("input", { type: "url", value: mobileManualUrl, onChange: (e) => { setMobileManualUrl(e.target.value); setMobileUrlValid(null); }, onBlur: handleMobileUrlBlur, placeholder: "https://...", className: "w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none" }), mobileUrlValid === true && (_jsxs("p", { className: "text-[10px] text-green-600 flex items-center gap-1 font-semibold", children: [_jsx(CheckCircle, { size: 11 }), " Image loaded"] })), mobileManualUrl && (_jsx("div", { className: "h-12 w-12 border rounded overflow-hidden mt-1.5 bg-gray-50", children: _jsx("img", { src: mobileManualUrl, alt: "", className: "h-full w-full object-cover", onError: (e) => e.currentTarget.style.display = 'none' }) }))] }))] }), _jsxs("button", { type: "submit", disabled: createMutation.isPending || !newName.trim(), className: "w-full py-2.5 bg-primary text-white text-xs rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/95 disabled:opacity-60 transition", children: [_jsx(Plus, { size: 14 }), " Add Category"] })] })] }), _jsxs("div", { className: "md:col-span-2 bg-white p-4 rounded-xl border shadow-sm", children: [_jsx("h2", { className: "text-sm font-bold text-gray-800 pb-2 border-b mb-3", children: "Category Hierarchy" }), isLoading ? (_jsx("p", { className: "text-center text-gray-400 py-12 text-xs", children: "Loading categories tree..." })) : roots.length === 0 ? (_jsx("p", { className: "text-center text-gray-400 py-12 text-xs", children: "No categories registered yet. Create one on the left." })) : (_jsx("div", { className: "space-y-0.5", children: roots.map((cat) => (_jsx(CategoryNode, { cat: cat, onDelete: handleDelete, onRename: handleRename, onToggleActive: handleToggleActive, onMove: handleMove, onUpdateImage: handleUpdateImage, onUpdateMobileImage: handleUpdateMobileImage }, cat.id))) })), _jsx("p", { className: "text-[10px] text-gray-400 mt-3 border-t pt-2", children: "Tip: hover a category to edit its images (blue = category image, purple = home circle image), reorder, hide/show, and delete." })] })] })] }));
}
